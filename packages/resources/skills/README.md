# Skills

This directory contains the first-party skills that Sandpiper discovers at runtime.

## Layout

Each skill is a direct child of this directory:

```text
skills/
├── code-review/
├── jj/
├── mutation-testing/
├── projects/
├── refactoring/
└── test-driven-development/
```

Sandpiper does not include third-party or on-demand skills in this package.

## Catalogue

| Skill | Description |
| --- | --- |
| `code-review` | Review diffs, pull requests, and code health |
| `jj` | Use Jujutsu version control |
| `mutation-testing` | Set up and interpret mutation testing |
| `projects` | Manage the cross-project directory |
| `refactoring` | Improve code structure with measured changes |
| `test-driven-development` | Apply test-driven and behavior-driven development |

The source runtime adds this directory through `resources_discover`. The built runtime uses its copy under `packages/cli/dist/standalone/resources/skills/`. Each child that contains a `SKILL.md` file appears in the available-skills catalogue.

Run `bun run build:standalone` after changing these files to refresh the built runtime.

## Skill contents

A skill directory can contain:

- `SKILL.md`, which defines the skill and its trigger description.
- `references/`, which contains supporting reference material.
- `scripts/`, which contains helper commands.
- `evals/`, which contains skill evaluation data.

Journal is a separate optional Pi package. Install it separately to expose its skill. Sandpiper does not bundle its CLI or skill.
