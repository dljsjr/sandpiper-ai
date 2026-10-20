import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
