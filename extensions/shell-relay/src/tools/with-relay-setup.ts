import type { RelayRuntime, RelaySetupContext } from '../types.js';

interface TextContent {
  type: 'text';
  text: string;
}

export interface ToolExecuteResult {
  content: TextContent[];
  details: Record<string, unknown>;
  isError?: boolean;
}

export async function withRelaySetup(
  runtime: RelayRuntime,
  ctx: RelaySetupContext,
  session: string | undefined,
  setupFailureMessage: (msg: string) => string,
  onSuccess: () => Promise<ToolExecuteResult>,
): Promise<ToolExecuteResult> {
  try {
    await runtime.setup(ctx, session);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: setupFailureMessage(msg) }],
      details: { error: msg },
      isError: true,
    };
  }

  return onSuccess();
}
