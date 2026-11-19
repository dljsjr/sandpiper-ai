// Ends the process with process.exit once the first run settles, skipping session_shutdown, the way
// Pi's emergencyTerminalExit and uncaughtCrash do. Loaded via -e by
// tattler-endpoint-cleanup.integration.test.ts.

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

export default function exitAfterRun(pi: ExtensionAPI): void {
  pi.on('agent_settled', () => {
    setTimeout(() => process.exit(3), 50);
  });
}
