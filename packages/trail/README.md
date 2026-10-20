# Legacy Trail package in Sandpiper

This package builds the Trail executable currently bundled with Sandpiper. It still reads `.sandpiper/tasks/` and the legacy Sandpiper configuration files. It is not the standalone Trail repository.

The standalone repository owns current product documentation under `docs/`. Its `initialize` command and version-2 configuration do not apply to this legacy executable.

## Bundled documentation

The [local documentation](docs/README.md) remains with this package to describe its legacy runtime. Sandpiper's integration page is `docs/features/tasks/README.md` in the Sandpiper repository.

The current tasks skill keeps local references that describe this executable. `bun run build` builds `packages/trail/dist/trail` and refreshes the skill's executable copy.

## Development

From this package directory, the existing build and test commands are:

```sh
bun run build
bun run test
```

The root build copies the result to `packages/resources/skills/tasks/scripts/trail` for local skill use.
