import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { registerContextManagementHooks } from '../../../extensions/system/context-management.js';

export default function (pi: ExtensionAPI) {
  registerContextManagementHooks(pi);
}
