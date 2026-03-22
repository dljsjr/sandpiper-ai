#!/usr/bin/env bun

process.title = 'sandpiper';

import { glob, mkdir, mkdtemp, readFile, realpath, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { $ } from 'bun';

const systemPiDistDir = await $`which pi`
  .text()
  .then((cmd) => {
    return realpath(cmd).then((resolved) => resolved.toString());
  })
  .then(dirname);
const systemPiPackageDir = dirname(systemPiDistDir);

const overridesPackageDir = await mkdtemp(join(tmpdir(), 'sandpiper-'));
process.env.PI_PACKAGE_DIR = overridesPackageDir;

await symlink(join(dirname(process.execPath), 'CHANGELOG.md'), join(overridesPackageDir, 'CHANGELOG.md'));

await symlink(join(dirname(process.execPath), 'README.md'), join(overridesPackageDir, 'README.md'));

const sandpiperPkgJson = JSON.parse(await readFile(join(dirname(process.execPath), 'package.json'), 'utf-8'));

const piPkgJson = JSON.parse(await readFile(join(systemPiPackageDir, 'package.json'), 'utf-8'));

piPkgJson.piConfig = sandpiperPkgJson.piConfig;

await writeFile(join(overridesPackageDir, 'package.json'), JSON.stringify(piPkgJson));

sandpiperPkgJson;

await symlink(join(systemPiPackageDir, 'CHANGELOG.md'), join(overridesPackageDir, 'pi-CHANGELOG.md'));

await symlink(join(systemPiPackageDir, 'README.md'), join(overridesPackageDir, 'pi-README.md'));

await symlink(join(systemPiPackageDir, 'docs'), join(overridesPackageDir, 'docs'));

await symlink(join(systemPiPackageDir, 'examples'), join(overridesPackageDir, 'examples'));

const symlinkThemesDir = join(overridesPackageDir, 'dist/modes/interactive/theme');
await mkdir(symlinkThemesDir, { recursive: true });

for await (const entry of glob(`${systemPiPackageDir}/dist/modes/interactive/theme/*.json`)) {
  const targetFile = basename(entry);
  await symlink(resolve(entry), `${symlinkThemesDir}/${targetFile}`);
}

const symlinkExportHtmlDir = join(overridesPackageDir, 'dist/core/export-html');
const symlinkExportHtmlVendorDir = join(symlinkExportHtmlDir, 'vendor');
await mkdir(symlinkExportHtmlVendorDir, { recursive: true });

const sourceExportHtmlDir = join(systemPiDistDir, 'core', 'export-html');
await symlink(join(sourceExportHtmlDir, 'template.html'), join(symlinkExportHtmlDir, 'template.html'));

await symlink(join(sourceExportHtmlDir, 'template.css'), join(symlinkExportHtmlDir, 'template.css'));

await symlink(join(sourceExportHtmlDir, 'template.js'), join(symlinkExportHtmlDir, 'template.js'));

for await (const entry of glob(`${sourceExportHtmlDir}/vendor/*.js`)) {
  const targetFile = basename(entry);
  await symlink(resolve(entry), `${symlinkExportHtmlVendorDir}/${targetFile}`);
}

(await import(join(systemPiDistDir, 'main.js'))).main(process.argv.slice(2));
