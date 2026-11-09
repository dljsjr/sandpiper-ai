export interface SessionEnvInput {
  readonly sessionId: string;
  readonly sessionFile?: string | null;
}

export function setSandpiperSessionEnv(env: NodeJS.ProcessEnv, input: SessionEnvInput): void {
  env.SANDPIPER_SESSION_ID = input.sessionId;
  if (input.sessionFile) {
    env.SANDPIPER_SESSION_FILE = input.sessionFile;
  }
}
