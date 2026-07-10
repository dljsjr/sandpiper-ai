// Thin Pi provider adapter; source logic lives in extensions/system/neutral-capability-extension.ts.
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { createTurnControlExtension } from '../../../extensions/system/neutral-capability-extension.js';

const turnControlExtension = createTurnControlExtension();

export default function (pi: ExtensionAPI) {
  turnControlExtension(pi);
}
