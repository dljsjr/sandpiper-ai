// Thin Pi provider adapter; source logic lives in extensions/system/neutral-capability-extension.ts.
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { createContextManagementExtension } from '../../../extensions/system/neutral-capability-extension.js';

const contextManagementExtension = createContextManagementExtension();

export default function (pi: ExtensionAPI) {
  contextManagementExtension(pi);
}
