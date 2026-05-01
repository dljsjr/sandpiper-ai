import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import { createNeutralCapabilityExtension } from './system/neutral-capability-extension.js';

const neutralCapabilityExtension = createNeutralCapabilityExtension();

export default function (pi: ExtensionAPI) {
  neutralCapabilityExtension(pi);
}
