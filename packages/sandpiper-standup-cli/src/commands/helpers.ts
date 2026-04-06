import type { Command } from '@commander-js/extra-typings';

export interface RootOptions {
  readonly dir?: string;
}

/**
 * Resolve the global --dir option from the current command context.
 */
export function getRootDir(cmd: Command): string | undefined {
  const opts = cmd.optsWithGlobals() as RootOptions;
  return opts.dir;
}
