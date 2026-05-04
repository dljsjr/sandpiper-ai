import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import autotoonPackageJson from '../packages/capability-autotoon/package.json' with { type: 'json' };

export interface PiConfigJson {
  readonly name: string;
  readonly configDir: string;
  readonly bin: string;
}

export interface PiResourceJson {
  readonly extensions?: readonly string[];
  readonly skills?: readonly string[];
  readonly prompts?: readonly string[];
  readonly themes?: readonly string[];
}

export interface RootPackageJson {
  readonly name: string;
  readonly version: string;
  readonly piConfig?: PiConfigJson;
  readonly keywords?: readonly string[];
  readonly pi?: PiResourceJson;
  readonly license?: string;
  readonly author?: string | PackageAuthor;
  readonly homepage?: string;
  readonly repository?: string | PackageRepository;
  readonly workspaces?: {
    readonly catalogs?: Record<string, Record<string, string>>;
  };
}

export interface PackageAuthor {
  readonly name: string;
  readonly email?: string;
  readonly url?: string;
}

export interface PackageRepository {
  readonly type: 'git';
  readonly url: string;
}

interface PackageJsonWithDependencies {
  readonly dependencies?: Record<string, string>;
}

export interface SupportPackageJson {
  readonly name: string;
  readonly version: string;
  readonly type: 'module';
  readonly description?: string;
  readonly exports?: Record<string, { readonly types?: string; readonly default: string }>;
  readonly dependencies?: Record<string, string>;
  readonly peerDependencies?: Record<string, string>;
  readonly pi?: PiResourceJson;
}

export function packageDependencyVersion(packageJson: PackageJsonWithDependencies, dependency: string): string {
  const version = packageJson.dependencies?.[dependency];

  if (version === undefined) {
    throw new Error(`Missing package dependency version for ${dependency}`);
  }

  return version;
}

export function catalogVersion(rootPackageJson: RootPackageJson, catalog: string, dependency: string): string {
  const version = rootPackageJson.workspaces?.catalogs?.[catalog]?.[dependency];

  if (version === undefined) {
    throw new Error(`Missing catalog version for ${catalog}.${dependency}`);
  }

  return version;
}

export function createPiPeerDependencies(): Record<string, string> {
  return {
    '@mariozechner/pi-coding-agent': '*',
    '@mariozechner/pi-tui': '*',
    '@sinclair/typebox': '*',
  };
}

export function createPiRuntimeDependencies(rootPackageJson: RootPackageJson): Record<string, string> {
  return {
    '@mozilla/readability': catalogVersion(rootPackageJson, 'web', '@mozilla/readability'),
    '@toon-format/toon': packageDependencyVersion(autotoonPackageJson, '@toon-format/toon'),
    jsdom: catalogVersion(rootPackageJson, 'web', 'jsdom'),
    'sandpiper-ai-core': 'file:./packages/core',
    'sandpiper-capability-autotoon': 'file:./packages/capability-autotoon',
    turndown: catalogVersion(rootPackageJson, 'web', 'turndown'),
  };
}

export function normalizePackageAuthor(author: RootPackageJson['author']): PackageAuthor | undefined {
  if (author === undefined) return undefined;
  if (typeof author !== 'string') return author;

  const match = /^(?<name>[^<]+?)(?:\s*<(?<email>[^>]+)>)?$/.exec(author.trim());
  const name = match?.groups?.name?.trim();

  if (name === undefined || name.length === 0) return undefined;

  const email = match?.groups?.email?.trim();
  return email === undefined || email.length === 0 ? { name } : { name, email };
}

export function normalizePackageRepository(repository: RootPackageJson['repository']): PackageRepository | undefined {
  if (repository === undefined) return undefined;
  if (typeof repository !== 'string') return repository;
  return { type: 'git', url: repository };
}

export function createCoreSupportPackageJson(rootPackageJson: RootPackageJson): SupportPackageJson {
  return {
    name: 'sandpiper-ai-core',
    version: rootPackageJson.version,
    type: 'module',
    description: 'Shared runtime utilities for Sandpiper packages and Pi extensions',
    exports: {
      '.': {
        types: './dist/index.d.ts',
        default: './src/index.ts',
      },
    },
    dependencies: {
      '@toon-format/toon': packageDependencyVersion(autotoonPackageJson, '@toon-format/toon'),
    },
  };
}

export function createAutotoonSupportPackageJson(rootPackageJson: RootPackageJson): SupportPackageJson {
  return {
    name: 'sandpiper-capability-autotoon',
    version: rootPackageJson.version,
    type: 'module',
    description: 'Host-neutral AutoTOON JSON to TOON conversion plus Pi adapter',
    exports: {
      '.': {
        types: './dist/index.d.ts',
        default: './src/index.ts',
      },
      './pi-extension': {
        types: './dist/pi-extension.d.ts',
        default: './src/pi-extension.ts',
      },
    },
    dependencies: {
      '@toon-format/toon': packageDependencyVersion(autotoonPackageJson, '@toon-format/toon'),
    },
    peerDependencies: {
      '@mariozechner/pi-coding-agent': '*',
    },
  };
}

export function createShellRelayExtensionPackageJson(rootPackageJson: RootPackageJson): SupportPackageJson {
  return {
    name: 'shell-relay',
    version: rootPackageJson.version,
    type: 'module',
    description: 'Pi extension: shared terminal session between user and agent via Zellij',
    dependencies: {
      'sandpiper-ai-core': 'file:../../packages/core',
    },
    peerDependencies: {
      '@mariozechner/pi-coding-agent': '*',
      '@sinclair/typebox': '*',
    },
    pi: {
      extensions: ['./src/index.ts'],
    },
  };
}

export function createWebFetchExtensionPackageJson(rootPackageJson: RootPackageJson): SupportPackageJson {
  return {
    name: 'web-fetch',
    version: rootPackageJson.version,
    type: 'module',
    description: 'Pi extension: fetch web pages and return clean markdown content',
    dependencies: {
      '@mozilla/readability': catalogVersion(rootPackageJson, 'web', '@mozilla/readability'),
      jsdom: catalogVersion(rootPackageJson, 'web', 'jsdom'),
      turndown: catalogVersion(rootPackageJson, 'web', 'turndown'),
    },
    peerDependencies: {
      '@mariozechner/pi-coding-agent': '*',
      '@sinclair/typebox': '*',
    },
    pi: {
      extensions: ['./src/index.ts'],
    },
  };
}

export function createAutotoonExtensionPackageJson(rootPackageJson: RootPackageJson): SupportPackageJson {
  return {
    name: 'autotoon',
    version: rootPackageJson.version,
    type: 'module',
    description: 'Compatibility bridge to packages/capability-autotoon',
    dependencies: {
      'sandpiper-capability-autotoon': 'file:../../packages/capability-autotoon',
    },
    pi: {
      extensions: ['./autotoon.ts'],
    },
  };
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

export async function writePiArtifactSupportPackageJsons(
  outputDir: string,
  rootPackageJson: RootPackageJson,
): Promise<void> {
  await Promise.all([
    writeJson(join(outputDir, 'packages', 'core', 'package.json'), createCoreSupportPackageJson(rootPackageJson)),
    writeJson(
      join(outputDir, 'packages', 'capability-autotoon', 'package.json'),
      createAutotoonSupportPackageJson(rootPackageJson),
    ),
    writeJson(
      join(outputDir, 'extensions', 'shell-relay', 'package.json'),
      createShellRelayExtensionPackageJson(rootPackageJson),
    ),
    writeJson(
      join(outputDir, 'extensions', 'web-fetch', 'package.json'),
      createWebFetchExtensionPackageJson(rootPackageJson),
    ),
    writeJson(
      join(outputDir, 'extensions', 'autotoon', 'package.json'),
      createAutotoonExtensionPackageJson(rootPackageJson),
    ),
  ]);
}
