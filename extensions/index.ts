// Copyright 2026 Google LLC.
// SPDX-License-Identifier: Apache-2.0

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import * as fs from "node:fs/promises";
import { existsSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = typeof __dirname !== "undefined"
  ? __dirname
  : path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(currentDir, "..");

const PERSONAS: Record<string, string> = {
  "egm-zoom-out": "agents/zoom_out.md",
  "zoom_out": "agents/zoom_out.md",
  "egm-comprehension": "agents/comprehension.md",
  "comprehension": "agents/comprehension.md",
  "egm-design": "agents/design_critic.md",
  "egm-design-critic": "agents/design_critic.md",
  "design_critic": "agents/design_critic.md",
  "egm-structural": "agents/structural.md",
  "structural": "agents/structural.md",
  "egm-style": "agents/style.md",
  "style": "agents/style.md",
  "egm-implementation-readiness": "agents/implementation_readiness.md",
  "implementation_readiness": "agents/implementation_readiness.md",
  "egm-codebase-details": "agents/codebase_details.md",
  "codebase_details": "agents/codebase_details.md",
  "egm-synthesizer": "agents/synthesizer.md",
  "synthesizer": "agents/synthesizer.md",
  "egm-bootstrap": "agents/bootstrap_orchestrator.md",
  "egm-bootstrap-orchestrator": "agents/bootstrap_orchestrator.md",
  "bootstrap_orchestrator": "agents/bootstrap_orchestrator.md",
};

const READ_ONLY_REVIEWER_TOOLS = ["read", "grep", "find", "ls"];
const SYNTHESIZER_TOOLS = ["read", "grep", "find", "ls", "write", "invoke_subagent"];
const BOOTSTRAP_TOOLS = ["read", "grep", "find", "ls", "write", "edit", "bash", "invoke_subagent"];

const SubagentInputSchema = Type.Object({
  subagent_type: Type.String({
    description: "The persona name (e.g. 'egm-zoom-out', 'egm-synthesizer', 'egm-design', 'egm-comprehension')",
  }),
  prompt: Type.String({
    description: "The task instructions for the subagent to execute",
  }),
  mode: Type.Optional(Type.String({
    description: "Optional operating mode: 'REVIEW' or 'BRAINSTORM'",
  })),
  context_files: Type.Optional(Type.Array(Type.String(), {
    description: "Optional list of context files to supply to the subagent",
  })),
});

type SubagentInput = {
  subagent_type: string;
  prompt: string;
  mode?: string;
  context_files?: string[];
};

function resolvePersonaPath(subagent: string): string | null {
  const normalized = subagent.trim().toLowerCase();
  const relPath = PERSONAS[normalized]
    || PERSONAS[normalized.replace(/^egm-/, "")]
    || PERSONAS[normalized.replace(/-/g, "_")];
  if (relPath) {
    const candidate = path.join(packageRoot, relPath);
    if (existsSync(candidate)) return candidate;
  }
  const fallback = path.join(packageRoot, "agents", `${normalized.replace(/^egm-/, "").replace(/-/g, "_")}.md`);
  return existsSync(fallback) ? fallback : null;
}

function createSubagentToolDefinition(pkgRoot: string) {
  return {
    name: "invoke_subagent",
    label: "invoke_subagent",
    description: "Spawn a fresh-context Goldfish reviewer or Synthesizer in an isolated in-memory session.",
    parameters: SubagentInputSchema,
    execute: async (
      _toolCallId: string,
      params: SubagentInput,
      _signal: AbortSignal | undefined,
      _onUpdate: unknown,
      ctx: ExtensionContext
    ) => {
      const subagent = (params.subagent_type || (params as any).persona || (params as any).name || "").trim();
      const taskPrompt = params.prompt || (params as any).task || (params as any).instructions || "";
      const isSynth = subagent.includes("synthesizer");
      const isBootstrap = subagent.includes("bootstrap");

      let activeTools: string[];
      let customTools: any[] = [];
      if (isSynth) {
        activeTools = SYNTHESIZER_TOOLS;
        customTools = [createSubagentToolDefinition(pkgRoot)];
      } else if (isBootstrap) {
        activeTools = BOOTSTRAP_TOOLS;
        customTools = [createSubagentToolDefinition(pkgRoot)];
      } else {
        activeTools = READ_ONLY_REVIEWER_TOOLS;
      }

      const sessionManager = SessionManager.inMemory();
      const { session: childSession } = await createAgentSession({
        sessionManager,
        cwd: ctx.cwd,
        tools: activeTools,
        customTools,
        model: ctx.model,
      });

      let assembledPrompt = "";
      const personaPath = resolvePersonaPath(subagent);
      if (personaPath) {
        const personaText = await fs.readFile(personaPath, "utf-8");
        assembledPrompt += `You are operating as the specialized persona defined below:\n\n${personaText}\n\n---\n\n`;
      }
      if (params.mode) {
        assembledPrompt += `Mode: ${params.mode}\n\n`;
      }
      if (Array.isArray(params.context_files) && params.context_files.length > 0) {
        assembledPrompt += `Context files to examine:\n${params.context_files.map((f: string) => `- ${f}`).join("\n")}\n\n`;
      }
      assembledPrompt += taskPrompt;

      try {
        if (ctx.ui?.setStatus) {
          ctx.ui.setStatus(`Goldfish [${subagent}] running...`);
        }
        await childSession.prompt(assembledPrompt);
        const resultText = childSession.getLastAssistantText() || "";
        return {
          content: [{ type: "text", text: resultText || "Review completed with no output." }],
          details: { subagent, status: "completed" },
        };
      } finally {
        childSession.dispose();
        if (ctx.ui?.setStatus) {
          ctx.ui.setStatus(undefined);
        }
      }
    },
  };
}

export default function egmExtension(pi: ExtensionAPI) {
  pi.registerTool(createSubagentToolDefinition(packageRoot));
  // shortcut: /egm-* slash commands come from prompts/*.md only. Registering
  // them here too makes Pi hosts reject the whole command list as duplicate
  // names; when these templates need per-host behavior, add it to the template.
}
