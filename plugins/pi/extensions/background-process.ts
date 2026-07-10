// Thin Pi provider adapter; source logic lives in extensions/system/neutral-capability-extension.ts.
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { createBackgroundProcessExtension } from '../../../extensions/system/neutral-capability-extension.js';

const backgroundProcessExtension = createBackgroundProcessExtension();

export default function (pi: ExtensionAPI) {
  backgroundProcessExtension(pi);
}
