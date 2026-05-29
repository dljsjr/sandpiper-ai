# Skills

Agent skills — structured guidance documents with optional companion scripts that teach the agent how to perform specific tasks.

## Layout

```text
skills/
├── sandpiper/           # First-party hot skills (included in runtime catalog)
├── third-party/         # Vendored hot skills (included in runtime catalog)
└── on_demand/           # Shipped skills that are not auto-discovered
    ├── sandpiper/       # First-party on-demand skills
    └── third-party/     # Vendored on-demand skills
```

Hot skills appear in Sandpiper's runtime skill catalogue. On-demand skills are shipped in generated artifacts but are intentionally omitted from `pi.skills` manifests and `resources_discover` skill paths.

## Hot First-Party Skills

| Skill                        | Description                                                      |
| ---------------------------- | ---------------------------------------------------------------- |
| `code-review`                | Review diffs, PRs, code quality, and code health                 |
| `jj`                         | Jujutsu version control — commands, workflows, change management |
| `mutation-testing`           | Mutation testing setup, interpretation, and quality gates        |
| `projects`                   | Manage the cross-project directory                               |
| `refactoring`                | Metrics-guided code cleanup and complexity reduction             |
| `standup`                    | Write/read session stand-up notes for cross-session continuity   |
| `tasks`                      | Markdown-based task management with YAML frontmatter             |
| `test-driven-development`    | TDD/BDD workflow guidance and testing discipline                 |

## On-Demand Skills

These skills are useful enough to distribute, but too niche or too expensive to keep in the hot catalogue by default.

| Skill           | Location                 | Description                                                                  |
| --------------- | ------------------------ | ---------------------------------------------------------------------------- |
| `age`           | `on_demand/sandpiper/`   | Encrypt/decrypt files with the age CLI                                       |
| `ast-grep`      | `on_demand/sandpiper/`   | Structural code search and codemods when AST-aware setup earns its keep      |
| `skill-review`  | `on_demand/sandpiper/`   | Audit skills for quality, triggering accuracy, and best practices            |
| `toon`          | `on_demand/sandpiper/`   | Convert structured data between JSON and TOON                                |
| `pdf`           | `on_demand/third-party/` | PDF reading, extraction, manipulation, form filling, and OCR workflows        |
| `skill-creator` | `on_demand/third-party/` | Skill authoring, evals, benchmarking, and empirical description optimization |

## Using Skills

At runtime, hot skills are listed in the agent's available-skills catalogue. The catalogue is routing metadata, not the full instructions.

When a hot skill matches the user's request, acquired context, or the action the agent is about to take, the agent should load the skill before continuing. In Sandpiper, use the `skill` tool with the exact catalogue name. In a harness without a skill-loading tool, read the matching `SKILL.md` from the catalogue location instead.

On-demand skills are not advertised in the runtime catalogue. They remain filesystem-loadable from the distribution tree for explicit, intentional use.

## Convention

Each skill is a directory containing:

- `SKILL.md` — the skill definition (name, description, guidance)
- `scripts/` — optional companion scripts (CLIs, helpers)
- `references/` — optional reference docs (specs, cheat sheets)

Hot skills are auto-discovered by pi from directories listed in the root `package.json` under the `pi.skills` key and from Sandpiper resource discovery. On-demand skills are copied by distribution assembly but omitted from those manifests.

## Vendoring

Third-party skills are listed in `vendor.txt` and downloaded via `bun run vendor`. They should not be edited directly — changes will be overwritten on the next vendor run.
