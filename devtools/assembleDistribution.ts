#!/usr/bin/env bun

import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { chmod } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeDistPackageJson } from './distPackageJson.js';

const DEVTOOLS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(DEVTOOLS_DIR);
const DIST_DIR = join(REPO_ROOT, 'dist');
const RESOURCE_DIR = join(REPO_ROOT, 'packages', 'resources');

const EXCLUDED_FILE_NAMES = new Set([
  '.gitignore',
  '.keep',
  'package.json',
  'tsconfig.json',
  'vitest.config.ts',
  'bun.lock',
]);
const EXCLUDED_DIR_NAMES = new Set(['node_modules', 'dist', 'cli']);
const EXCLUDED_FILE_SUFFIXES = ['.test.ts', '.test.js', '.log', '.pid', '.tsbuildinfo'] as const;

const SOURCE_SKILL_SCRIPT_PATHS = [
  join(RESOURCE_DIR, 'skills', 'sandpiper', 'tasks', 'scripts', 'trail'),
  join(RESOURCE_DIR, 'skills', 'sandpiper', 'tasks', 'scripts', 'sandpiper-tasks'),
  join(RESOURCE_DIR, 'skills', 'sandpiper', 'standup', 'scripts', 'sandpiper-standup'),
] as const;

function remove(path: string): void {
  rmSync(path, { recursive: true, force: true });
}

function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

function pathExists(path: string): boolean {
  return existsSync(path);
}

function isExcludedPath(sourcePath: string, root: string): boolean {
  const relativePath = relative(root, sourcePath);
  if (relativePath === '') return false;

  const basename = sourcePath.split(/[\\/]/).at(-1) ?? sourcePath;
  if (EXCLUDED_FILE_NAMES.has(basename)) return true;
  if (EXCLUDED_FILE_SUFFIXES.some((suffix) => basename.endsWith(suffix))) return true;
  if (basename.endsWith('-workspace')) return true;

  try {
    if (lstatSync(sourcePath).isDirectory() && EXCLUDED_DIR_NAMES.has(basename)) return true;
  } catch {
    return true;
  }

  return false;
}

function copyTree(source: string, destination: string): void {
  if (!pathExists(source)) return;
  remove(destination);
  ensureDir(dirname(destination));
  cpSync(source, destination, {
    recursive: true,
    filter: (sourcePath) => !isExcludedPath(sourcePath, source),
  });
}

function copyDirectoryContents(source: string, destination: string): void {
  if (!pathExists(source)) return;
  ensureDir(destination);
  for (const entry of readdirSync(source)) {
    const sourcePath = join(source, entry);
    const destinationPath = join(destination, entry);
    remove(destinationPath);
    cpSync(sourcePath, destinationPath, { recursive: true });
  }
}

function copyFile(source: string, destination: string): void {
  if (!pathExists(source)) return;
  ensureDir(dirname(destination));
  remove(destination);
  cpSync(source, destination);
}

async function makeExecutable(path: string): Promise<void> {
  await chmod(path, 0o755);
}

function removeSourceDevSymlinks(): void {
  for (const path of SOURCE_SKILL_SCRIPT_PATHS) {
    remove(path);
  }
}

function copyDistributionRoots(): void {
  remove(DIST_DIR);
  ensureDir(DIST_DIR);

  for (const element of ['extensions', 'packages'] as const) {
    console.log(`⚙ Copying ${element} packages for distribution`);
    copyTree(join(REPO_ROOT, element), join(DIST_DIR, element));
  }

  for (const element of ['themes', 'skills', 'skills-on-demand', 'prompts'] as const) {
    console.log(`⚙ Copying ${element} resources for distribution`);
    copyTree(join(RESOURCE_DIR, element), join(DIST_DIR, element));
  }

  console.log('⚙ Copying public docs for distribution');
  copyTree(join(REPO_ROOT, 'docs'), join(DIST_DIR, 'docs'));
  copyFile(join(REPO_ROOT, 'README.md'), join(DIST_DIR, 'README.md'));
}

function copyPackageBuildOutputs(): void {
  const packagesDir = join(REPO_ROOT, 'packages');
  for (const packageName of readdirSync(packagesDir)) {
    if (packageName === 'cli') continue;

    const packageDir = join(packagesDir, packageName);
    const packageDistDir = join(packageDir, 'dist');
    if (!pathExists(packageDistDir)) continue;

    copyDirectoryContents(packageDistDir, join(DIST_DIR, 'packages', packageName));
  }

  copyDirectoryContents(join(REPO_ROOT, 'packages', 'cli', 'dist'), DIST_DIR);
}

async function copySkillHelperBinaries(): Promise<void> {
  const helpers = [
    {
      source: join(DIST_DIR, 'packages', 'trail', 'trail'),
      destinations: [
        join(DIST_DIR, 'trail'),
        join(DIST_DIR, 'sandpiper-tasks'),
        join(DIST_DIR, 'skills', 'sandpiper', 'tasks', 'scripts', 'trail'),
        join(DIST_DIR, 'skills', 'sandpiper', 'tasks', 'scripts', 'sandpiper-tasks'),
        join(DIST_DIR, 'packages', 'resources', 'skills', 'sandpiper', 'tasks', 'scripts', 'trail'),
        join(DIST_DIR, 'packages', 'resources', 'skills', 'sandpiper', 'tasks', 'scripts', 'sandpiper-tasks'),
      ],
    },
    {
      source: join(DIST_DIR, 'packages', 'sandpiper-standup-cli', 'sandpiper-standup'),
      destinations: [
        join(DIST_DIR, 'skills', 'sandpiper', 'standup', 'scripts', 'sandpiper-standup'),
        join(DIST_DIR, 'packages', 'resources', 'skills', 'sandpiper', 'standup', 'scripts', 'sandpiper-standup'),
      ],
    },
  ] as const;

  for (const helper of helpers) {
    for (const destination of helper.destinations) {
      copyFile(helper.source, destination);
      await makeExecutable(destination);
    }
  }
}

function copyExtensionPackageJsons(): void {
  for (const extensionName of readdirSync(join(REPO_ROOT, 'extensions'))) {
    const sourcePackageJson = join(REPO_ROOT, 'extensions', extensionName, 'package.json');
    if (pathExists(sourcePackageJson)) {
      copyFile(sourcePackageJson, join(DIST_DIR, 'extensions', extensionName, 'package.json'));
    }
  }
}

function resolvePiPackageDir(): string {
  const upstreamPiDistEntrypoint = fileURLToPath(import.meta.resolve('@earendil-works/pi-coding-agent'));
  return dirname(dirname(upstreamPiDistEntrypoint));
}

// The only directories Pi resolves under PI_PACKAGE_DIR at runtime: getThemesDir(),
// getInteractiveAssetsDir(), and getExportTemplateDir() in Pi's config.ts. Pi's code itself
// loads from node_modules.
const PI_RUNTIME_ASSET_DIRS = [
  ['dist', 'modes', 'interactive', 'theme'],
  ['dist', 'modes', 'interactive', 'assets'],
  ['dist', 'core', 'export-html'],
] as const;

function copyPiRuntimeAssets(): void {
  const piPackageDir = resolvePiPackageDir();
  console.log('⚙ Copying Pi runtime assets');
  for (const segments of PI_RUNTIME_ASSET_DIRS) {
    copyTree(join(piPackageDir, ...segments), join(DIST_DIR, ...segments));
  }
}

async function ensureSkillReviewGuide(): Promise<void> {
  const guideRelativePath = join(
    'skills-on-demand',
    'sandpiper',
    'skill-review',
    'references',
    'skill-building-guide.pdf',
  );
  const guidePaths = [
    join(DIST_DIR, guideRelativePath),
    join(DIST_DIR, 'packages', 'resources', guideRelativePath),
  ] as const;
  const guideUrl = 'https://resources.anthropic.com/hubfs/The-Complete-Guide-to-Building-Skill-for-Claude.pdf';

  console.log('⬇ Downloading skill-building-guide.pdf...');
  const response = await fetch(guideUrl);
  if (!response.ok) {
    throw new Error(`Could not download skill-building-guide.pdf: ${response.status} ${response.statusText}`);
  }

  const guideBytes = Buffer.from(await response.arrayBuffer());
  for (const guidePath of guidePaths) {
    ensureDir(dirname(guidePath));
    writeFileSync(guidePath, guideBytes);
  }
  console.log('✓ Downloaded skill-building-guide.pdf');
}

async function createSourceDevHelperCopies(): Promise<void> {
  console.log('⚙ Creating dev-mode skill helper copies');
  const helpers = [
    {
      source: join(DIST_DIR, 'packages', 'trail', 'trail'),
      destinations: [
        join(RESOURCE_DIR, 'skills', 'sandpiper', 'tasks', 'scripts', 'trail'),
        join(RESOURCE_DIR, 'skills', 'sandpiper', 'tasks', 'scripts', 'sandpiper-tasks'),
      ],
    },
    {
      source: join(DIST_DIR, 'packages', 'sandpiper-standup-cli', 'sandpiper-standup'),
      destinations: [join(RESOURCE_DIR, 'skills', 'sandpiper', 'standup', 'scripts', 'sandpiper-standup')],
    },
  ] as const;

  for (const { source, destinations } of helpers) {
    for (const destination of destinations) {
      copyFile(source, destination);
      await makeExecutable(destination);
    }
  }
}

async function assembleDistribution(): Promise<void> {
  removeSourceDevSymlinks();
  copyDistributionRoots();
  copyPackageBuildOutputs();
  await copySkillHelperBinaries();
  copyExtensionPackageJsons();

  console.log('⚙ Generating CLI distribution package.json');
  await writeDistPackageJson();
  console.log('✓ Generated distribution package.json');

  copyPiRuntimeAssets();
  await ensureSkillReviewGuide();
  await createSourceDevHelperCopies();
}

await assembleDistribution();
