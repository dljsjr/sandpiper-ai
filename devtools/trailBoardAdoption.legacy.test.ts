import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveStorageConfig } from '../packages/trail/src/core/storage-config.js';
import {
  fileManifest,
  legacyAdoptionFixtures,
  writeBoardFixture,
  writeFixtureFiles,
} from './trailBoardAdoption.fixtures.js';

describe('legacy board configuration characterization', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), 'trail-adoption-legacy-'));
    writeBoardFixture(rootDir);
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  it.each(legacyAdoptionFixtures)('$name', ({ files, expected }) => {
    writeFixtureFiles(rootDir, files);
    const before = fileManifest(rootDir);

    const config = resolveStorageConfig(rootDir);

    expect(config.version_control).toEqual(expected);
    expect(fileManifest(rootDir)).toEqual(before);
  });
});
