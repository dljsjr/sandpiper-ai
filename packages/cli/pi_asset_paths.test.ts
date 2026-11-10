import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const piPackageDir = dirname(dirname(fileURLToPath(import.meta.resolve('@earendil-works/pi-coding-agent'))));
const configUrl = pathToFileURL(join(piPackageDir, 'dist', 'config.js')).href;

interface PiPaths {
  readonly app: string;
  readonly version: string;
  readonly config: string;
  readonly docs: string;
  readonly themes: string;
  readonly assets: string;
  readonly exports: string;
}

function readPiPaths(packageDir: string, runtimeDir?: string): PiPaths {
  const env: NodeJS.ProcessEnv = { ...process.env, PI_PACKAGE_DIR: packageDir };
  delete env.PI_CODING_AGENT_PACKAGE;
  if (runtimeDir !== undefined) env.PI_CODING_AGENT_PACKAGE = runtimeDir;
  return JSON.parse(
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import * as config from ${JSON.stringify(configUrl)};
console.log(JSON.stringify({ app: config.APP_NAME, version: config.VERSION, config: config.CONFIG_DIR_NAME,
docs: config.getDocsPath(), themes: config.getThemesDir(), assets: config.getInteractiveAssetsDir(), exports: config.getExportTemplateDir() }));`,
      ],
      { encoding: 'utf8', env },
    ),
  ) as PiPaths;
}

describe('local Pi asset-root patch', () => {
  it.each([false, true])('separates product metadata from Pi assets (source assets: %s)', (sourceAssets) => {
    const root = mkdtempSync(join(tmpdir(), 'sandpiper-pi-assets-'));
    const packageDir = join(root, 'sandpiper');
    const runtimeDir = join(root, 'pi');
    const layout = sourceAssets ? 'src' : 'dist';
    try {
      mkdirSync(packageDir);
      mkdirSync(join(runtimeDir, layout), { recursive: true });
      writeFileSync(
        join(packageDir, 'package.json'),
        JSON.stringify({
          name: 'sandpiper-ai-cli',
          version: '9.8.7',
          piConfig: { name: 'sandpiper', configDir: '.sandpiper' },
        }),
      );
      expect(readPiPaths(packageDir, runtimeDir)).toEqual({
        app: 'sandpiper',
        version: '9.8.7',
        config: '.sandpiper',
        docs: join(packageDir, 'docs'),
        themes: join(runtimeDir, layout, 'modes', 'interactive', 'theme'),
        assets: join(runtimeDir, layout, 'modes', 'interactive', 'assets'),
        exports: join(runtimeDir, layout, 'core', 'export-html'),
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('preserves stock Pi asset paths when no separate runtime is configured', () => {
    const paths = readPiPaths(piPackageDir);
    expect(paths.themes).toBe(join(piPackageDir, 'dist', 'modes', 'interactive', 'theme'));
    expect(paths.assets).toBe(join(piPackageDir, 'dist', 'modes', 'interactive', 'assets'));
    expect(paths.exports).toBe(join(piPackageDir, 'dist', 'core', 'export-html'));
  });
});

describe('local Pi version-check patch', () => {
  it('gives the native update check the Pi version, not the product version', () => {
    const interactiveMode = join(piPackageDir, 'dist', 'modes', 'interactive', 'interactive-mode.js');
    expect(readFileSync(interactiveMode, 'utf8')).toContain(
      'checkForNewPiVersion(process.env.PI_CODING_AGENT_VERSION || this.version)',
    );
  });
});

describe('local Pi User-Agent patch', () => {
  interface PiUserAgents {
    readonly ownRequests: string;
    readonly providerRequests: string;
  }

  function readPiUserAgents(packageDir: string, piVersion?: string): PiUserAgents {
    const env: NodeJS.ProcessEnv = { ...process.env, PI_PACKAGE_DIR: packageDir };
    delete env.PI_CODING_AGENT_VERSION;
    if (piVersion !== undefined) env.PI_CODING_AGENT_VERSION = piVersion;
    const moduleUrl = (...path: readonly string[]) => JSON.stringify(pathToFileURL(join(piPackageDir, ...path)).href);
    return JSON.parse(
      execFileSync(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          `import { formatUserAgent } from ${JSON.stringify(import.meta.resolve('@earendil-works/pi-ai'))};
import { VERSION } from ${JSON.stringify(configUrl)};
import { getClientIdentity } from ${moduleUrl('dist', 'core', 'client-identity.js')};
import { getPiUserAgent } from ${moduleUrl('dist', 'utils', 'pi-user-agent.js')};
console.log(JSON.stringify({ ownRequests: getPiUserAgent(VERSION),
providerRequests: formatUserAgent(getClientIdentity({ getEnableInstallTelemetry: () => false })) }));`,
        ],
        { encoding: 'utf8', env },
      ),
    ) as PiUserAgents;
  }

  it.each([
    ['the Pi version', '1.2.3', /^pi\/1\.2\.3 /],
    ['the product version when no Pi version is set', undefined, /^pi\/9\.8\.7 /],
  ])('identifies as %s in its own and provider requests', (_label, piVersion, expected) => {
    const packageDir = mkdtempSync(join(tmpdir(), 'sandpiper-pi-user-agent-'));
    try {
      writeFileSync(join(packageDir, 'package.json'), JSON.stringify({ name: 'sandpiper-ai-cli', version: '9.8.7' }));
      const userAgents = readPiUserAgents(packageDir, piVersion);
      expect(userAgents.ownRequests).toMatch(expected);
      expect(userAgents.providerRequests).toMatch(expected);
    } finally {
      rmSync(packageDir, { recursive: true, force: true });
    }
  });

  it('identifies as the Pi version to MCP servers', () => {
    const mcpRuntime = join(piPackageDir, 'dist', 'extensions', 'mcp', 'runtime.js');
    expect(readFileSync(mcpRuntime, 'utf8')).toContain('version: process.env.PI_CODING_AGENT_VERSION || VERSION,');
  });
});
