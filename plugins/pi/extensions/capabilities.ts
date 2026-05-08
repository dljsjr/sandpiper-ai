// Thin Pi provider adapter; source logic lives in extensions/system/neutral-capability-extension.ts.
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { createNeutralCapabilityExtension } from '../../../extensions/system/neutral-capability-extension.js';

const neutralCapabilityExtension = createNeutralCapabilityExtension();

export default function (pi: ExtensionAPI) {
  neutralCapabilityExtension(pi);
}
