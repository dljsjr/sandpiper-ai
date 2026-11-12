import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BUNDLE_MARKER = '<script data-prompt-markdown-bundle></script>';

/** Puts the Markdown editor bundle in the page, before the page's own script. */
export function inlineEditorBundle(html: string, bundle: string): string {
  if (!html.includes(BUNDLE_MARKER)) {
    throw new Error('Markdown editor bundle insertion point is missing');
  }
  const safeBundle = bundle.replaceAll('</script', '<\\/script');
  return html.replace(BUNDLE_MARKER, () => `<script>${safeBundle}</script>`);
}

/**
 * The editor page with `page/prompt-markdown.ts` built into it as an IIFE. Import this as a Bun macro
 * (`with { type: 'macro' }`): it runs when Bun transpiles the importer, so `bun run build` embeds the finished page
 * in `dist/`, and a run from source builds it when the editor loads.
 */
export function promptEditorPage(): string {
  const html = readFileSync(new URL('./page/prompt-editor.html', import.meta.url), 'utf-8');
  const entry = fileURLToPath(new URL('./page/prompt-markdown.ts', import.meta.url));
  const bundle = execFileSync(process.execPath, ['build', entry, '--target=browser', '--format=iife', '--minify'], {
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return inlineEditorBundle(html, bundle);
}
