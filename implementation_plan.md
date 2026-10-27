# Implementation Plan: Elephant-Goldfish Model (EGM) Package for Pi via NPM Registry (`pi.dev/packages`)

## Overview

This plan details the implementation, packaging, npm publishing, and installation workflow for **Pi** (`https://pi.dev/packages`) as a Tier-1 supported harness for the Elephant-Goldfish Model (EGM).

The target distribution and installation method is **direct publication to the public npm registry** and installation through Pi's native npm package loader:
```bash
# Global / Personal install:
pi install npm:@google/elephant-goldfish-model
# Or unscoped variant:
pi install npm:elephant-goldfish-model

# Try package ephemerally (without saving to settings):
pi -e npm:@google/elephant-goldfish-model

# Project-scoped install (.pi/settings.json):
pi install -l npm:@google/elephant-goldfish-model
```

Once published to npm with `"keywords": ["pi-package"]`, Pi packages automatically index into the official gallery at `https://pi.dev/packages`.

---

## NPM Distribution & Packaging Architecture

### 1. NPM Package Manifest (`package.json`)
The package manifest defines package identity, Pi entry points, runtime dependencies, and tarball inclusion boundaries:

```json
{
  "name": "@google/elephant-goldfish-model",
  "version": "0.1.0",
  "description": "Draft specs, review designs with fresh-context reviewers, and check implementation drift in Pi.",
  "keywords": [
    "pi-package",
    "pi",
    "skills",
    "spec-driven-development",
    "design-documents",
    "design-review",
    "goldfish",
    "elephant"
  ],
  "author": {
    "name": "Google"
  },
  "homepage": "https://egm.dev",
  "repository": {
    "type": "git",
    "url": "https://github.com/google/elephant-goldfish-model.git"
  },
  "license": "Apache-2.0",
  "publishConfig": {
    "access": "public"
  },
  "peerDependencies": {
    "@earendil-works/pi-ai": "*",
    "@earendil-works/pi-agent-core": "*",
    "@earendil-works/pi-coding-agent": "*",
    "@earendil-works/pi-tui": "*",
    "typebox": "*"
  },
  "pi": {
    "extensions": ["./extensions/index.ts"],
    "skills": ["./skills"],
    "prompts": ["./prompts/*.md"],
    "image": "./assets/icon.svg"
  },
  "files": [
    "package.json",
    "LICENSE",
    "README.md",
    "assets/icon.svg",
    "extensions/",
    "skills/",
    "agents/",
    "resources/",
    "prompts/",
    "docs/pi.md",
    "docs/getting_started.md",
    "docs/harnesses.md"
  ],
  "scripts": {
    "check": "tsc --noEmit",
    "prepack": "python scripts/validate_npm_manifest.py",
    "pack:dry-run": "npm pack --dry-run"
  }
}
```

### 2. Strict Peer Dependency Rules (Pi Host Invariant)
* **No Host Packages in `dependencies`**: As mandated by Pi package architecture (`packages.md`), host-supplied packages (`@earendil-works/pi-coding-agent`, `@earendil-works/pi-ai`, `@earendil-works/pi-agent-core`, `@earendil-works/pi-tui`, `typebox`) MUST be listed exclusively in `peerDependencies` with `*` range and NEVER in `dependencies`.
* **Reason**: Physical bundling of host packages inside `node_modules` causes duplicate class instances, breaks module singleton registries, and triggers Pi runtime extension warnings.

### 3. NPM Tarball Bounds (`files` allowlist)
* To keep the published npm tarball minimal and secure, only runtime files are shipped:
  - Included: `package.json`, `LICENSE`, `README.md`, `assets/icon.svg`, `extensions/`, `skills/`, `agents/`, `resources/`, `prompts/`, and essential user docs (`docs/pi.md`).
  - Excluded: Test suites (`tests/`), CI workflows (`.github/`), Python build scripts (`scripts/`), site assets (`site/`), dev manifests (`pyproject.toml`, `requirements-dev.txt`), and host-specific catalogs (`.claude-plugin/`, `.codex-plugin/`, `.agents/`).

### 4. Installed Path & Resource Resolution in NPM Cache
* When installed via `pi install npm:...`, Pi clones or extracts the package into `~/.pi/agent/npm/node_modules/<package-name>/`.
* The extension must resolve canonical resources (`agents/*.md`, `resources/document_standards/`) relative to `import.meta.url` (or `__dirname`), rather than assuming a fixed Git checkout root or user working directory.

---

## Core Runtime Architecture in Pi

### 1. Zero-Context Goldfish Reviewer Isolation
* **Isolation Protocol**: Reviewer subagents must have 0 conversational history and evaluate specs as naive readers.
* **Pi Implementation**: The extension registers `invoke_subagent`. For each reviewer dispatch, it instantiates an in-memory session:
  ```typescript
  const { session: childSession } = await createAgentSession({
    sessionManager: SessionManager.inMemory(),
    cwd: ctx.cwd,
    tools: reviewerTools,
    model: ctx.model,
  });
  ```
* **Stateless Guarantee**: `SessionManager.inMemory()` ensures no messages, context summaries, or prompt history leak from the parent Elephant conversation.

### 2. Strict Tool Permission Sandboxing
* **Reviewers** (`egm-zoom-out`, `egm-comprehension`, `egm-design`, `egm-structural`, `egm-style`, `egm-implementation-readiness`, `egm-codebase-details`): Strictly read-only tools via `createReadOnlyTools(cwd)` (`read`, `grep`, `find`, `ls`). No write, edit, or shell tools.
* **Synthesizer** (`egm-synthesizer`): Read-only tools + `createWriteTool(cwd)` + nested `invoke_subagent` delegation.
* **Bootstrap Orchestrator** (`egm-bootstrap`): Read-only tools + `createWriteTool` + `createEditTool` + `createBashTool` + nested `invoke_subagent`.

### 3. Native Commands & Prompt Templates
* **Slash Commands**: Extension registers `/egm-brainstorm`, `/egm-draft`, `/egm-review`, `/egm-resolve`, `/egm-bootstrap`, and `/egm-drift-report`.
* **Prompt Templates**: Markdown files under `prompts/` provide command-line argument autocompletion in the Pi editor (e.g. `/egm-review <target-file> [step]`).
* **Artifact Directory**: Honors `EGM artifact directory: <path>` configured in `AGENTS.md` or user prompt.

---

## Proposed Changes

### New Files

1. **`package.json`** (Root Manifest)
   - Configures the npm package for publishing to npm registry and installation in Pi.
   - Declares `pi-package` keyword, `publishConfig`, `peerDependencies`, `pi` resources, and `files` allowlist.

2. **`extensions/index.ts`** (Pi Extension)
   - Registers `invoke_subagent` tool with dynamic persona loading and tool restrictions.
   - Manages fresh in-memory subagent session lifecycle and returns completed findings.
   - Registers slash commands and handles UI status updates during reviews.

3. **`prompts/*.md`** (Prompt Templates)
   - `prompts/egm-review.md`
   - `prompts/egm-brainstorm.md`
   - `prompts/egm-draft.md`
   - `prompts/egm-resolve.md`
   - `prompts/egm-bootstrap.md`
   - `prompts/egm-drift-report.md`

4. **`docs/pi.md`** (Pi Harness Guide)
   - NPM install commands (`pi install npm:@google/elephant-goldfish-model`).
   - Invocation patterns, subagent isolation explanation, and permission rules.

5. **`docs/designs/pi_package.md`** (Stage 1 Design Document)
   - Formal EGM architectural design doc per `AGENTS.md` guidelines.

### Modified Files

6. **`docs/designs/README.md`**
   - Register `pi_package.md`.

7. **`docs/harnesses.md`**
   - Add Pi install instructions (`npm:...`), manifests, and delegation details.

8. **`README.md`**
   - Add Pi NPM install section under Quickstart.

9. **`scripts/pack_plugin.py`**
   - Add `"pi"` target to validate and build the npm-compatible distribution archive.

10. **`scripts/prepare_release.py`**
    - Validate `package.json` version sync with `plugin.json` and release tag.
    - Generate `egm-pi-${version}.tgz` (via `npm pack`) alongside existing zip archives.

11. **`tests/unit/test_harnesses.py`**
    - Verify `package.json` metadata drift, `peerDependencies`, `pi` field, and `docs/pi.md` markers.

12. **`tests/unit/test_packaging.py`**
    - Add test for `npm pack` tarball contents to assert zero dev files leak into the published npm package.

---

## Step-by-Step Implementation Plan

### Step 1: Design Doc & Scope Alignment (Stage 1 PR)
1. Write `docs/designs/pi_package.md` covering npm registry distribution, tarball layout, and in-memory session isolation.
2. Link the design in `docs/designs/README.md`.

### Step 2: Create NPM Package Manifest (`package.json`)
1. Create `package.json` with public access, `pi-package` keyword, `peerDependencies`, and `files` allowlist.
2. Ensure version matches `plugin.json` (`0.1.0`).

### Step 3: Implement Pi Extension (`extensions/index.ts`)
1. Implement persona resolver from `agents/*.md` relative to package installation directory.
2. Implement `invoke_subagent` using `createAgentSession` and `SessionManager.inMemory()`.
3. Add tool restrictions (read-only for reviewers; write + agent for synthesizer).
4. Register slash commands.

### Step 4: Add Prompt Templates (`prompts/*.md`)
1. Create all 6 prompt templates under `prompts/` with argument hints.

### Step 5: Update Documentation & Harness Reference
1. Create `docs/pi.md` with npm registry installation instructions (`pi install npm:...`).
2. Update `docs/harnesses.md` and `README.md`.

### Step 6: Update Build & Packaging Scripts
1. Update `scripts/pack_plugin.py` to support building the Pi bundle.
2. Update `scripts/prepare_release.py` to run `npm pack` and include the resulting `.tgz` in release artifacts.

### Step 7: Testing & Verification
1. Update Python unit tests (`test_harnesses.py`, `test_packaging.py`) to verify `package.json` and tarball integrity.
2. Run `npm pack --dry-run` to audit shipped files.
3. Perform end-to-end installation test with `pi install npm:...` (or local tarball `pi install ./<tarball>.tgz`).

---

## NPM Publishing & Verification Strategy

### 1. Pre-Publish Tarball Inspection
* Run `npm pack --dry-run` and automated tests to verify:
  - Packaged tarball contains all 7 skills, 9 agent personas, and 5 document standards.
  - Zero test files, `.github/` workflows, or internal Python scripts are bundled.
  - Package size is strictly under 1 MB.

### 2. NPM Registry Publication
* Publish to npm registry:
  ```bash
  npm publish --access public
  ```
* Verify package listing and metadata appear on `https://www.npmjs.com/package/@google/elephant-goldfish-model` and index on `https://pi.dev/packages`.

### 3. Post-Publish Installation & Smoke Test
* Test clean install in an empty directory:
  ```bash
  pi install npm:@google/elephant-goldfish-model
  ```
* Verify `pi list` shows `@google/elephant-goldfish-model` with active skills and extensions.
* Run `/egm-review` or `/skill:egm-review` on a sample design doc to verify Goldfish reviewers spawn with clean isolation and read-only tools.
