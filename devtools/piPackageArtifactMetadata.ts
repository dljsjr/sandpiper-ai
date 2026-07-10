import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import autotoonExtensionPackageJson from '../extensions/autotoon/package.json' with { type: 'json' };
// import shellRelayPackageJson from '../extensions/shell-relay/package.json' with { type: 'json' };
import systemPackageJson from '../extensions/system/package.json' with { type: 'json' };
import webFetchPackageJson from '../extensions/web-fetch/package.json' with { type: 'json' };
import autotoonPackageJson from '../packages/capability-autotoon/package.json' with { type: 'json' };
import cliPackageJson from '../packages/cli/package.json' with { type: 'json' };
import tattlerPluginPackageJson from '../plugins/pi/extensions/package.json' with { type: 'json' };

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
  readonly peerDependencies?: Record<string, string>;
}

export interface PackageAuthor {
  readonly name: string;
  readonly email?: string;
  readonly url?: string;
}

export interface PackageRepository {
  readonly type: string;
  readonly url: string;
}

interface PackageJsonWithDependencies {
  readonly dependencies?: Record<string, string>;
  readonly peerDependencies?: Record<string, string>;
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

export function packagePeerDependencyVersion(packageJson: PackageJsonWithDependencies, dependency: string): string {
  const version = packageJson.peerDependencies?.[dependency];

  if (version === undefined) {
    throw new Error(`Missing package peer dependency version for ${dependency}`);
  }

  return version;
}

export function createPiPeerDependencies(rootPackageJson: RootPackageJson): Record<string, string> {
  return {
    '@earendil-works/pi-coding-agent': packagePeerDependencyVersion(rootPackageJson, '@earendil-works/pi-coding-agent'),
    '@earendil-works/pi-tui': packagePeerDependencyVersion(rootPackageJson, '@earendil-works/pi-tui'),
    typebox: packagePeerDependencyVersion(rootPackageJson, 'typebox'),
  };
}

export function createPiRuntimeDependencies(): Record<string, string> {
  return {
    '@earendil-works/pi-ai': packagePeerDependencyVersion(tattlerPluginPackageJson, '@earendil-works/pi-ai'),
    '@earendil-works/pi-coding-agent': packageDependencyVersion(cliPackageJson, '@earendil-works/pi-coding-agent'),
    '@mozilla/readability': packageDependencyVersion(webFetchPackageJson, '@mozilla/readability'),
    '@toon-format/toon': packageDependencyVersion(autotoonPackageJson, '@toon-format/toon'),
    'better-sqlite3': packageDependencyVersion(tattlerPluginPackageJson, 'better-sqlite3'),
    jsdom: packageDependencyVersion(webFetchPackageJson, 'jsdom'),
    'sandpiper-ai-core': 'file:./packages/core',
    'sandpiper-capability-autotoon': 'file:./packages/capability-autotoon',
    turndown: packageDependencyVersion(webFetchPackageJson, 'turndown'),
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
    description: 'Host-neutral AutoTOON JSON to TOON conversion',
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

export function createSystemExtensionPackageJson(rootPackageJson: RootPackageJson): SupportPackageJson {
  return {
    name: 'sandpiper-system',
    version: rootPackageJson.version,
    type: 'module',
    description: 'Pi extension: Sandpiper identity and system capabilities',
    dependencies: {
      'sandpiper-ai-core': 'file:../../packages/core',
    },
    peerDependencies: createPiPeerDependencies(systemPackageJson),
    pi: {
      extensions: ['./index.ts'],
    },
  };
}

// export function createShellRelayExtensionPackageJson(rootPackageJson: RootPackageJson): SupportPackageJson {
//   return {
//     name: 'shell-relay',
//     version: rootPackageJson.version,
//     type: 'module',
//     description: 'Pi extension: shared terminal session between user and agent via Zellij',
//     dependencies: {
//       'sandpiper-ai-core': 'file:../../packages/core',
//     },
//     peerDependencies: {
//       '@earendil-works/pi-coding-agent': packagePeerDependencyVersion(
//         shellRelayPackageJson,
//         '@earendil-works/pi-coding-agent',
//       ),
//       typebox: packagePeerDependencyVersion(shellRelayPackageJson, 'typebox'),
//     },
//     pi: {
//       extensions: ['./src/index.ts'],
//     },
//   };
// }

export function createWebFetchExtensionPackageJson(rootPackageJson: RootPackageJson): SupportPackageJson {
  return {
    name: 'web-fetch',
    version: rootPackageJson.version,
    type: 'module',
    description: 'Pi extension: fetch web pages and return clean markdown content',
    dependencies: {
      '@mozilla/readability': packageDependencyVersion(webFetchPackageJson, '@mozilla/readability'),
      jsdom: packageDependencyVersion(webFetchPackageJson, 'jsdom'),
      turndown: packageDependencyVersion(webFetchPackageJson, 'turndown'),
    },
    peerDependencies: {
      '@earendil-works/pi-coding-agent': packagePeerDependencyVersion(
        webFetchPackageJson,
        '@earendil-works/pi-coding-agent',
      ),
      typebox: packagePeerDependencyVersion(webFetchPackageJson, 'typebox'),
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
    description: 'AutoTOON Pi extension — JSON to TOON conversion on tool results',
    dependencies: {
      'sandpiper-capability-autotoon': 'file:../../packages/capability-autotoon',
    },
    peerDependencies: {
      '@earendil-works/pi-coding-agent': packagePeerDependencyVersion(
        autotoonExtensionPackageJson,
        '@earendil-works/pi-coding-agent',
      ),
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
      join(outputDir, 'extensions', 'system', 'package.json'),
      createSystemExtensionPackageJson(rootPackageJson),
    ),
    // writeJson(
    //   join(outputDir, 'extensions', 'shell-relay', 'package.json'),
    //   createShellRelayExtensionPackageJson(rootPackageJson),
    // ),
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
