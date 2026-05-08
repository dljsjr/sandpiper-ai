#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import rootJson from '../package.json' with { type: 'json' };
import {
  createPiPeerDependencies,
  createPiRuntimeDependencies,
  normalizePackageAuthor,
  normalizePackageRepository,
  type PackageAuthor,
  type PackageRepository,
  type PiConfigJson,
  type PiResourceJson,
  type RootPackageJson,
  writePiArtifactSupportPackageJsons,
} from './piPackageArtifactMetadata.js';

const SANDPIPER_DIST_PI_CONFIG = {
  name: 'sandpiper',
  configDir: '.sandpiper',
  bin: 'sandpiper',
} as const;

export const SANDPIPER_DIST_PI_RESOURCES = {
  extensions: ['./extensions/system', './extensions/shell-relay', './extensions/web-fetch', './extensions/autotoon'],
  skills: ['./skills/sandpiper', './skills/third-party'],
  prompts: ['./prompts'],
  themes: ['./themes'],
} as const;

const SANDPIPER_DIST_KEYWORDS = ['pi-package'] as const;

export interface DistPackageJson {
  readonly name: string;
  readonly version: string;
  readonly type: 'module';
  readonly description: string;
  readonly author?: PackageAuthor;
  readonly homepage?: string;
  readonly repository?: PackageRepository;
  readonly piConfig: PiConfigJson;
  readonly keywords?: readonly string[];
  readonly pi: PiResourceJson;
  readonly license?: string;
  readonly files: readonly [
    'config/',
    'extensions/',
    'modes',
    'core',
    'dist',
    'packages/',
    'prompts/',
    'sandpiper',
    'skills/',
    'themes/',
  ];
  readonly dependencies: Record<string, string>;
  readonly peerDependencies: Record<string, string>;
  readonly bin: {
    readonly sandpiper: './sandpiper';
  };
}

export function createDistPackageJson(rootPackageJson: RootPackageJson): DistPackageJson {
  return {
    name: rootPackageJson.name,
    version: rootPackageJson.version,
    type: 'module',
    description: 'Sandpiper CLI and Pi package distribution',
    author: normalizePackageAuthor(rootPackageJson.author),
    homepage: rootPackageJson.homepage,
    repository: normalizePackageRepository(rootPackageJson.repository),
    piConfig: SANDPIPER_DIST_PI_CONFIG,
    keywords: SANDPIPER_DIST_KEYWORDS,
    pi: SANDPIPER_DIST_PI_RESOURCES,
    license: rootPackageJson.license,
    files: [
      'config/',
      'extensions/',
      'modes',
      'core',
      'dist',
      'packages/',
      'prompts/',
      'sandpiper',
      'skills/',
      'themes/',
    ],
    dependencies: createPiRuntimeDependencies(),
    peerDependencies: createPiPeerDependencies(rootPackageJson),
    bin: {
      sandpiper: './sandpiper',
    },
  };
}

export async function writeDistPackageJson(rootPackageJson: RootPackageJson = rootJson): Promise<void> {
  await writeFile('../dist/package.json', `${JSON.stringify(createDistPackageJson(rootPackageJson), null, 2)}\n`);
  await writePiArtifactSupportPackageJsons('../dist', rootPackageJson);
}

const entrypoint = process.argv[1] === undefined ? undefined : resolve(process.argv[1]);

if (entrypoint === fileURLToPath(import.meta.url)) {
  await writeDistPackageJson();
}
