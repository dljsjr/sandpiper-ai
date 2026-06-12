/**
 * Task search — local, dependency-free, deterministic.
 *
 * This module owns a private BM25 implementation rather than depending on a
 * shelf search library. This is an intentional design choice: Trail is a CLI
 * tool with no service or database, so search must work offline, with zero
 * external dependencies, and produce deterministic ranking from the same
 * input. The Rust port will likely replace this with a Tantivy-based index,
 * but until then, the constraint is: local-only, no deps, same answer every
 * time.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { TASK_FILE_RE, TASK_KEY_RE } from './patterns.js';

const ARCHIVE_DIR = 'archive';

/** Options to narrow the search scope. */
export interface SearchScope {
  readonly project?: string;
  readonly parent?: string;
}

/** Options selecting the search backend and result truncation. */
export interface SearchOptions {
  /** Use regular expression matching instead of literal/full-text matching. */
  readonly regex?: boolean;
  /** Use ripgrep instead of the built-in TypeScript search backend. */
  readonly ripgrep?: boolean;
  /** Truncate by backend ranking before task-list sorting. */
  readonly limit?: number;
}

interface SearchDocument {
  readonly key: string;
  readonly path: string;
  readonly content: string;
}

interface IndexedDocument extends SearchDocument {
  readonly tokens: readonly string[];
}

interface ScoredDocument {
  readonly document: SearchDocument;
  readonly score: number;
}

/**
 * Search task files for text and return matching task keys in backend ranking order.
 *
 * Default search uses BM25 over task markdown content. Passing regex=true uses the
 * built-in JavaScript RegExp engine. Passing ripgrep=true delegates to ripgrep;
 * with regex=false that is literal string search, and with regex=true it is rg's
 * regular expression search.
 *
 * @param tasksDir - Path to the .sandpiper/tasks directory
 * @param pattern - Text pattern to search for (case insensitive)
 * @param scope - Optional scope narrowing (project, parent)
 * @param options - Search backend and truncation options
 */
export function searchTasks(
  tasksDir: string,
  pattern: string,
  scope?: SearchScope,
  options: SearchOptions = {},
): readonly string[] {
  const searchDir = resolveSearchDir(tasksDir, scope);
  if (!existsSync(searchDir)) {
    return [];
  }

  const keys = options.ripgrep
    ? searchWithRipgrep(searchDir, pattern, options.regex ?? false)
    : options.regex
      ? searchWithJavaScriptRegex(searchDir, pattern)
      : searchWithBm25(searchDir, pattern);

  return options.limit !== undefined ? keys.slice(0, options.limit) : keys;
}

/**
 * Resolve the directory to search based on scope narrowing.
 */
function resolveSearchDir(tasksDir: string, scope?: SearchScope): string {
  if (!scope) return tasksDir;

  let dir = tasksDir;
  if (scope.project) {
    dir = join(dir, scope.project);
  }
  if (scope.parent) {
    dir = join(dir, scope.parent);
  }
  return dir;
}

function searchWithBm25(searchDir: string, pattern: string): readonly string[] {
  const documents = collectTaskDocuments(searchDir);
  const index = new Bm25SearchIndex(documents);
  return index.search(pattern).map((result) => result.document.key);
}

function searchWithJavaScriptRegex(searchDir: string, pattern: string): readonly string[] {
  let re: RegExp;
  try {
    re = new RegExp(pattern, 'i');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid regex pattern: ${message}`);
  }

  return collectTaskDocuments(searchDir)
    .filter((document) => re.test(document.content))
    .map((document) => document.key);
}

function searchWithRipgrep(searchDir: string, pattern: string, regex: boolean): readonly string[] {
  const args = [
    '--files-with-matches',
    '--ignore-case',
    '--glob',
    '*.md',
    '--glob',
    `!**/${ARCHIVE_DIR}/**`,
    ...(regex ? [] : ['--fixed-strings']),
    '--',
    pattern,
    searchDir,
  ];

  try {
    const output = execFileSync('rg', args, {
      encoding: 'utf-8',
      timeout: 10_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return extractTaskKeys(output);
  } catch (error) {
    if (isProcessError(error) && error.status === 1) {
      return [];
    }

    const detail = isProcessError(error) && error.stderr ? `\n${String(error.stderr).trim()}` : '';
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`ripgrep search failed: ${message}${detail}`);
  }
}

function isProcessError(
  error: unknown,
): error is Error & { readonly status?: number; readonly stderr?: Buffer | string } {
  return error instanceof Error;
}

function collectTaskDocuments(searchDir: string): readonly SearchDocument[] {
  const documents: SearchDocument[] = [];
  collectTaskDocumentsInto(searchDir, documents);
  return documents;
}

function collectTaskDocumentsInto(dir: string, documents: SearchDocument[]): void {
  if (!existsSync(dir)) {
    return;
  }

  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== ARCHIVE_DIR) {
        collectTaskDocumentsInto(path, documents);
      }
      continue;
    }

    if (!entry.isFile() || !TASK_FILE_RE.test(entry.name)) {
      continue;
    }

    documents.push({
      key: basename(entry.name, '.md'),
      path,
      content: readFileSync(path, 'utf-8'),
    });
  }
}

/**
 * Extract task keys from rg output (one file path per line).
 */
function extractTaskKeys(output: string): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const line of output.trim().split('\n')) {
    if (!line) continue;
    const filename = basename(line, '.md');
    if (TASK_KEY_RE.test(filename) && !seen.has(filename)) {
      seen.add(filename);
      keys.push(filename);
    }
  }
  return keys;
}

class Bm25SearchIndex {
  private readonly documents: readonly IndexedDocument[];
  private readonly documentFrequency = new Map<string, number>();
  private readonly averageDocumentLength: number;
  private readonly k1 = 1.2;
  private readonly b = 0.75;

  constructor(documents: readonly SearchDocument[]) {
    this.documents = documents.map((document) => ({ ...document, tokens: tokenizeForBm25(document.content) }));
    this.averageDocumentLength = average(this.documents.map((document) => document.tokens.length)) || 1;

    for (const document of this.documents) {
      for (const token of new Set(document.tokens)) {
        this.documentFrequency.set(token, (this.documentFrequency.get(token) ?? 0) + 1);
      }
    }
  }

  search(query: string): readonly ScoredDocument[] {
    const queryTokens = tokenizeForBm25(query);
    return this.documents
      .map((document) => ({ document, score: this.scoreDocument(queryTokens, document) }))
      .filter((result) => result.score > 0)
      .sort((left, right) => right.score - left.score || left.document.key.localeCompare(right.document.key));
  }

  private scoreDocument(queryTokens: readonly string[], document: IndexedDocument): number {
    if (queryTokens.length === 0 || document.tokens.length === 0) return 0;

    const termFrequency = termFrequencyMap(document.tokens);
    return queryTokens.reduce((score, token) => {
      const frequency = termFrequency.get(token) ?? 0;
      if (frequency === 0) return score;
      return score + this.inverseDocumentFrequency(token) * this.termSaturation(frequency, document.tokens.length);
    }, 0);
  }

  private inverseDocumentFrequency(token: string): number {
    const documentCount = this.documents.length;
    const frequency = this.documentFrequency.get(token) ?? 0;
    return Math.log(1 + (documentCount - frequency + 0.5) / (frequency + 0.5));
  }

  private termSaturation(frequency: number, documentLength: number): number {
    const denominator = frequency + this.k1 * (1 - this.b + this.b * (documentLength / this.averageDocumentLength));
    return (frequency * (this.k1 + 1)) / denominator;
  }
}

function tokenizeForBm25(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/`([^`]+)`/g, ' $1 ')
    .split(/[^a-z0-9_@./~-]+/)
    .map((token) => token.replace(/[.!?]+$/g, ''))
    .filter((token) => token.length > 1);
}

function termFrequencyMap(tokens: readonly string[]): Map<string, number> {
  const frequencies = new Map<string, number>();
  for (const token of tokens) frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
  return frequencies;
}

function average(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}
