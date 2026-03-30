export function getChatContainer(tui: { children: unknown[] }): { addChild: (c: unknown) => void } | undefined {
  const candidate = tui.children[1];
  if (
    candidate &&
    typeof candidate === 'object' &&
    'addChild' in candidate &&
    typeof (candidate as Record<string, unknown>).addChild === 'function'
  ) {
    return candidate as { addChild: (c: unknown) => void };
  }
  return undefined;
}
