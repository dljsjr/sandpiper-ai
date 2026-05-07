# Content Review Notes - AGENTS.md Routing Sweep

**Date**: 2026-04-16  
**Scope**: All docs referenced in AGENTS.md routing table + existing Sandpiper docs  
**Goal**: Deduplication, accuracy check, incorporation into Pi dev guide

---

## Summary

### ✅ Quality Content Incorporated

The following high-quality content from existing Sandpiper docs has been incorporated into the Pi dev guide:

1. **Capability Guidance Registry Pattern** → `PI-DEV-SANDPIPER-PATTERNS.md`
   - From: `.sandpiper/docs/autotoon-extension.md`
   - Static/dynamic guidance injection via `pi.events`
   - Prompt assembly order for prefix caching

2. **TUI Component Patterns** → `PI-DEV-UI.md` (already comprehensive)
   - From: `.sandpiper/docs/tui-extension-patterns.md`
   - Three ways to show content (notify, setWidget, messageRenderer)
   - Component lifecycle, caching, invalidation
   - Direct chat container injection pattern

3. **Build System Details** → Already covered in Pi docs, but added Sandpiper specifics to `PI-DEV-SANDPIPER-PATTERNS.md`
   - From: `.sandpiper/docs/build-system.md`
   - Source-loaded extensions via jiti
   - Postinstall workflow

4. **Extension Loading Details** → Already covered in `PI-DEV-ARCHITECTURE.md`
   - From: `.sandpiper/docs/extension-loading.md`
   - Jiti module resolution
   - `/reload` limitations

5. **Pi API Pitfalls** → Already covered in `PI-DEV-PATTERNS.md`
   - From: `.sandpiper/docs/pi-api-pitfalls.md`
   - `getFlag()` bare names
   - Module-level state boundaries
   - `instanceof` across jiti

6. **Env Var Mirroring** → `PI-DEV-SANDPIPER-PATTERNS.md`
   - From: `.sandpiper/docs/env-vars.md`
   - `resolveEnvVar()` usage
   - Exempt variables

7. **CLI Development Patterns** → Already covered in `PI-DEV-SDK.md` + `PI-DEV-PATTERNS.md`
   - From: `.sandpiper/docs/cli-development.md`
   - Separation of concerns (CLI layer vs core logic)

8. **Task Storage Strategy** → `PI-DEV-SANDPIPER-PATTERNS.md`
   - From: `.sandpiper/docs/task-storage-strategy.md`, `task-storage-implementation-plan.md`, `packages/sandpiper-tasks-cli/STORAGE.md`
   - Storage modes (inline, separate branch, external repo)
   - Backend selection (jj workspace vs git worktree)

9. **Concurrent Sessions** → `PI-DEV-SANDPIPER-PATTERNS.md`
   - From: `.sandpiper/docs/concurrent-sessions.md`
   - PID-based liveness detection
   - Standup file format

---

## ⚠️ Potentially Stale/Incorrect Content

### 1. `agent-guidance-evolution.md`

**Status**: ⚠️ **PARTIALLY STALE** - Contains deferred work that may no longer be relevant

**Issues**:
- References "Axis 2 — Deferred Deterministic Guidance" which was never implemented
- Mentions `session_directory` event as "removed in Pi 0.65.0" - should verify against current Pi version
- References specific task numbers (AGENT-34, AGENT-35) that may be closed
- Contains extensive "future work" section that was never actioned

**Recommendation**: 
- Archive to `.sandpiper/archive/` or update with current status
- Remove deferred Axis 2 content if no longer pursuing
- Update Pi version references to current version (0.67.3)

**Quality content to preserve**:
- Prompt architecture layers table (root AGENTS.md vs focused docs vs module-local)
- Leaf doc shape pattern
- Cold-start scenario testing list

---

### 2. `pi-api-pitfalls.md`

**Status**: ⚠️ **NEEDS VERIFICATION** - Some claims need verification against Pi 0.67.3

**Issues**:
- Claims `getFlag("--my-flag")` is wrong, but Pi docs may have been updated
- References `session_directory` as removed - verify current event names
- Cross-package TypeScript guidance may be outdated

**Recommendation**:
- Verify all claims against Pi 0.67.3 source
- Most content already incorporated into `PI-DEV-PATTERNS.md`
- Can likely be archived after verification

---

### 3. `tui-extension-patterns.md`

**Status**: ✅ **MOSTLY SUPERSEDED** - Content incorporated into `PI-DEV-UI.md`

**Issues**:
- Now redundant with `PI-DEV-UI.md` which is more comprehensive
- Some Sandpiper-specific patterns (capability guidance) not appropriate here

**Recommendation**:
- Archive to `.sandpiper/archive/` with note pointing to `PI-DEV-UI.md`
- Or keep as Sandpiper-specific supplement if there are unique patterns

**Quality content preserved**:
- Three ways to show content (notify, setWidget, messageRenderer) - in `PI-DEV-UI.md`
- Direct chat container injection - in `PI-DEV-UI.md`
- Event listener accumulation warning - in `PI-DEV-PATTERNS.md`

---

### 4. `autotoon-extension.md`

**Status**: ✅ **ARCHITECTURE DOC** - Appropriate as-is

**Issues**: None - this is implementation-specific documentation

**Recommendation**: Keep as-is, it's not general guidance

**Quality content incorporated**:
- Capability guidance registry pattern - in `PI-DEV-SANDPIPER-PATTERNS.md`
- Prompt assembly order - in `PI-DEV-SANDPIPER-PATTERNS.md`

---

### 5. `concurrent-sessions.md`

**Status**: ✅ **IMPLEMENTATION DOC** - Appropriate as-is

**Issues**: None - this is implementation-specific documentation

**Recommendation**: Keep as-is

**Quality content incorporated**:
- PID-based liveness detection - in `PI-DEV-SANDPIPER-PATTERNS.md`
- Architecture diagram - in `PI-DEV-SANDPIPER-PATTERNS.md`

---

### 6. `task-storage-strategy.md` + `task-storage-implementation-plan.md`

**Status**: ✅ **DESIGN + IMPLEMENTATION DOCS** - Appropriate as-is

**Issues**: None - these are project-specific design docs

**Recommendation**: Keep as-is, already referenced in AGENTS.md routing

**Quality content incorporated**:
- Storage modes summary - in `PI-DEV-SANDPIPER-PATTERNS.md`
- Configuration reference - in `PI-DEV-SANDPIPER-PATTERNS.md`

---

### 7. `build-system.md`

**Status**: ⚠️ **NEEDS MINOR UPDATES**

**Issues**:
- References TOOLS-10 which may be closed
- Could be more explicit about which packages need builds

**Recommendation**:
- Update task references
- Otherwise keep as-is, already incorporated into `PI-DEV-SANDPIPER-PATTERNS.md`

**Quality content incorporated**:
- Build pipeline stages - in `PI-DEV-SANDPIPER-PATTERNS.md`
- Postinstall workflow - in `PI-DEV-SANDPIPER-PATTERNS.md`

---

### 8. `extension-loading.md`

**Status**: ⚠️ **NEEDS VERIFICATION**

**Issues**:
- Jiti alias list may be outdated
- "New Module Gotcha" section needs verification against current Pi

**Recommendation**:
- Verify jiti aliases against Pi 0.67.3
- Most content already in `PI-DEV-ARCHITECTURE.md`
- Can likely be archived after verification

**Quality content incorporated**:
- Source-loading model - in `PI-DEV-ARCHITECTURE.md`
- Module scope boundaries - in `PI-DEV-PATTERNS.md`

---

### 9. `env-vars.md`

**Status**: ✅ **SUPERSEDED** - Content incorporated

**Issues**: Now redundant with `PI-DEV-SANDPIPER-PATTERNS.md`

**Recommendation**:
- Archive with note pointing to `PI-DEV-SANDPIPER-PATTERNS.md`

**Quality content incorporated**:
- `resolveEnvVar()` usage - in `PI-DEV-SANDPIPER-PATTERNS.md`
- Exempt variables table - in `PI-DEV-SANDPIPER-PATTERNS.md`

---

### 10. `cli-development.md`

**Status**: ✅ **SUPERSEDED** - Content incorporated

**Issues**: Now redundant with `PI-DEV-SDK.md` + `PI-DEV-PATTERNS.md`

**Recommendation**:
- Archive with note pointing to Pi dev guide

**Quality content incorporated**:
- Separation of concerns - in `PI-DEV-PATTERNS.md`
- Testing strategy - in `PI-DEV-PATTERNS.md`

---

## 📋 Deduplication Actions

### Immediate Actions

1. **Update AGENTS.md routing table** to point to Pi dev guide where appropriate:
   - `tui-extension-patterns.md` → `PI-DEV-UI.md`
   - `pi-api-pitfalls.md` → `PI-DEV-PATTERNS.md`
   - `env-vars.md` → `PI-DEV-SANDPIPER-PATTERNS.md`
   - `cli-development.md` → `PI-DEV-PATTERNS.md` + `PI-DEV-SDK.md`

2. **Archive superseded docs** to `.sandpiper/archive/`:
   - `tui-extension-patterns.md` (superseded by `PI-DEV-UI.md`)
   - `env-vars.md` (superseded by `PI-DEV-SANDPIPER-PATTERNS.md`)
   - `cli-development.md` (superseded by `PI-DEV-PATTERNS.md`)
   - `pi-api-pitfalls.md` (after verification, superseded by `PI-DEV-PATTERNS.md`)
   - `extension-loading.md` (after verification, mostly in `PI-DEV-ARCHITECTURE.md`)

3. **Update stale references**:
   - `agent-guidance-evolution.md` - remove deferred Axis 2 or update status
   - Task number references (AGENT-34, AGENT-35, TOOLS-10, etc.)

4. **Add Pi dev guide to AGENTS.md routing**:
   ```markdown
   | Pi extension development | `.sandpiper/docs/pi-dev-suite/PI-DEV-ROUTING.md` | Building Pi extensions, custom tools, TUI components, or using the SDK |
   ```

### Future Actions

1. **Verify Pi 0.67.3 compatibility** for all docs that reference Pi internals
2. **Complete cold-start scenario testing** from `agent-guidance-evolution.md`
3. **Consider implementing deterministic enforcement** from Axis 2 if still desired
4. **Update all version references** to current Pi version

---

## 📚 New Documentation Created

### Pi Developer Documentation Suite (`.sandpiper/docs/pi-dev-suite/`)

| Document | Size | Purpose |
|----------|------|---------|
| `PI-DEV-ROUTING.md` | 22KB | Task-oriented routing table |
| `PI-DEV-QUICKSTART.md` | 18KB | First extension tutorial |
| `PI-DEV-ARCHITECTURE.md` | 18KB | Core architecture, loading, events |
| `PI-DEV-EVENTS.md` | 22KB | Complete event reference (25+ events) |
| `PI-DEV-TOOLS.md` | 14KB | Custom tools, rendering, truncation |
| `PI-DEV-UI.md` | 15KB | TUI components, overlays, dialogs |
| `PI-DEV-STATE.md` | 8.4KB | State persistence, branching |
| `PI-DEV-PROVIDERS.md` | 12KB | Custom providers, OAuth, streaming |
| `PI-DEV-SDK.md` | 12KB | Programmatic usage, AgentSession |
| `PI-DEV-PATTERNS.md` | 14KB | Best practices, anti-patterns |
| `PI-DEV-SECURITY.md` | 12KB | Safety, validation, sandboxing |
| `PI-DEV-ADVANCED.md` | 19KB | Subagents, games, SSH, advanced TUI |
| `PI-DEV-SANDPIPER-PATTERNS.md` | NEW | Sandpiper-specific patterns |
| `README.md` | 3.1KB | Suite index |

**Total**: ~200KB of comprehensive, deduplicated documentation

---

## ✅ Verification Checklist

Before archiving any docs, verify:

- [ ] All content has been incorporated into Pi dev guide
- [ ] Pi 0.67.3 compatibility verified for technical claims
- [ ] Task number references updated or removed
- [ ] Cross-references updated to point to new docs
- [ ] AGENTS.md routing table updated
- [ ] No broken links in remaining docs

---

## 🎯 Next Steps

1. **Review this document** with the user
2. **Get approval** for archiving superseded docs
3. **Update AGENTS.md** routing table
4. **Move archived docs** to `.sandpiper/archive/`
5. **Update cross-references** in remaining docs
6. **Verify Pi 0.67.3 compatibility** for flagged docs

