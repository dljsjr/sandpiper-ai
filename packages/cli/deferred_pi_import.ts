// Load Pi only after sandpiper_standalone.ts configures Sandpiper package metadata.
// This is a load-order shim for the Sandpiper app bundle, not a Pi distribution artifact.
export { main } from '@earendil-works/pi-coding-agent';
