import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import { createNeutralCapabilityExtension } from './system/extension-factories.js';

const neutralCapabilityExtension = createNeutralCapabilityExtension();

export default function (pi: ExtensionAPI) {
  neutralCapabilityExtension(pi);
}
