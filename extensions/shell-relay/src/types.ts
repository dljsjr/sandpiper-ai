import type { SessionEntryLike } from './session-lifecycle.js';

export interface RelayUi {
  notify: (msg: string, level?: 'info' | 'warning' | 'error') => void;
  setStatus: (key: string, text: string) => void;
  confirm: (title: string, message: string) => Promise<boolean>;
  select: (message: string, options: readonly string[]) => Promise<string | undefined>;
  input: (prompt: string, defaultValue?: string) => Promise<string | undefined>;
}

export interface RelaySetupContext {
  readonly ui: Pick<RelayUi, 'setStatus'>;
}

export interface RelayCommandContext {
  readonly ui: RelayUi;
}

export interface RelaySessionContext {
  readonly ui: Pick<RelayUi, 'setStatus'>;
  readonly sessionManager: {
    getBranch: () => readonly SessionEntryLike[];
  };
}

export interface RelayStatusDetails {
  readonly shell: 'fish' | 'bash' | 'zsh';
  readonly paneId: string;
  readonly sessionName: string;
  readonly signalPath: string;
}

export interface RelayCommandResult {
  readonly output: string;
  readonly exitCode: number;
  readonly timedOut: boolean;
}

export interface RelayRuntime {
  setup: (ctx: RelaySetupContext, targetZellijSession?: string) => Promise<void>;
  teardown: () => Promise<void>;
  executeQueued: (command: string, timeoutMs: number) => Promise<RelayCommandResult>;
  inspectPane: () => string;
  isSetUp: () => boolean;
  getStatusDetails: () => RelayStatusDetails;
  getCurrentSessionName: () => string | undefined;
  getStoredSessionName: () => string | undefined;
  restoreStoredSessionFromBranch: (branchEntries: readonly SessionEntryLike[]) => void;
  onSessionReady: (ctx: RelaySessionContext) => Promise<void>;
  onSessionSwitch: (ctx: RelaySessionContext) => Promise<void>;
}
