import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bun = process.env.BUN_EXECUTABLE ?? 'bun';

interface ProductManifest {
  readonly name: string;
  readonly version: string;
  readonly packageManager: string;
  readonly engines: { readonly bun: string };
  readonly piConfig: { readonly name: string; readonly configDir: string; readonly bin: string };
  readonly bin: Readonly<Record<string, string>>;
  readonly files: readonly string[];
  readonly dependencies: Readonly<Record<string, string>>;
  readonly devDependencies: Readonly<Record<string, string>>;
  readonly bundledDependencies: readonly string[];
  readonly scripts: Readonly<Record<string, string>> & { readonly build: string };
}

function manifest(): ProductManifest {
  return JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as ProductManifest;
}

describe('root Sandpiper product', () => {
  it('owns the existing installed identity and stable command paths without a duplicate CLI product', () => {
    expect(manifest()).toMatchObject({
      name: 'sandpiper-ai-cli',
      version: '0.0.1',
      private: true,
      piConfig: { name: 'sandpiper', configDir: '.sandpiper', bin: 'sandpiper' },
      bin: {
        sandpiper: './packages/cli/bin/sandpiper',
        'sandpiper-system-prompt': './packages/cli/bin/sandpiper-system-prompt',
      },
    });
    expect(existsSync(join(repoRoot, 'packages/cli/package.json'))).toBe(false);
  });

  it('ships all pinned external runtime dependencies and keeps bundled source dependencies build-only', () => {
    const product = manifest();
    expect(product.dependencies).toEqual({
      '@earendil-works/pi-ai': '1.5.2',
      '@earendil-works/pi-coding-agent': '1.5.2',
      '@earendil-works/pi-mcp': '1.5.2',
      '@earendil-works/pi-tui': '1.5.2',
      jsdom: '30.0.1',
    });
    expect([...product.bundledDependencies].sort()).toEqual(Object.keys(product.dependencies).sort());
    const webSearch = JSON.parse(readFileSync(join(repoRoot, 'extensions/web-search/package.json'), 'utf8')) as {
      readonly dependencies: Readonly<Record<string, string>>;
    };
    expect(webSearch.dependencies).toEqual({
      '@earendil-works/pi-mcp': '1.5.2',
      jsdom: '30.0.1',
    });
    expect(product.devDependencies).not.toHaveProperty('mcporter');
    expect(product.devDependencies).toMatchObject({
      'sandpiper-ai-core': 'workspace:*',
      'sanitize-filename': '1.6.4',
      tmp: '0.2.7',
      uuid: '14.0.2',
    });
  });

  it('builds both commands into a clean root dist without a workspace build graph', () => {
    const root = mkdtempSync(join(tmpdir(), 'sandpiper-root-build-'));
    try {
      mkdirSync(join(root, 'packages/cli'), { recursive: true });
      mkdirSync(join(root, 'dist/resources'), { recursive: true });
      writeFileSync(join(root, 'package.json'), JSON.stringify({ type: 'module' }));
      writeFileSync(join(root, 'dist/obsolete.js'), 'retired chunk');
      writeFileSync(join(root, 'dist/resources/retired.txt'), 'retired payload');
      writeFileSync(join(root, 'packages/cli/sandpiper_standalone.ts'), "console.log('runtime fixture');\n");
      writeFileSync(join(root, 'packages/cli/sandpiper_system_prompt.ts'), "console.log('prompt fixture');\n");
      execFileSync(bun, ['exec', manifest().scripts.build], { cwd: root, stdio: 'pipe' });
      expect(existsSync(join(root, 'dist/obsolete.js'))).toBe(false);
      expect(existsSync(join(root, 'dist/resources'))).toBe(false);
      for (const [entrypoint, output] of [
        ['sandpiper_standalone.js', 'runtime fixture'],
        ['sandpiper_system_prompt.js', 'prompt fixture'],
      ] as const) {
        expect(execFileSync(bun, [join(root, 'dist', entrypoint)], { encoding: 'utf8' }).trim()).toBe(output);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('packs root-owned output and public files with the tested Bun toolchain and no install build', () => {
    const product = manifest();
    expect(product.files).toEqual([
      'packages/cli/bin/',
      'dist/**/*.js',
      'dist/**/*.js.map',
      'docs/',
      'LICENSE',
      'README.md',
      'CONTRIBUTING.md',
    ]);
    expect(product.packageManager).toBe('bun@1.4.4');
    expect(product.engines.bun).toBe('>=1.4.4');
    expect(product.scripts['pack:cli']).toBe('bun run build && bun pm pack --ignore-scripts --destination ./dist');
    for (const lifecycle of ['preinstall', 'install', 'postinstall', 'prepare']) {
      expect(product.scripts[lifecycle]).toBeUndefined();
    }
  });

  it.each(['core', 'capability-autotoon'])('%s exposes source types without an emitted package build', (name) => {
    const packageRoot = join(repoRoot, 'packages', name);
    const metadata = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as {
      exports: { '.': { types: string; default: string } };
      scripts?: Record<string, string>;
    };
    expect(metadata.exports['.'].types).toBe(metadata.exports['.'].default);
    expect(existsSync(join(packageRoot, metadata.exports['.'].types))).toBe(true);
    expect(metadata.scripts?.build).toBeUndefined();
  });

  it.each([
    ['sandpiper', 'sandpiper_standalone.js'],
    ['sandpiper-system-prompt', 'sandpiper_system_prompt.js'],
  ])('%s runs its root dist entrypoint from the existing bin path', (command, entrypoint) => {
    const root = mkdtempSync(join(tmpdir(), 'sandpiper-root-bin-'));
    try {
      const binDir = join(root, 'packages/cli/bin');
      mkdirSync(binDir, { recursive: true });
      mkdirSync(join(root, 'dist'));
      cpSync(join(repoRoot, 'packages/cli/bin', command), join(binDir, command));
      writeFileSync(
        join(root, 'dist', entrypoint),
        `console.log(JSON.stringify({ command: ${JSON.stringify(command)}, args: process.argv.slice(2) }));\n`,
      );
      const output = execFileSync(bun, [join(binDir, command), '--fixture', 'argument with spaces'], {
        cwd: tmpdir(),
        encoding: 'utf8',
      });
      expect(JSON.parse(output)).toEqual({ command, args: ['--fixture', 'argument with spaces'] });
      rmSync(join(root, 'dist'), { recursive: true });
      const missing = spawnSync(bun, [join(binDir, command)], { cwd: tmpdir(), encoding: 'utf8' });
      expect(missing.status).toBe(1);
      expect(missing.stderr).toContain(`${command} has not been built yet. Run \`bun run build\``);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('packs entrypoints and chunk maps without old archives or private output on a direct repack', () => {
    const root = mkdtempSync(join(tmpdir(), 'sandpiper-root-pack-'));
    try {
      const product = manifest();
      writeFileSync(
        join(root, 'package.json'),
        JSON.stringify({
          name: 'sandpiper-pack-fixture',
          version: '0.0.1',
          private: true,
          files: product.files,
          bin: product.bin,
        }),
      );
      const runtimeFiles = [
        'dist/sandpiper_standalone.js',
        'dist/sandpiper_standalone.js.map',
        'dist/sandpiper_system_prompt.js',
        'dist/sandpiper_system_prompt.js.map',
        'dist/chunks/shared.js',
        'dist/chunks/shared.js.map',
      ];
      const publicFiles = ['LICENSE', 'README.md', 'CONTRIBUTING.md', 'docs/README.md'];
      for (const path of [
        ...runtimeFiles,
        ...publicFiles,
        ...Object.values(product.bin),
        'dist/previous-build.tgz',
        'dist/private.txt',
      ]) {
        const destination = join(root, path);
        mkdirSync(dirname(destination), { recursive: true });
        writeFileSync(destination, 'fixture\n');
      }
      const pack = () =>
        execFileSync(bun, ['pm', 'pack', '--ignore-scripts', '--quiet', '--destination', './dist'], {
          cwd: root,
          encoding: 'utf8',
        });
      pack();
      pack();
      const entries = execFileSync('tar', ['-tzf', join(root, 'dist/sandpiper-pack-fixture-0.0.1.tgz')], {
        encoding: 'utf8',
      })
        .trim()
        .split('\n');
      for (const path of [...runtimeFiles, ...publicFiles, ...Object.values(product.bin)]) {
        expect(entries).toContain(`package/${path.replace(/^\.\//, '')}`);
      }
      expect(entries.filter((entry) => entry.endsWith('.tgz'))).toEqual([]);
      expect(entries).not.toContain('package/dist/private.txt');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
