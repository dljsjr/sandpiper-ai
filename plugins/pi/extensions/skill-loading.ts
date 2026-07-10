// Thin Pi provider adapter; source logic lives in extensions/system/neutral-capability-extension.ts.
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { createSkillLoadingExtension } from '../../../extensions/system/neutral-capability-extension.js';

const skillLoadingExtension = createSkillLoadingExtension();

export default function (pi: ExtensionAPI) {
  skillLoadingExtension(pi);
}
