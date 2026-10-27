<!--
Copyright 2026 Google LLC.
SPDX-License-Identifier: Apache-2.0
-->

# Pi integration

Pi ([https://pi.dev](https://pi.dev)) installs and runs EGM through its package
system and package gallery ([https://pi.dev/packages](https://pi.dev/packages)).

## Install

Install from npm or local path:

```sh
pi install npm:egm
# or scoped:
pi install npm:@google/elephant-goldfish-model
# or local development:
pi install ./
```

To try EGM for a single session without updating settings:

```sh
pi -e npm:egm
```

## Invocation and resources

Use `/egm-brainstorm`, `/egm-draft`, or `/egm-review` directly in chat, or use
skill commands such as `/skill:egm-review <target-file>`.

Skills retain `disable-model-invocation: true`: explicit user invocation keeps
workflow control deterministic while allowing manual execution when needed.

Pi resolves bundled resources relative to the installed package directory.
Review targets and generated artifacts belong to the user's workspace, not the
package cache.

## Fresh-context reviewers

EGM registers the `invoke_subagent` tool in Pi. When invoked, it launches an
isolated, in-process `createAgentSession` using `SessionManager.inMemory()`.

This guarantees stateless Goldfish isolation:
- The subagent has zero conversation history from the parent Elephant context.
- Reviewer personas (`egm-zoom-out`, `egm-comprehension`, `egm-design`,
  `egm-structural`, `egm-style`, `egm-implementation-readiness`,
  `egm-codebase-details`) are strictly limited to read-only tools (`read`,
  `grep`, `find`, `ls`).
- `egm-synthesizer` receives read-only tools, `write`, and recursive
  `invoke_subagent` to orchestrate parallel reviews and write consolidated
  reports.

## Artifact directory

Write briefs, drafts, and reports to the user's working directory.
If the user's prompt or agent instructions file (`AGENTS.md`) has a line
`EGM artifact directory: <path>`, write them to that folder instead:
resolve a relative path against the working directory, and create the folder if
it does not exist.
