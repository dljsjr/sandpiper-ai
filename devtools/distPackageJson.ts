#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';

import rootJson from '../package.json' with { type: 'json' };

const distJson = {
  name: rootJson.name,
  version: rootJson.version,
  piConfig: rootJson.piConfig,
  keywords: rootJson.keywords,
  pi: rootJson.pi,
  license: rootJson.license,
  bin: 'sandpiper',
};

writeFile('../dist/package.json', JSON.stringify(distJson, null, 2));
