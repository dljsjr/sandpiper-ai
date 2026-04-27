---
title: "Add root vitest workspace config so per-package configs apply from root"
status: COMPLETE
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: "sandpiper-dev"
reporter: USER
created_at: 2026-08-08T01:16:47.296Z
updated_at: 2026-08-10T17:37:46.142Z
---

# Add root vitest workspace config so per-package configs apply from root

Add a root vitest workspace/projects configuration so per-package vitest configs actually apply when the suite runs from the repo root.

Current state (verified 2026-08-07): there is no root vitest.config.ts or vitest.workspace.ts. Six per-package configs exist - extensions/{shell-relay,web-fetch,web-search}, packages/{core,sandpiper-standup-cli,trail} - and NONE of them apply to `bun run test`, which invokes vitest from the root. They only take effect under `cd <package> && vitest`. This was proven empirically during the 2026-08-06 credential-isolation work with a throwaway assertion test run both ways.

Consequence today: settings that must apply during root runs are hoisted into the root test:vitest script instead of living in the package that needs them. GIT_CONFIG_GLOBAL / GIT_CONFIG_SYSTEM / JJ_CONFIG are there for exactly this reason - trail's tests spawn real git and jj, its own vitest.config.ts cannot deliver the isolation, so the root script carries it for the whole monorepo. packages/trail/vitest.setup.ts exists but only serves package-local runs.

Why this is a sprint rather than a drive-by: adding the root config activates all six dormant configs simultaneously and changes suite-wide test resolution - setup files, environment, includes, timeouts, pools - for packages whose configs have never once run under the root invocation. Expect surprises in whichever packages have drifted furthest. Sequence deliberately: land the config with everything effectively inert, then enable per-package settings one package at a time with a full-suite run between each, rather than flipping all six at once and bisecting the fallout.

Scope notes: decide workspace vs projects form against the pinned vitest version's supported API; migrate the root-script env hoists back into the packages that own them once the config proves out, leaving the root script minimal; keep GIT_CONFIG/JJ_CONFIG isolation working continuously throughout - never regress it mid-migration, since that isolation is what keeps test runs from touching the developer's real VCS credentials. Coordinate with TCL-144 if that lands first: it reduces trail's dependence on real git/jj and therefore some of the pressure that makes this hoisting necessary.

---

# Activity Log

## 2026-08-10T17:37:35.953Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → sandpiper-dev

## 2026-08-10T17:37:46.083Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-08-10T17:37:46.143Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
