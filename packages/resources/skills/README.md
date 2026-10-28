# Skills

Sandpiper currently bundles no skills. The runtime can load project-local skills and skills from separately installed packages.

## Resource location

The source runtime uses this directory through `resources_discover`. Built-in skill resources, when present, are staged under `packages/cli/dist/standalone/resources/skills/`. A child directory with a `SKILL.md` file appears in the available-skills catalogue.

Run `bun run build:standalone` after changing resource files to refresh the built runtime.

## Skill contents

A separately managed skill directory can contain:

- `SKILL.md`, which defines the skill and its trigger description.
- `references/`, which contains supporting reference material.
- `scripts/`, which contains helper commands.
- `evals/`, which contains skill evaluation data.

Journal is a separate optional Pi package. Install it separately to expose its skill. Sandpiper does not bundle its CLI or skill.
