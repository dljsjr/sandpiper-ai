import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { tryConvertJsonToToon } from '../../packages/capability-autotoon/src/core.js';

export default function autotoon(pi: ExtensionAPI): void {
  pi.on('tool_result', async (event) => {
    // Nested calls come from another tool, such as a codemode script, which expects the tool's
    // own output; only the result the model reads gets converted.
    if (event.isError || event.parentToolCallId !== undefined) {
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

    // Replacing content alone would drop the structured result Pi hands to scripts.
    return { content: newContent, structuredContent: event.structuredContent };
  });
}
