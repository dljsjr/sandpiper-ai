/**
 * Link relations a page declares, from the HTTP Link header (RFC 8288) or HTML link elements.
 * Framework-independent — no pi imports.
 */

import { JSDOM } from 'jsdom';
import type { PageLink, PageLinks } from './types.js';

export interface LinkRelation {
  /** Absolute target URL. */
  readonly href: string;
  /** Lowercase relation types. */
  readonly rel: readonly string[];
  /** Lowercase media type, when declared. */
  readonly type?: string;
  /** Human-readable title with its whitespace collapsed, when declared. */
  readonly title?: string;
}

interface LinkAttributes {
  readonly rel: string;
  readonly type?: string;
  readonly title?: string;
}

const LINK_VALUE = /<([^>]*)>((?:\s*;\s*[^;,=\s]+(?:\s*=\s*(?:"[^"]*"|[^;,\s]*))?)*)/g;
const LINK_PARAMETER = /;\s*([^;,=\s]+)(?:\s*=\s*(?:"([^"]*)"|([^;,\s]*)))?/g;

function linkRelation(href: string, attributes: LinkAttributes, baseUrl: string): LinkRelation[] {
  if (!URL.canParse(href, baseUrl)) return [];

  const relationTypes = attributes.rel.toLowerCase().split(/\s+/).filter(Boolean);
  const mediaType = attributes.type?.trim().toLowerCase();
  const title = attributes.title?.replace(/\s+/g, ' ').trim();
  return [
    {
      href: new URL(href, baseUrl).toString(),
      rel: relationTypes,
      ...(mediaType ? { type: mediaType } : {}),
      ...(title ? { title } : {}),
    },
  ];
}

/** An RFC 8187 extended value such as `UTF-8''Caf%C3%A9`. Other charsets are not decoded. */
function decodeExtendedValue(value: string | undefined): string | undefined {
  const match = value?.match(/^utf-8'[^']*'(.*)$/i);
  if (!match) return undefined;
  try {
    return decodeURIComponent(match[1] ?? '');
  } catch {
    return undefined;
  }
}

export function parseLinkHeader(header: string | undefined, baseUrl: string): readonly LinkRelation[] {
  if (!header) return [];

  return Array.from(header.matchAll(LINK_VALUE)).flatMap(([, target = '', parameters = '']) => {
    const values = new Map<string, string>();
    for (const [, name = '', quoted, bare] of parameters.matchAll(LINK_PARAMETER)) {
      // RFC 8288: the first occurrence of a parameter wins.
      if (!values.has(name.toLowerCase())) values.set(name.toLowerCase(), quoted ?? bare ?? '');
    }
    // RFC 8288: title* takes precedence over title.
    const title = decodeExtendedValue(values.get('title*')) ?? values.get('title');
    return linkRelation(target, { rel: values.get('rel') ?? '', type: values.get('type'), title }, baseUrl);
  });
}

export function parseHtmlLinks(html: string, baseUrl: string): readonly LinkRelation[] {
  const dom = new JSDOM(html, { url: baseUrl, runScripts: undefined, resources: undefined, pretendToBeVisual: false });

  return Array.from(dom.window.document.querySelectorAll('link[rel][href]')).flatMap((link) =>
    linkRelation(
      link.getAttribute('href') ?? '',
      {
        rel: link.getAttribute('rel') ?? '',
        type: link.getAttribute('type') ?? undefined,
        title: link.getAttribute('title') ?? undefined,
      },
      dom.window.document.baseURI,
    ),
  );
}

/**
 * The llms.txt file a page declares. llms.txt names `describedby`, and GitHub Docs uses `index`. Both are general
 * relations, so the file name is checked too.
 */
export function findLlmsTxtLink(relations: readonly LinkRelation[]): string | undefined {
  return relations.find(
    (relation) =>
      (relation.rel.includes('describedby') || relation.rel.includes('index')) &&
      new URL(relation.href).pathname.endsWith('/llms.txt'),
  )?.href;
}

/** An llms.txt file, or a variant such as llms-full.txt, which covers many pages. */
function isLlmsTxtFile(url: string): boolean {
  return /\/llms[^/]*\.txt$/i.test(new URL(url).pathname);
}

/** A Markdown version of the page, on the page's own origin. */
export function findMarkdownAlternate(relations: readonly LinkRelation[], pageUrl: string): string | undefined {
  const page = new URL(pageUrl);

  return relations.find(
    (relation) =>
      relation.rel.includes('alternate') &&
      relation.type === 'text/markdown' &&
      new URL(relation.href).origin === page.origin &&
      relation.href !== page.toString() &&
      !isLlmsTxtFile(relation.href),
  )?.href;
}

// The Agent Skills Discovery draft defines no relation for advertising its index, so the path identifies it.
const AGENT_SKILLS_INDEX_PATHS: ReadonlySet<string> = new Set([
  '/.well-known/agent-skills/index.json',
  '/.well-known/skills/index.json',
]);

function pageLink(relation: LinkRelation | undefined): PageLink | undefined {
  if (!relation) return undefined;
  return { url: relation.href, ...(relation.title ? { title: relation.title } : {}) };
}

/** The links that lead an agent from the page to more information. Undefined when the page declares none. */
export function findPageLinks(relations: readonly LinkRelation[], pageUrl: string): PageLinks | undefined {
  const page = new URL(pageUrl).toString();
  const others = relations.filter((relation) => relation.href !== page);
  const declared = (...types: string[]) =>
    pageLink(others.find((relation) => types.some((type) => relation.rel.includes(type))));

  const links: PageLinks = {
    canonical: declared('canonical'),
    latestVersion: declared('latest-version'),
    prev: declared('prev', 'previous'),
    next: declared('next'),
    up: declared('up'),
    agentSkills: pageLink(others.find((relation) => AGENT_SKILLS_INDEX_PATHS.has(new URL(relation.href).pathname))),
  };
  return Object.values(links).some((link) => link !== undefined) ? links : undefined;
}
