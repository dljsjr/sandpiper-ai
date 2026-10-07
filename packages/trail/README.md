# Legacy Trail package in Sandpiper

This package builds the Trail executable currently bundled with Sandpiper. It still reads `.sandpiper/tasks/` and the legacy Sandpiper configuration files. It is not the standalone Trail repository.

The standalone repository owns current product documentation under `docs/`. Its `initialize` command and version-2 configuration do not apply to this legacy executable.

## Bundled documentation

The [local documentation](docs/README.md) remains with this package to describe its legacy runtime. Sandpiper's integration page is `docs/features/tasks/README.md` in the Sandpiper repository.

The current tasks skill keeps its own local references so that it works without this repository. Sandpiper records the assembly contract in `.sandpiper/docs/specs/trail-skill-assembly.md`. That contract requires matching documentation copies for the eventual standalone consumer.

## Development

From this package directory, the existing build and test commands are:

```sh
bun run build
bun run test
```

Consumer packaging and cutover remain deferred. This documentation change does not rebuild or replace Sandpiper's bundled executable.
