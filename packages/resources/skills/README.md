# Skills

Agent skills — structured guidance documents with optional companion scripts that teach the agent how to perform specific tasks.

## Layout

```
skills/
├── sandpiper/           # First-party skills (maintained in this repo)
│   ├── age/             # age encryption CLI usage
│   ├── ast-grep/        # Structural code analysis queries and transforms
│   ├── dash/            # Dash documentation lookup via MCP
│   ├── jj/              # Jujutsu version control
│   ├── projects/        # Cross-project directory management
│   ├── skill-review/    # Skill quality auditing
│   ├── standup/         # Session stand-up notes
│   └── tasks/           # Task management CLI + spec
└── third-party/         # Vendored skills (managed via devtools/vendor.sh)
    ├── pdf/             # PDF reading and manipulation
    └── skill-creator/   # Skill authoring, evals, and benchmarking
```

## First-Party Skills

| Skill | Description |
|-------|-------------|
| `age` | Encrypt/decrypt files with the [age](https://github.com/FiloSottile/age) CLI |
| `ast-grep` | Structural code analysis via AST matching — find patterns, run transforms |
| `dash` | Look up documentation in [Dash.app](https://kapeli.com/dash) via MCP server |
| `jj` | Jujutsu version control — commands, workflows, change management |
| `projects` | Manage the cross-project directory at `~/.sandpiper/agent/projects.toon` |
| `skill-review` | Audit skills for quality, triggering accuracy, and best practices |
| `standup` | Write/read session stand-up notes for cross-session continuity |
| `tasks` | Markdown-based task management with YAML frontmatter |

## Skill Development

Two companion skills support skill authoring and quality control:

- **`skill-creator`** (third-party) — Create new skills, run evals, benchmark performance, iterate on descriptions. Use when building a skill from scratch or optimizing an existing one empirically.
- **`skill-review`** (sandpiper) — Qualitative structural review of existing skills. Check triggering accuracy, document structure, and adherence to best practices without running evals.

For the full skill specification, see:
- [Agent Skills](https://agentskills.io/home) — the standardized skill format
- [Pi Skills Documentation](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/skills.md) — pi's implementation details

## Convention

Each skill is a directory containing:
- `SKILL.md` — the skill definition (name, description, guidance)
- `scripts/` — optional companion scripts (CLIs, helpers)
- `references/` — optional reference docs (specs, cheat sheets)

Skills are auto-discovered by pi from directories listed in the root `package.json` under the `pi.skills` key.

## Vendoring

Third-party skills are listed in `devtools/vendor.txt` and downloaded via `bun run vendor`. They should not be edited directly — changes will be overwritten on the next vendor run.
