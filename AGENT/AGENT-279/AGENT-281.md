---
title: "Decode YAAMS CLI responses at the transport boundary and migrate the read paths"
status: COMPLETE
resolution: WONTFIX
kind: SUBTASK
priority: HIGH
assignee: "Doug"
reporter: USER
created_at: 2026-08-12T02:10:06.573Z
updated_at: 2026-08-12T21:47:55.884Z
depends_on:
  - AGENT-280
---

# Decode YAAMS CLI responses at the transport boundary and migrate the read paths

Make `runYaamsCli` decode from `unknown` instead of handing back `as`-cast JSON, and move every read path onto explicit decoders.

Today the parser parameter is typed `YaamsJsonParser<YaamsDatom>` but defaults to raw `JSON.parse` — that is the type error at yaams.ts:150, and it means the type on every read is a claim nobody checks. `yaamsFactJsonReviver` no longer exists; three files still import it, which is what fails index.test.ts at import time.

Scope: give runYaamsCli a decoder per call site; decode structured JSON failures off stderr while preserving the agent-facing message verbatim (ADR-0005); migrate retrieve_memory (by id, by EAV, by entity), search_memories, getLiveFacts if it survives, and the bootstrap `list`. Remove yaamsFactJsonReviver and the unchecked result casts.

Out of scope (resolved 2026-08-12): the transport does NOT need stdin. Pi's `pi.exec` hard-wires stdio[0] to "ignore" and cannot carry a payload, but rather than reimplement exec in the adapter — and inherit ownership of Pi's stdio-drain fix (pi#5303), abort/timeout escalation, and cross-spawn — the envelope arrives via `--ops` on argv. See YAAMS-93. CliRunner and pi.exec stay exactly as they are.

Done when: the fake CLI emits real YAAMS wire shapes rather than hand-shaped objects, reader and bootstrap tests pass, and a malformed success or error payload fails at the boundary with a diagnostic that names the field.


---

**MOVED — not abandoned.** Rewritten by hand as **PIEXT-38** in `~/git/yaams` (2026-08-12). pi-yaams work belongs to the PIEXT project, whose charter is exactly this; AGENT covers capabilities not specific to a single tool or extension. pi-yaams is developed out-of-tree today but moves in-tree with yaams, which is why the board lives there. Trail has no cross-repo move, so this closes WONTFIX rather than leaving a tombstone. All content and work state carried over verbatim.

---

# Activity Log

## 2026-08-12T02:10:19.812Z

- **assignee**: UNASSIGNED → Doug

## 2026-08-12T16:28:45.536Z

- **title**: Make runYaamsCli typed, stdin-capable, and migrate read paths → Decode YAAMS CLI responses at the transport boundary and migrate the read paths
- **description**: 5 lines → updated (9 lines)

## 2026-08-12T21:47:55.824Z

- **description**: 9 lines → updated (14 lines)

## 2026-08-12T21:47:55.885Z

- **status**: NOT STARTED → COMPLETE
- **resolution**: WONTFIX
