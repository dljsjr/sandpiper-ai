#!/usr/bin/env node

import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

await mkdir('./dist', { recursive: true });
const targetDistDir = resolve('./dist');
await cp('package.json', `${targetDistDir}/package.json`);

const readmeData = await readFile('README.md');
await writeFile(`${targetDistDir}/README.md`, `> See also: [./pi-README.md]\n${readmeData}`);

const changelogData = await readFile('CHANGELOG.md');
await writeFile(`${targetDistDir}/CHANGELOG.md`, `> See also: [./pi-CHANGELOG.md]\n${changelogData}`);
