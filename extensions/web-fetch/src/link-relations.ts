/**
 * Link relations a page declares, from the HTTP Link header (RFC 8288) or HTML link elements.
 * Framework-independent — no pi imports.
 */

import { JSDOM } from 'jsdom';

export interface LinkRelation {
  /** Absolute target URL. */
  readonly href: string;
  /** Lowercase relation types. */
  readonly rel: readonly string[];
  /** Lowercase media type, when declared. */
  readonly type?: string;
}

const LINK_VALUE = /<([^>]*)>((?:\s*;\s*[^;,=\s]+(?:\s*=\s*(?:"[^"]*"|[^;,\s]*))?)*)/g;
const LINK_PARAMETER = /;\s*([^;,=\s]+)(?:\s*=\s*(?:"([^"]*)"|([^;,\s]*)))?/g;

function linkRelation(href: string, rel: string, type: string | undefined, baseUrl: string): LinkRelation[] {
  if (!URL.canParse(href, baseUrl)) return [];

  const relationTypes = rel.toLowerCase().split(/\s+/).filter(Boolean);
  const mediaType = type?.trim().toLowerCase();
  return [{ href: new URL(href, baseUrl).toString(), rel: relationTypes, ...(mediaType ? { type: mediaType } : {}) }];
}

export function parseLinkHeader(header: string | undefined, baseUrl: string): readonly LinkRelation[] {
  if (!header) return [];

  return Array.from(header.matchAll(LINK_VALUE)).flatMap(([, target = '', parameters = '']) => {
    const values = new Map<string, string>();
    for (const [, name = '', quoted, bare] of parameters.matchAll(LINK_PARAMETER)) {
      // RFC 8288: the first occurrence of a parameter wins.
      if (!values.has(name.toLowerCase())) values.set(name.toLowerCase(), quoted ?? bare ?? '');
    }
    return linkRelation(target, values.get('rel') ?? '', values.get('type'), baseUrl);
  });
}

export function parseHtmlLinks(html: string, baseUrl: string): readonly LinkRelation[] {
  const dom = new JSDOM(html, { url: baseUrl, runScripts: undefined, resources: undefined, pretendToBeVisual: false });

  return Array.from(dom.window.document.querySelectorAll('link[rel][href]')).flatMap((link) =>
    linkRelation(
      link.getAttribute('href') ?? '',
      link.getAttribute('rel') ?? '',
      link.getAttribute('type') ?? undefined,
      dom.window.document.baseURI,
    ),
  );
}

/** The llms.txt file a page says describes it. `describedby` is a general relation, so the file name is checked too. */
export function findLlmsTxtLink(relations: readonly LinkRelation[]): string | undefined {
  return relations.find(
    (relation) => relation.rel.includes('describedby') && new URL(relation.href).pathname.endsWith('/llms.txt'),
  )?.href;
}

/** A Markdown version of the page, on the page's own origin. */
export function findMarkdownAlternate(relations: readonly LinkRelation[], pageUrl: string): string | undefined {
  const page = new URL(pageUrl);

  return relations.find(
    (relation) =>
      relation.rel.includes('alternate') &&
      relation.type === 'text/markdown' &&
      new URL(relation.href).origin === page.origin &&
      relation.href !== page.toString(),
  )?.href;
}
