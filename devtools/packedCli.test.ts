import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bun = process.env.BUN_EXECUTABLE ?? 'bun';

function isolatedEnv(root: string): NodeJS.ProcessEnv {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(PI|SANDPIPER)_/.test(key)));
  return {
    ...env,
    HOME: join(root, 'home'),
    XDG_CONFIG_HOME: join(root, 'config'),
    XDG_STATE_HOME: join(root, 'state'),
    XDG_CACHE_HOME: join(root, 'cache'),
    XDG_RUNTIME_DIR: root,
    BUN_INSTALL: join(root, 'bun'),
    BUN_INSTALL_CACHE_DIR: join(root, 'bun-cache'),
    JITI_FS_CACHE: 'false',
    BRAVE_API_KEY: '',
    npm_config_cache: join(root, 'npm-cache'),
    npm_config_userconfig: join(root, 'npmrc'),
    npm_config_globalconfig: join(root, 'global-npmrc'),
    npm_config_update_notifier: 'false',
    NODE_PATH: '',
    PI_OFFLINE: '1',
    PI_CODING_AGENT_DIR: join(root, 'agent'),
    SANDPIPER_CODING_AGENT_DIR: join(root, 'agent'),
    PI_CODING_AGENT_SESSION_DIR: join(root, 'sessions'),
    SANDPIPER_CODING_AGENT_SESSION_DIR: join(root, 'sessions'),
    AGENT_JOURNAL_DIR: join(root, 'journal'),
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
    JJ_CONFIG: join(repoRoot, 'devtools', 'test-fixtures', 'jj-test-config.toml'),
    TATTLER_RUNTIME_NAMESPACE: `pack-${process.pid}`,
  };
}

function makeReadOnly(path: string, modes: Map<string, number>): void {
  const metadata = lstatSync(path);
  if (metadata.isSymbolicLink()) return;
  if (metadata.isDirectory()) {
    for (const entry of readdirSync(path)) makeReadOnly(join(path, entry), modes);
  }
  modes.set(path, metadata.mode & 0o777);
  chmodSync(path, metadata.mode & 0o555);
}

describe('packed Sandpiper CLI', () => {
  it('disables the shared Jiti filesystem cache in isolated runtime probes', () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'sp-cache-')));
    mkdirSync(join(root, 'node_modules'));
    try {
      const cache = execFileSync(
        process.execPath,
        [
          '--input-type=module',
          '--eval',
          `import { createRequire } from 'node:module';
const require = createRequire(${JSON.stringify(import.meta.resolve('@earendil-works/pi-coding-agent'))});
const { createJiti } = require('jiti');
const jiti = createJiti(${JSON.stringify(join(root, 'probe.cjs'))});
console.log(JSON.stringify(jiti.options.fsCache));`,
        ],
        {
          cwd: root,
          env: { ...isolatedEnv(root), TMPDIR: root, JITI_DEBUG: '0' },
          encoding: 'utf8',
          timeout: 10_000,
        },
      );
      expect(JSON.parse(cache)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('inspects the real payload before running both commands without resources in a read-only offline installation', () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'sp-pack-')));
    const env = isolatedEnv(root);
    const consumer = join(root, 'consumer');
    const project = join(root, 'project');
    const product = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
      name: string;
      version: string;
    };
    const tarball = join(root, `${product.name}-${product.version}.tgz`);
    const installed = join(consumer, 'node_modules', 'sandpiper-ai-cli');
    const modes = new Map<string, number>();
    for (const directory of [consumer, project, env.HOME]) {
      if (directory) mkdirSync(directory, { recursive: true });
    }
    try {
      execFileSync(bun, ['pm', 'pack', '--ignore-scripts', '--quiet', '--destination', root], {
        cwd: repoRoot,
        env,
        timeout: 60_000,
      });
      // Check the actual archive before installation or any resource-free fixture mutation.
      const entries = execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 })
        .trim()
        .split('\n');
      expect(entries).toEqual(
        expect.arrayContaining([
          'package/package.json',
          'package/packages/cli/bin/sandpiper',
          'package/packages/cli/bin/sandpiper-system-prompt',
          'package/dist/sandpiper_standalone.js',
          'package/dist/sandpiper_system_prompt.js',
          'package/node_modules/@earendil-works/pi-mcp/package.json',
          'package/docs/README.md',
          'package/LICENSE',
          'package/README.md',
          'package/CONTRIBUTING.md',
        ]),
      );
      expect(entries.filter((entry) => !entry.startsWith('package/') || entry.split('/').includes('..'))).toEqual([]);
      expect(entries.filter((entry) => /\.(tgz|tar\.gz)$/.test(entry))).toEqual([]);
      expect(entries.filter((entry) => /\/(\.sandpiper|\.pi|\.git|\.jj|\.turbo)(\/|$)/.test(entry))).toEqual([]);
      for (const retired of [
        'packages/resources',
        'packages/cli/package.json',
        'packages/cli/dist',
        'packages/cli/docs',
        'dist/standalone',
        'dist/standalone-package',
        'docs/features/tasks',
        'docs/features/tasks.md',
        'docs/features/standup.md',
        'devtools',
        'extensions',
        'patches',
      ]) {
        expect(
          entries.filter((entry) => entry === `package/${retired}` || entry.startsWith(`package/${retired}/`)),
        ).toEqual([]);
      }
      expect(entries.filter((entry) => /^package\/packages\/cli\/.*\.ts$/.test(entry))).toEqual([]);
      const legacyApplicationPayload = entries
        .filter((entry) => /^package\/dist\/.*\.(js|map)$/.test(entry))
        .filter((entry) =>
          /mcporter|@modelcontextprotocol\/(?:client|sdk)/i.test(
            execFileSync('tar', ['-xOzf', tarball, entry], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }),
          ),
        );
      expect(legacyApplicationPayload).toEqual([]);
      const packagedManifest = JSON.parse(
        execFileSync('tar', ['-xOzf', tarball, 'package/package.json'], { encoding: 'utf8' }),
      ) as { dependencies: Record<string, string>; bundledDependencies: string[] };
      expect(packagedManifest.dependencies['@earendil-works/pi-mcp']).toBe('1.5.2');
      expect(packagedManifest.bundledDependencies).toContain('@earendil-works/pi-mcp');
      expect(packagedManifest.dependencies).not.toHaveProperty('mcporter');

      expect(existsSync(join(root, 'npm-cache'))).toBe(false);
      execFileSync('npm', ['install', tarball, '--offline', '--ignore-scripts', '--no-audit', '--no-fund'], {
        cwd: consumer,
        env,
        timeout: 60_000,
      });
      const manifest = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8')) as { version: string };
      const pi = join(installed, 'node_modules', '@earendil-works', 'pi-coding-agent');
      expect(readFileSync(join(pi, 'dist', 'config.js'), 'utf8')).toContain('process.env.PI_CODING_AGENT_PACKAGE');
      expect(readFileSync(join(pi, 'dist', 'modes', 'interactive', 'interactive-mode.js'), 'utf8')).toContain(
        'checkForNewPiVersion(process.env.PI_CODING_AGENT_VERSION || this.version)',
      );
      expect(existsSync(join(pi, 'dist', 'modes', 'interactive', 'theme', 'dark.json'))).toBe(true);
      expect(existsSync(join(pi, 'dist', 'core', 'export-html', 'template.html'))).toBe(true);
      expect(existsSync(join(installed, 'packages', 'resources'))).toBe(false);
      for (const entry of entries.filter((entry) => /^package\/dist\/.*\.(js|map)$/.test(entry))) {
        expect(readFileSync(join(installed, entry.slice('package/'.length)), 'utf8')).not.toContain(repoRoot);
      }
      makeReadOnly(consumer, modes);
      const installedPaths = readdirSync(consumer, { recursive: true }).sort();
      const themeModule = pathToFileURL(join(pi, 'dist', 'modes', 'interactive', 'theme', 'theme.js')).href;
      const nativeRuntime = execFileSync(
        bun,
        [
          '--eval',
          `const resolved = ${JSON.stringify(pathToFileURL(join(installed, 'node_modules', '@earendil-works', 'pi-mcp', 'dist', 'index.js')).href)};
const { McpClient, StreamableHttpTransport } = await import(resolved);
console.log(JSON.stringify({ resolved, client: typeof McpClient, transport: typeof StreamableHttpTransport }));`,
        ],
        { cwd: project, env, encoding: 'utf8', timeout: 10_000 },
      );
      expect(JSON.parse(nativeRuntime)).toEqual({
        resolved: pathToFileURL(join(installed, 'node_modules', '@earendil-works', 'pi-mcp', 'dist', 'index.js')).href,
        client: 'function',
        transport: 'function',
      });
      expect(
        JSON.parse(readFileSync(join(installed, 'node_modules', '@earendil-works', 'pi-mcp', 'package.json'), 'utf8'))
          .version,
      ).toBe('1.5.2');
      const stockThemes = execFileSync(
        bun,
        [
          '--eval',
          `const { getThemeByName } = await import(${JSON.stringify(themeModule)});
const dark = getThemeByName('dark');
const light = getThemeByName('light');
if (!dark || !light) throw new Error('Stock themes failed to load without bundled resources');
console.log([dark.name, light.name].join(','));`,
        ],
        {
          cwd: project,
          env: { ...env, PI_PACKAGE_DIR: installed, PI_CODING_AGENT_PACKAGE: pi },
          encoding: 'utf8',
          timeout: 30_000,
        },
      );
      expect(stockThemes.trim()).toBe('dark,light');
      const run = (bin: string, args: readonly string[], extraEnv: NodeJS.ProcessEnv = {}): string =>
        execFileSync(bun, [join(installed, 'packages', 'cli', 'bin', bin), ...args], {
          cwd: project,
          env: { ...env, ...extraEnv },
          encoding: 'utf8',
          timeout: 30_000,
          maxBuffer: 2 * 1024 * 1024,
        });
      expect(run('sandpiper', ['--version']).trim()).toBe(manifest.version);
      expect(
        run('sandpiper', ['--help'])
          .split('\n')
          .filter((line) => line.trimStart().startsWith('--identity')),
      ).toHaveLength(1);
      const extensionPath = join(project, 'runtime-import-extension.ts');
      writeFileSync(
        extensionPath,
        `import { getMarkdownTheme } from '@earendil-works/pi-coding-agent';
export default function runtimeImportProbe(pi) {
  getMarkdownTheme();
  pi.registerFlag('packed-runtime-import-probe', {
    description: 'Marker after an installed runtime SDK import',
    type: 'boolean',
    default: false,
  });
}
`,
      );
      expect(run('sandpiper', ['--help', '-e', extensionPath])).toContain('--packed-runtime-import-probe');
      const transportProbe = join(project, 'transport-probe.ts');
      const mockProvider = join(project, 'mock-provider.ts');
      const proofPath = join(root, 'native-mcp-proof.json');
      writeFileSync(
        transportProbe,
        readFileSync(join(repoRoot, 'devtools/integration/fixtures/native-mcp/transport-probe.ts')),
      );
      writeFileSync(mockProvider, readFileSync(join(repoRoot, 'devtools/integration/mock-provider.ts')));
      mkdirSync(join(root, 'agent'), { recursive: true });
      writeFileSync(join(root, 'agent', 'settings.json'), JSON.stringify({ 'web-search': {} }));
      writeFileSync(join(root, 'agent', 'auth.json'), '{}');
      const searchEvents = run(
        'sandpiper',
        [
          '--offline',
          '--no-session',
          '--mode',
          'json',
          '--tools',
          'web_search',
          '--provider',
          'sandpiper-integration-mock',
          '--model',
          'mock-1',
          '-e',
          transportProbe,
          '-e',
          mockProvider,
          'Run the packed web search probe.',
        ],
        {
          SANDPIPER_PACKED_MCP_PROOF: proofPath,
          SANDPIPER_INTEGRATION_MOCK_SCRIPT: JSON.stringify([
            { type: 'toolCall', toolName: 'web_search', arguments: { query: '  packed query  ', count: 1 } },
            { type: 'text', text: 'packed search complete' },
          ]),
        },
      )
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as { type: string; toolName?: string; isError?: boolean; result?: unknown });
      expect(searchEvents.filter((event) => event.type === 'tool_execution_end')).toEqual([
        expect.objectContaining({
          toolName: 'web_search',
          isError: false,
          result: {
            content: [
              {
                type: 'text',
                text: 'Search results for "  packed query  " (via parallel):\n\n1. Packed title\n   https://example.invalid/packed\n   Packed snippet',
              },
            ],
            details: { query: '  packed query  ', provider: 'parallel', resultCount: 1 },
          },
        }),
      ]);
      const proof = JSON.parse(readFileSync(proofPath, 'utf8')) as {
        requests: { method: string; rpc?: { method: string; params?: unknown }; session: string | null }[];
        blocked: string[];
        tools: {
          name: string;
          parameters: { required: string[]; properties: Record<string, unknown> };
          namespace?: { name: string };
          sourceInfo: { path: string };
        }[];
        activeTools: string[];
      };
      expect(proof.blocked).toEqual([]);
      expect(
        proof.requests.filter((request) => request.method === 'POST').map((request) => request.rpc?.method),
      ).toEqual(['initialize', 'notifications/initialized', 'tools/call']);
      expect(proof.requests.find((request) => request.rpc?.method === 'initialize')?.rpc?.params).toEqual(
        expect.objectContaining({ clientInfo: { name: 'sandpiper-web-search', version: '0.0.1' } }),
      );
      expect(proof.requests.find((request) => request.rpc?.method === 'tools/call')?.rpc?.params).toEqual({
        name: 'web_search',
        arguments: {
          objective: 'packed query',
          search_queries: ['packed query'],
          session_id: expect.stringMatching(/^sp-/),
        },
      });
      expect(proof.requests.filter((request) => request.method === 'DELETE')).toEqual([
        { method: 'DELETE', session: 'packed-native-session' },
      ]);
      expect(proof.activeTools).toEqual(['web_search']);
      expect(
        proof.tools.filter((tool) => tool.namespace?.name.startsWith('mcp') || tool.sourceInfo.path === 'builtin:mcp'),
      ).toEqual([]);
      const searchTools = proof.tools.filter((tool) => tool.name === 'web_search');
      expect(searchTools).toHaveLength(1);
      expect(searchTools[0]?.parameters.required).toEqual(['query']);
      expect(Object.keys(searchTools[0]?.parameters.properties ?? {}).sort()).toEqual(['count', 'query']);
      expect(searchTools[0]?.parameters.properties).toEqual({
        query: expect.objectContaining({ type: 'string' }),
        count: expect.objectContaining({ type: 'integer', minimum: 1, maximum: 20 }),
      });
      expect(run('sandpiper-system-prompt', ['--help'])).toContain('render the effective Sandpiper system prompt');
      const rendered = JSON.parse(run('sandpiper-system-prompt', ['--json', '--approve'])) as { prompt: string };
      const catalogue = rendered.prompt.match(/<available_skills>[\s\S]*?<\/available_skills>/)?.[0] ?? '';
      expect([...catalogue.matchAll(/<skill name="([^"]+)"/g)].map((match) => match[1]).sort()).toEqual([]);
      expect(rendered.prompt).toContain('<tools>\n- read:');
      expect(rendered.prompt).not.toContain(repoRoot);
      expect(existsSync(join(installed, 'packages', 'resources'))).toBe(false);
      expect(existsSync(join(installed, 'dist', 'standalone-package'))).toBe(false);
      expect(existsSync(join(project, 'dist'))).toBe(false);
      expect(readdirSync(consumer, { recursive: true }).sort()).toEqual(installedPaths);
    } finally {
      for (const [path, mode] of modes) chmodSync(path, mode);
      rmSync(root, { recursive: true, force: true });
    }
  }, 150_000);
});
