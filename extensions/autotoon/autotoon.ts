import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { tryConvertJsonToToon } from './core.js';

export default function autotoon(pi: ExtensionAPI): void {
  pi.on('tool_result', async (event) => {
    // Read results must keep exact file text for edits. Nested calls come from another tool,
    // such as a codemode script, which expects the tool's own output.
    if (event.toolName === 'read' || event.isError || event.parentToolCallId !== undefined) {
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
