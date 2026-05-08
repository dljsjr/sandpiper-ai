import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { tryConvertJsonToToon } from './core.js';

export { MAX_JSON_BYTES, MIN_JSON_BYTES, TOON_HEADER, tryConvertJsonToToon } from './core.js';

export default function autotoon(pi: ExtensionAPI): void {
  pi.on('tool_result', async (event) => {
    if (event.isError) {
      return;
    }

    let modified = false;
    const newContent = event.content.map((block) => {
      if (block.type !== 'text') {
        return block;
      }

      const converted = tryConvertJsonToToon(block.text);
      if (converted === null) {
        return block;
      }

      modified = true;
      return { ...block, text: converted };
    });

    if (!modified) {
      return;
    }

    return { content: newContent };
  });
}
