---
title: "web_search runs shell commands from project-local settings without a trust check"
status: COMPLETE
resolution: DONE
kind: BUG
priority: HIGH
assignee: AGENT
reporter: AGENT
created_at: 2026-11-10T22:44:14.588Z
updated_at: 2026-11-11T21:54:01.639Z
related:
  - TOOLS-92
---

# web_search runs shell commands from project-local settings without a trust check

## Corrected hermetic full gate passed (2026-11-11)

With the approved mwqvznwo smoke guard inherited, independent frozen install, zero-warning check and unfiltered full suite passed: 72 files/573 tests. Actual offline/read-only packed CLI checks included. Exact command: bun run test --maxWorkers 1 --no-file-parallelism. No timeout changes or retries. Status NEEDS REVIEW, not accepted. Logs: /var/folders/zj/49vt4cds6l15fs_1frdvz89r0000gn/T/sandpiper-tools121-independent.7rb1rlik/04-zvooskpz/.

## Full verification passed (2026-11-11)

zvooskpz: independent frozen install, zero-warning bun check, and full `bun run test --maxWorkers 1 --no-file-parallelism` passed: 72 files / 573 tests. No filters, exclusions or timeout changes; real offline/read-only packed CLI checks included. Fresh start load was below8. Independent code review found no outstanding actionable findings. Status is NEEDS REVIEW, not user-accepted COMPLETE. Logs: /tmp/sandpiper-gate-first-four-full.3QipCL/zvooskpz/. Earlier implementation checkpoints below preceded this full gate.

## Independent check checkpoint (2026-11-11)

Parent/gate independently passed frozen install and the revision-specific bun check with zero errors/warnings. All ten tasks are implemented and independently reviewed with no outstanding actionable findings. Full/per-commit full-test gates remain pending quiet load; no completion or acceptance is claimed.

## Implementation checkpoint (2026-11-11)

Change zvooskpz gates project settings on current tool-context trust/cwd, preserving agent/env !command support. Real temporary-marker regression failed before the fix and passed after it; worker gate passed 50 focused tests. Independent review found no actionable issue. Full/per-commit quiet-machine gates are pending.

Status remains IN PROGRESS. This checkpoint is not verified completion or user acceptance.

## Decision (Doug, 2026-11-10)

Fix it with the project trust check: read <cwd>/.sandpiper/settings.json only when ExtensionContext.isProjectTrusted() returns true, and always read the agent directory settings.json. Keep the resolver and its "!command" support. Not started.

## Facts added on 2026-11-10

- Doug keeps his Brave key in settings as a "!command" value that reads from his 1Password vault. The resolver and its "!command" support stay. Reading the key from the environment only is not an option.
- Pi resolves "!command" values too, for provider keys, MCP headers and credentials. The difference is trust: Pi's SettingsManager does not load a project's settings at all until the project is trusted (dist/core/settings-manager.js:257-259). The web-search resolver reads the project file directly and skips that check.
- Pi 1.5.2 gives extensions the trust decision: ExtensionContext.isProjectTrusted() (dist/core/extensions/types.d.ts:258).

Preferred fix, pending Doug's decision: read <cwd>/.sandpiper/settings.json only when isProjectTrusted() returns true, and always read the agent directory's settings.json. That matches Pi and changes nothing for a key kept in the agent directory.

## Defect

The web_search tool reads its Brave API key through extensions/web-search/src/config-resolver.ts. That resolver reads <cwd>/.sandpiper/settings.json before the agent directory's settings.json (config-resolver.ts:99-110), and it runs a value that starts with "!" as a shell command through execSync (config-resolver.ts:29-45).

So a repository can carry a .sandpiper/settings.json with a web-search braveApiKey value such as "!some command". The first web_search call in a session started in that directory runs the command. Nothing checks Pi's project trust decision first. Pi applies a trust check to project settings; this hand-written copy of Pi's value resolution does not.

The BRAVE_API_KEY environment value goes through the same resolver (adapter-selection.ts:31-34), so an environment value that starts with "!" is executed too.

Verified by reading the code on 2026-11-10. Not exercised.

## Options

1. Read the key from the environment and from the agent directory's settings.json only. Do not read project-local settings for this key.
2. Keep project-local settings but resolve "!" commands only from the agent directory's file.
3. Read BRAVE_API_KEY from the environment only and delete the resolver (132 lines plus tests). Pi 1.5.2 does not export its own resolveConfigValue, so the copy cannot be replaced by an import.

A regression test must fail first: a project-local settings file with a "!" value must not cause a command to run.

Also wrong in extensions/web-search/README.md: it documents the settings key as "apiKey" (the code reads braveApiKey), names ~/.sandpiper/settings.json (the code reads the agent directory's settings.json), says a bare uppercase name is expanded as an environment reference (only $VAR and ${VAR} are), and shows the result as a JSON array (the tool returns numbered text).

Found during the TOOLS-92 review. Inventory row B-25.

---

# Activity Log

## 2026-11-10T23:17:21.600Z

- **description**: 21 lines → updated (29 lines)

## 2026-11-10T23:40:06.888Z

- **description**: 29 lines → updated (33 lines)

## 2026-11-11T17:03:39.773Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-11T17:32:17.619Z

- **description**: 33 lines → updated (39 lines)

## 2026-11-11T17:58:20.108Z

- **description**: 39 lines → updated (43 lines)

## 2026-11-11T18:14:48.294Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-11T18:15:17.186Z

- **description**: 43 lines → updated (47 lines)

## 2026-11-11T19:21:12.411Z

- **description**: 47 lines → updated (51 lines)

## 2026-11-11T21:54:01.639Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
