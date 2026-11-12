import { resolve } from 'node:path';

export interface PromptEditorOptions {
  /** The arguments for each diagnostic render: the command line without `--edit`, editor flags, or `--json`. */
  readonly diagnosticArgs: readonly string[];
  /** `--prompt-source` paths, resolved against the working directory. */
  readonly promptSources: readonly string[];
  readonly title: string;
  readonly subtitle?: string;
}

const DEFAULT_TITLE = 'Sandpiper';

/** Separates the editor's own flags from the Sandpiper options that select the prompt. */
export function parsePromptEditorOptions(args: readonly string[], cwd: string): PromptEditorOptions {
  const diagnosticArgs: string[] = [];
  const promptSources: string[] = [];
  let title = DEFAULT_TITLE;
  let subtitle: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? '';
    if (arg === '--edit' || arg === '--json') continue;
    if (arg !== '--prompt-source' && arg !== '--edit-title' && arg !== '--edit-subtitle') {
      diagnosticArgs.push(arg);
      continue;
    }
    const value = args[index + 1];
    if (value === undefined) throw new Error(`${arg} requires a value`);
    index += 1;
    if (arg === '--prompt-source') promptSources.push(resolve(cwd, value));
    else if (arg === '--edit-title') title = value;
    else subtitle = value;
  }

  return { diagnosticArgs, promptSources, title, ...(subtitle === undefined ? {} : { subtitle }) };
}
