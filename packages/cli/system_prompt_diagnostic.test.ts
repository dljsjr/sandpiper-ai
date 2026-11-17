import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { EditableSpan } from '../core/src/prompt-template.js';
import { findPackageRoot } from './standalone_bootstrap.js';

const repoRoot = findPackageRoot(dirname(fileURLToPath(import.meta.url)), 'sandpiper-ai-cli');
const bunExecutable = process.env.BUN_EXECUTABLE ?? 'bun';

function diagnosticEnv(agentDir: string): NodeJS.ProcessEnv {
  const testRoot = dirname(agentDir);
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(PI|SANDPIPER)_/.test(key)));
  return {
    ...env,
    HOME: join(testRoot, 'home'),
    XDG_CONFIG_HOME: join(testRoot, 'config'),
    XDG_STATE_HOME: join(testRoot, 'state'),
    XDG_CACHE_HOME: join(testRoot, 'cache'),
    XDG_RUNTIME_DIR: join(testRoot, 'runtime'),
    BUN_INSTALL: join(testRoot, 'bun'),
    BUN_INSTALL_CACHE_DIR: join(testRoot, 'bun-cache'),
    JITI_FS_CACHE: 'false',
    PI_OFFLINE: '1',
    PI_CODING_AGENT_DIR: agentDir,
    SANDPIPER_CODING_AGENT_DIR: agentDir,
    PI_CODING_AGENT_SESSION_DIR: join(agentDir, 'sessions'),
    SANDPIPER_CODING_AGENT_SESSION_DIR: join(agentDir, 'sessions'),
    AGENT_JOURNAL_DIR: join(testRoot, 'journal'),
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
    JJ_CONFIG: join(repoRoot, 'devtools', 'test-fixtures', 'jj-test-config.toml'),
  };
}

describe('system prompt diagnostic', () => {
  it('renders the complete prompt without resolving configured credentials or making a provider request', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'sandpiper-system-prompt-'));
    const agentDir = join(tempDir, 'agent');
    const credentialProbe = join(tempDir, 'credential-read');
    const providerProbe = join(tempDir, 'provider-probe.ts');
    mkdirSync(agentDir, { recursive: true });
    mkdirSync(join(tempDir, 'home'), { recursive: true });
    const credentialCommand = [
      JSON.stringify(process.execPath),
      '-e',
      JSON.stringify(`require('node:fs').writeFileSync(${JSON.stringify(credentialProbe)}, 'credential resolved')`),
    ].join(' ');
    writeFileSync(
      join(agentDir, 'auth.json'),
      `${JSON.stringify({ anthropic: { type: 'api_key', key: `!${credentialCommand}` } }, null, 2)}\n`,
    );
    writeFileSync(
      join(agentDir, 'models.json'),
      `${JSON.stringify({ providers: { anthropic: { apiKey: `!${credentialCommand}` } } }, null, 2)}\n`,
    );
    writeFileSync(
      join(agentDir, 'settings.json'),
      `${JSON.stringify({ 'web-search': { braveApiKey: `!${credentialCommand}` } }, null, 2)}\n`,
    );
    writeFileSync(
      providerProbe,
      `export default function providerProbe(pi) {
  pi.on('before_provider_request', () => process.exit(97));
  pi.on('before_agent_start', (event) => {
    event.systemPromptOptions.sections.diagnostic_probe = 'extension section text';
  });
  // Terminal notification extensions write escapes like this one when a turn ends.
  pi.on('agent_end', () => {
    process.stdout.write('\\x1b]777;notify;probe;\\x07');
  });
}
`,
    );

    try {
      const run = spawnSync(
        bunExecutable,
        [
          'run',
          '--bun',
          './packages/cli/sandpiper_system_prompt.ts',
          '--approve',
          '--extension',
          providerProbe,
          '--identity',
          '<identity>diagnostic identity</identity>',
          '--append-system-prompt',
          '<birdup>diagnostic append</birdup>',
        ],
        {
          cwd: repoRoot,
          encoding: 'utf-8',
          env: diagnosticEnv(agentDir),
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 30_000,
        },
      );
      const output = run.stdout;

      expect(run.status).toBe(0);
      expect(run.stderr).not.toContain(']777;notify');
      expect(output.startsWith('<system_prompt>')).toBe(true);
      expect(output).toContain('<identity>diagnostic identity</identity>');
      expect(output).toContain(`</system_prompt>\n\n`);
      expect(output).toContain(`<cwd>\n${repoRoot}\n</cwd>`);
      expect(output).toContain('<diagnostic_probe>\nextension section text\n</diagnostic_probe>');
      expect(output).toContain('<birdup>diagnostic append</birdup>');
      expect(output).toContain('<tools>\n- read:');
      expect(output).toContain('\n- tool_search: ');
      expect(output).toContain('<deferred_tools>\n');
      expect(output).toContain('\n  - web_fetch: ');
      expect(output).toContain('<available_skills>');
      expect(output).not.toContain('<skill name="jj"');
      expect(output).not.toContain('<skill name="mutation-testing"');
      expect(output).not.toContain('<skill name="test-driven-development"');
      expect(output).not.toContain('<skill name="refactoring"');
      expect(output).not.toContain('<skill name="code-review"');
      expect(output).not.toContain('<skill name="tasks"');
      expect(existsSync(credentialProbe)).toBe(false);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }, 30_000);

  it('reports file-backed prompt sources as JSON', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'sandpiper-system-prompt-sources-'));
    const agentDir = join(tempDir, 'agent');
    const contextFile = join(agentDir, 'AGENTS.md');
    const identityFile = join(tempDir, 'identity.md');
    const systemPromptFile = join(tempDir, 'system.md');
    const appendFile = join(tempDir, 'append.md');
    mkdirSync(agentDir, { recursive: true });
    mkdirSync(join(tempDir, 'home'), { recursive: true });
    writeFileSync(contextFile, '# Diagnostic context\n');
    writeFileSync(identityFile, '<identity>from file</identity>\n');
    writeFileSync(systemPromptFile, '<diagnostic_base>from file</diagnostic_base>\n');
    writeFileSync(appendFile, '<diagnostic_append>from file</diagnostic_append>\n');

    try {
      const output = execFileSync(
        bunExecutable,
        [
          'run',
          '--bun',
          './packages/cli/sandpiper_system_prompt.ts',
          '--json',
          '--approve',
          '--identity',
          identityFile,
          '--system-prompt',
          systemPromptFile,
          '--append-system-prompt',
          appendFile,
          '--append-system-prompt',
          '<diagnostic_append>raw text</diagnostic_append>',
        ],
        {
          cwd: repoRoot,
          encoding: 'utf-8',
          env: diagnosticEnv(agentDir),
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 30_000,
        },
      );
      const result = JSON.parse(output) as {
        prompt: string;
        sources: {
          identity?: string;
          systemPrompt?: string;
          appendSystemPrompts: string[];
          contextFiles: string[];
        };
        editableSpans: EditableSpan[];
      };

      expect(result.prompt).toContain('<diagnostic_base>from file</diagnostic_base>');
      expect(result.prompt).toContain('<diagnostic_append>from file</diagnostic_append>');
      expect(result.prompt).toContain('<diagnostic_append>raw text</diagnostic_append>');
      expect(result.sources.identity).toBe(identityFile);
      expect(result.sources.systemPrompt).toBe(systemPromptFile);
      expect(result.sources.appendSystemPrompts).toEqual([appendFile]);
      expect(result.sources.contextFiles).toContain(contextFile);
      // A custom system prompt replaces Sandpiper's, so no Sandpiper template text is rendered.
      expect(result.editableSpans).toEqual([]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }, 30_000);

  // The skill tool is loaded by default. `--tools bash` leaves it out, so Pi renders its own skills section,
  // naming bash; `--no-tools` leaves out every reader too, so neither renders one.
  it.each<[string, readonly string[], 'sandpiper' | 'pi' | 'none']>([
    ['the skill tool is loaded', [], 'sandpiper'],
    ['only bash is available', ['--tools', 'bash'], 'pi'],
    ['no tools are available', ['--no-tools'], 'none'],
  ])(
    'renders the skills section and its editable spans when %s',
    (_label, args, renderer) => {
      const tempDir = mkdtempSync(join(tmpdir(), 'sandpiper-system-prompt-skills-'));
      const agentDir = join(tempDir, 'agent');
      const skillFile = join(agentDir, 'skills', 'diagnostic-skill', 'SKILL.md');
      mkdirSync(dirname(skillFile), { recursive: true });
      mkdirSync(join(tempDir, 'home'), { recursive: true });
      writeFileSync(skillFile, '---\nname: diagnostic-skill\ndescription: Checks the skills section\n---\n\n# Skill\n');

      try {
        const output = execFileSync(
          bunExecutable,
          ['run', '--bun', './packages/cli/sandpiper_system_prompt.ts', '--json', '--approve', ...args],
          {
            cwd: repoRoot,
            encoding: 'utf-8',
            env: diagnosticEnv(agentDir),
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: 30_000,
          },
        );
        const result = JSON.parse(output) as { prompt: string; editableSpans: EditableSpan[] };
        const skillsSections = result.prompt.match(/<skills>\n[\s\S]*?\n<\/skills>/g) ?? [];
        const templateDir = join(realpathSync(repoRoot), 'packages', 'core', 'system-prompt');
        const paths = new Set(result.editableSpans.map((span) => span.path));

        expect(skillsSections).toHaveLength(renderer === 'none' ? 0 : 1);
        const skills = skillsSections[0] ?? '';
        if (renderer === 'sandpiper') {
          expect(skills).toContain('Use the `skill` tool to load relevant skills by name.');
          expect(skills).toContain(`<skill name="diagnostic-skill" location="${skillFile}">`);
          expect(paths).toContain(join(templateDir, 'skills.md'));
          expect(paths).toContain(join(templateDir, 'skill_load_instruction_skill_tool.md'));
        } else {
          expect(paths).not.toContain(join(templateDir, 'skills.md'));
        }
        if (renderer === 'pi') {
          expect(skills).toContain("Use bash to load a skill's file when the task matches its description.");
          expect(skills).toContain(`<name>diagnostic-skill</name>`);
          expect(skills).toContain(`<location>${skillFile}</location>`);
          // Pi renders its sections after Sandpiper's preamble, so no span reaches into them.
          expect(Math.max(...result.editableSpans.map((span) => span.end))).toBeLessThan(
            result.prompt.indexOf('<skills>'),
          );
        }
        expect(result.prompt).not.toContain('Use the `read` tool');
        expect(paths).toContain(join(templateDir, 'system_prompt.md'));
        for (const span of result.editableSpans) {
          expect(result.prompt.slice(span.start, span.end)).toBe(
            readFileSync(span.path, 'utf-8').slice(span.sourceStart, span.sourceEnd),
          );
        }
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    },
    30_000,
  );

  it('maps prompt text back to its template and user files', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'sandpiper-system-prompt-spans-'));
    const agentDir = join(tempDir, 'agent');
    const userProfile = join(agentDir, 'USER.md');
    const contextFile = join(agentDir, 'AGENTS.md');
    const identityFile = join(tempDir, 'identity.md');
    const appendFile = join(tempDir, 'append.md');
    const userProfileContent = '# Diagnostic user\r\nPrefers <clear> & "direct" answers\n';
    mkdirSync(agentDir, { recursive: true });
    mkdirSync(join(tempDir, 'home'), { recursive: true });
    writeFileSync(userProfile, userProfileContent);
    writeFileSync(contextFile, '# Diagnostic <context>\n');
    writeFileSync(identityFile, '<identity>from file</identity>\n');
    writeFileSync(appendFile, '<diagnostic_append>from file</diagnostic_append>\n');

    try {
      const output = execFileSync(
        bunExecutable,
        [
          'run',
          '--bun',
          './packages/cli/sandpiper_system_prompt.ts',
          '--json',
          '--approve',
          '--identity',
          identityFile,
          '--append-system-prompt',
          '<diagnostic_append>raw text</diagnostic_append>',
          '--append-system-prompt',
          appendFile,
        ],
        {
          cwd: repoRoot,
          encoding: 'utf-8',
          env: diagnosticEnv(agentDir),
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 30_000,
        },
      );
      const result = JSON.parse(output) as { prompt: string; editableSpans: EditableSpan[] };

      for (const span of result.editableSpans) {
        expect(realpathSync(span.path)).toBe(span.path);
        expect(Object.keys(span).sort()).toEqual(['end', 'path', 'sourceEnd', 'sourceStart', 'start']);
        expect(result.prompt.slice(span.start, span.end)).toBe(
          readFileSync(span.path, 'utf-8').slice(span.sourceStart, span.sourceEnd),
        );
      }
      const paths = new Set(result.editableSpans.map((span) => span.path));
      const templateDir = join(realpathSync(repoRoot), 'packages', 'core', 'system-prompt');
      for (const template of ['system_prompt', 'user_profile', 'harness_docs', 'injected_context']) {
        expect(paths).toContain(join(templateDir, `${template}.md`));
      }
      expect(paths).not.toContain(join(templateDir, 'identity.md'));
      expect(paths).toContain(realpathSync(identityFile));
      expect(paths).toContain(realpathSync(contextFile));
      expect(paths).toContain(realpathSync(appendFile));
      expect(result.editableSpans.filter((span) => span.path === realpathSync(userProfile))).toEqual([
        expect.objectContaining({ sourceStart: 0, sourceEnd: userProfileContent.length }),
      ]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }, 30_000);
});
