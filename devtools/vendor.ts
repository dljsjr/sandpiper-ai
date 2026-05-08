#!/usr/bin/env bun

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEVTOOLS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(DEVTOOLS_DIR);
const MANIFEST_PATH = join(REPO_ROOT, 'vendor.txt');

interface VendorEntry {
  readonly url: string;
  readonly destination: string;
}

interface GitHubTreeUrl {
  readonly owner: string;
  readonly repo: string;
  readonly ref: string;
  readonly path: string;
}

interface GitHubContentEntry {
  readonly type: 'file' | 'dir' | string;
  readonly path: string;
  readonly name: string;
  readonly download_url?: string | null;
}

function parseVendorManifest(content: string): VendorEntry[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*$/, '').trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const [url, destination, ...extra] = line.split(/\s+/);
      if (url === undefined || destination === undefined || extra.length > 0) {
        throw new Error(`Malformed vendor entry: ${line}`);
      }
      return { url, destination: resolveDestination(destination) };
    });
}

function resolveDestination(destination: string): string {
  if (destination.startsWith('./')) return join(REPO_ROOT, destination.slice(2));
  if (destination.startsWith('/')) return destination;
  return join(REPO_ROOT, destination);
}

function parseGitHubTreeUrl(url: string): GitHubTreeUrl {
  const match = /^https:\/\/github\.com\/(?<owner>[^/]+)\/(?<repo>[^/]+)\/tree\/(?<ref>[^/]+)\/(?<path>.+)$/.exec(url);
  const groups = match?.groups;
  if (groups === undefined) {
    throw new Error(`URL must be a GitHub tree URL: ${url}`);
  }

  const { owner, repo, ref, path } = groups;
  if (owner === undefined || repo === undefined || ref === undefined || path === undefined) {
    throw new Error(`Could not parse GitHub tree URL: ${url}`);
  }

  return { owner, repo, ref, path };
}

function githubHeaders(): HeadersInit {
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  return token === undefined
    ? { Accept: 'application/vnd.github+json' }
    : { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}` };
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: githubHeaders() });
  if (!response.ok) {
    throw new Error(`GitHub request failed for ${url}: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url, { headers: githubHeaders() });
  if (!response.ok) {
    throw new Error(`GitHub download failed for ${url}: ${response.status} ${response.statusText}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

async function listGitHubDirectory(treeUrl: GitHubTreeUrl, path: string): Promise<GitHubContentEntry[]> {
  const apiUrl = new URL(
    `https://api.github.com/repos/${treeUrl.owner}/${treeUrl.repo}/contents/${encodeURIComponent(path).replaceAll('%2F', '/')}`,
  );
  apiUrl.searchParams.set('ref', treeUrl.ref);
  const response = await fetchJson<GitHubContentEntry | GitHubContentEntry[]>(apiUrl.toString());
  return Array.isArray(response) ? response : [response];
}

async function downloadGitHubDirectory(
  treeUrl: GitHubTreeUrl,
  sourcePath: string,
  destinationRoot: string,
): Promise<void> {
  const entries = await listGitHubDirectory(treeUrl, sourcePath);

  for (const entry of entries) {
    const relativePath = entry.path.slice(treeUrl.path.length).replace(/^\//, '');
    const destination = join(destinationRoot, relativePath);

    if (entry.type === 'dir') {
      mkdirSync(destination, { recursive: true });
      await downloadGitHubDirectory(treeUrl, entry.path, destinationRoot);
      continue;
    }

    if (entry.type !== 'file' || entry.download_url === undefined || entry.download_url === null) {
      continue;
    }

    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, await fetchBytes(entry.download_url));
  }
}

async function vendorEntry(entry: VendorEntry, ifMissing: boolean): Promise<'downloaded' | 'skipped'> {
  if (ifMissing && existsSync(entry.destination)) {
    return 'skipped';
  }

  const treeUrl = parseGitHubTreeUrl(entry.url);
  console.log(`Fetching ${treeUrl.owner}/${treeUrl.repo}/${treeUrl.path}@${treeUrl.ref}...`);
  rmSync(entry.destination, { recursive: true, force: true });
  mkdirSync(entry.destination, { recursive: true });
  await downloadGitHubDirectory(treeUrl, treeUrl.path, entry.destination);
  console.log(`✓ ${entry.destination}`);
  return 'downloaded';
}

const ifMissing = process.argv.includes('--if-missing');
const entries = parseVendorManifest(readFileSync(MANIFEST_PATH, 'utf-8'));
let downloaded = 0;
let skipped = 0;

for (const entry of entries) {
  const result = await vendorEntry(entry, ifMissing);
  if (result === 'downloaded') downloaded += 1;
  if (result === 'skipped') skipped += 1;
}

if (downloaded === 0 && skipped > 0) {
  console.log(`All ${skipped} vendored entries already present.`);
} else if (downloaded > 0) {
  console.log(`Downloaded ${downloaded} vendored entry/entries.`);
}
