# Skills

Sandpiper currently bundles no skills. The runtime can load project-local skills and skills from separately installed packages.

## Resource location

Both source and built runtimes use the optional `<productRoot>/packages/resources/` directory through `resources_discover`. No resource staging step runs, and the packed product omits this tree. A child directory under `skills/` with a `SKILL.md` file appears in the available-skills catalogue.

Use configured project, user, or package skills for separately managed resources.

## Skill contents

A separately managed skill directory can contain:

- `SKILL.md`, which defines the skill and its trigger description.
- `references/`, which contains supporting reference material.
- `scripts/`, which contains helper commands.
- `evals/`, which contains skill evaluation data.

Journal is a separate optional Pi package. Install it separately to expose its skill. Sandpiper does not bundle its CLI or skill.
