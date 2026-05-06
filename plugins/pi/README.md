# Pi Plugin Surface

Provider-owned Pi install surface for Sandpiper.

The root `package.json` routes vanilla Pi package loading here. These adapters expose neutral capabilities and shared resources without Sandpiper identity, startup prompts, migration behavior, or update messaging.

Implementation should stay thin: provider adapters wire Pi APIs to package-owned or compatibility implementation modules.
