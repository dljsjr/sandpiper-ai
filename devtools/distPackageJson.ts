#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import rootJson from '../package.json' with { type: 'json' };

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
  readonly piConfig: PiConfigJson;
  readonly keywords?: readonly string[];
  readonly pi: PiResourceJson;
  readonly license?: string;
}

export interface DistPackageJson {
  readonly name: string;
  readonly version: string;
  readonly piConfig: PiConfigJson;
  readonly keywords?: readonly string[];
  readonly pi: PiResourceJson;
  readonly license?: string;
  readonly bin: 'sandpiper';
}

export function createDistPackageJson(rootPackageJson: RootPackageJson): DistPackageJson {
  return {
    name: rootPackageJson.name,
    version: rootPackageJson.version,
    piConfig: rootPackageJson.piConfig,
    keywords: rootPackageJson.keywords,
    pi: rootPackageJson.pi,
    license: rootPackageJson.license,
    bin: 'sandpiper',
  };
}

export async function writeDistPackageJson(rootPackageJson: RootPackageJson = rootJson): Promise<void> {
  await writeFile('../dist/package.json', JSON.stringify(createDistPackageJson(rootPackageJson), null, 2));
}

const entrypoint = process.argv[1] === undefined ? undefined : resolve(process.argv[1]);

if (entrypoint === fileURLToPath(import.meta.url)) {
  await writeDistPackageJson();
}
