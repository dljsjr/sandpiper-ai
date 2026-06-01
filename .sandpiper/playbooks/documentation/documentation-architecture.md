---
name: Sandpiper Documentation Architecture
read_when: editing docs, README.md, AGENTS.md, .sandpiper/docs, .sandpiper/playbooks, public docs, documentation cleanup, documentation audit, moving docs, archiving docs
---

# Sandpiper Documentation Architecture

Use this playbook before reorganizing or writing documentation in this repository.

## Location Rules

| Location                | Use for                                                                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `docs/`                 | Public Sandpiper project docs that follow Diátaxis: tutorials, how-to guides, reference, and explanation                           |
| `.sandpiper/playbooks/` | Agent-operational repo guidance: conditional workflows and procedures agents should read on demand                                 |
| `.sandpiper/docs/`      | Active internal Diátaxis docs that are not operational guidance: in-flight specs, PRDs, design notes, current implementation plans |
| `.sandpiper/archive/`   | Completed, superseded, stale, or removed-feature documents                                                                         |
| `.sandpiper/notes/`     | Scratch notes and temporary working material                                                                                       |
| `AGENTS.md`             | Always-loaded repo invariants and routing to local playbooks/docs                                                                  |
| `README.md`             | Human-facing entrypoint for the repository or package/directory                                                                    |

All content in `docs/` and `.sandpiper/docs/` must have a clear Diátaxis mode. Pick the location by the doc's primary job, then link to secondary readers where useful.

## Diátaxis

Use the `docs-diataxis` skill and the global librarian `diataxis.md` guidance when creating, editing, or auditing docs.

Do not create empty `tutorials/`, `how-to/`, `reference`, or `explanation` directories just to satisfy the framework. Sandpiper's docs can be structured by feature, package, contributor concern, or documentation status, as long as each page has one clear mode.

`specs/` is an acceptable status/workflow axis for active internal docs. It does not replace Diátaxis: a normative spec is usually reference; design rationale is explanation; implementation or migration steps are how-to guidance.

When a page mixes modes, extract sections:

- Tutorial: guided learning path
- How-to: goal-oriented task directions
- Reference: neutral facts, options, schemas, command syntax
- Explanation: why, background, design rationale, tradeoffs

## Public Docs Voice

Use Pi's docs as the benchmark: direct, natural, task-oriented, and precise.

Avoid:

- Explaining the doc audience taxonomy unless the page is specifically about docs
- Agent-facing policy voice in public docs
- Infantilizing or over-coached explanations
- Meta-commentary about why the documentation exists

Public docs can be useful to agents without sounding like agent instructions.

## Portable Local Guidance

Project-local agent guidance must be self-contained for anyone who clones this repository. Route only within this working directory or to portable external references; do not depend on machine-specific paths, user-specific agent installations, or another local checkout's agent guidance.

Use portable references:

- Relative paths inside this repository: `./AGENTS.md`, `.sandpiper/playbooks/...`, `docs/...`
- Public URLs
- Runtime-discovered package paths such as `$PI_CODING_AGENT_PACKAGE/docs`
- Capability names without hard paths, such as "use the installed `jj` skill if available"

If local guidance needs an external rule, copy or adapt the rule into this repository with portable links.

When mentioning optional capabilities that may exist in a particular agent session, such as YAAMS-backed memory tools, write capability-conditioned guidance. Persistent identity agents may have extra memory/persistence mechanisms; ephemeral and expert agents may not. Project-local guidance in this repo must remain usable without them.

## AGENTS.md and Playbooks

Keep `AGENTS.md` short and complete enough for always-loaded context. Put details in `.sandpiper/playbooks/` when guidance is conditional, procedural, path-specific, or long.

Local playbooks live only at the project root:

```text
.sandpiper/playbooks/<layer>/index.md
.sandpiper/playbooks/<layer>/<topic>.md
```

Do not create nested `.sandpiper` playbook trees under subdirectories.

## Subdirectory AGENTS.md

Subdirectory `AGENTS.md` files should be tiny. They may contain local invariants and route to root `.sandpiper/playbooks/`, but they should not duplicate playbook content.

## Extraction Checklist

When a doc mixes categories, extract sections instead of moving the whole file blindly:

- Public tutorials, how-to guides, reference, and explanation → `docs/`
- Agent workflow rules → `.sandpiper/playbooks/`
- Active internal Diátaxis docs → `.sandpiper/docs/`
- Scratch notes → `.sandpiper/notes/`
- Historical plans/reviews/deep dives → `.sandpiper/archive/`

After moving content, update links, `AGENTS.md`, playbook indexes, and relevant READMEs.
