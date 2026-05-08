import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { createSandpiperSystemExtension } from './extension-factories.js';

const sandpiperSystemExtension = createSandpiperSystemExtension();

export default function (pi: ExtensionAPI) {
  sandpiperSystemExtension(pi);
}
