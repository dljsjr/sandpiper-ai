import { getAgentDir } from '@earendil-works/pi-coding-agent';
import { getSandpiperUserProfilePath } from '../../core/src/user-profile.js';
import { runPromptDiagnostic } from './diagnostic.js';
import { loadGlimpse, openGlimpseWindow } from './glimpse.js';
import { parsePromptEditorOptions } from './options.js';
import { promptEditorPage } from './page_assets.js' with { type: 'macro' };
import { openSourceWithSystem, runEditorSession } from './session.js';
import { PromptEditorState } from './state.js';

export interface PromptEditorCommand {
  /** The command line, including `--edit` and the editor flags. */
  readonly args: readonly string[];
  readonly cwd: string;
  /** The diagnostic entry script, run again without `--edit` for each render. */
  readonly entry: string;
}

/** `sandpiper-system-prompt --edit`: opens the rendered prompt in an editor window until the window closes. */
export async function runPromptEditor(command: PromptEditorCommand): Promise<void> {
  const options = parsePromptEditorOptions(command.args, command.cwd);
  const glimpse = await loadGlimpse(process.env);
  const state = await PromptEditorState.create({
    render: () =>
      runPromptDiagnostic({
        program: process.execPath,
        args: [...process.execArgv, command.entry, '--json', ...options.diagnosticArgs],
        cwd: command.cwd,
        env: process.env,
      }),
    catalog: {
      promptSources: options.promptSources,
      escapedPromptSources: options.escapedPromptSources,
      userProfile: getSandpiperUserProfilePath(getAgentDir()),
    },
    identity: { key: options.title.toLowerCase(), name: options.title, job: options.subtitle ?? options.title },
  });
  const window = openGlimpseWindow(glimpse, promptEditorPage(), {
    width: 1280,
    height: 900,
    title: `${options.title} · System Prompt Editor`,
  });
  await runEditorSession(window, state, { openSource: openSourceWithSystem, watchIntervalMs: 1000 });
}
