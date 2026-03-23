/**
 * Strip terminal query/response sequences from captured output.
 *
 * Programs running in a PTY (via unbuffer-relay) may emit OSC and CSI
 * sequences to query the terminal (foreground/background color, device
 * attributes, etc.). Since the PTY can't respond, these raw sequences
 * leak into captured stdout. This function removes them.
 *
 * This module is framework-independent — no pi/sandpiper imports.
 */

/**
 * Remove terminal query/response sequences that leak through PTY capture.
 *
 * Strips:
 * - OSC sequences: ESC ] ... (ST | BEL)  (e.g., color queries ^[]10;?^G)
 * - Device attributes responses: ESC [ ? ... c
 * - Erase sequences: ESC [ ... K (erase to end of line)
 */
// ESC and BEL as strings for building RegExp without literal control chars in regex
const ESC = '\x1b';
const BEL = '\x07';

// OSC sequences: ESC ] ... terminated by ST (ESC \), BEL, or next ESC
const OSC_RE = new RegExp(`${ESC}\\][^${BEL}${ESC}]*(?:${BEL}|${ESC}\\\\)?`, 'g');
// Device attributes response: ESC [ ? ... c
const DA_RE = new RegExp(`${ESC}\\[\\?[0-9;]*c`, 'g');
// Erase to end of line: ESC [ K or ESC [ 0K, 1K, 2K
const EL_RE = new RegExp(`${ESC}\\[[0-2]?K`, 'g');

export function stripTerminalQueries(output: string): string {
  return output.replace(OSC_RE, '').replace(DA_RE, '').replace(EL_RE, '');
}
