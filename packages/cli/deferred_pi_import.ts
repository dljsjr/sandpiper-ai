// Load Pi only after sandpiper_standalone.ts configures Sandpiper package metadata.
// This is a load-order shim for the Sandpiper app bundle, not a Pi distribution artifact.
// Keep the import dynamic: the Sandpiper CLI bundle externalizes Pi packages so
// Pi must not be imported until PI_PACKAGE_DIR/PI_CODING_AGENT_PACKAGE are set.
export type PiMain = typeof import('@earendil-works/pi-coding-agent')['main'];

export async function loadPiMain(): Promise<PiMain> {
  const { main } = await import('@earendil-works/pi-coding-agent');
  return main;
}
