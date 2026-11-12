import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { inlineEditorBundle } from './page_assets.js';

const bun = process.env.BUN_EXECUTABLE ?? 'bun';

describe('inlineEditorBundle', () => {
  it('inlines the bundled Markdown editor before the controller', () => {
    const html = [
      '<body>',
      '<script data-prompt-markdown-bundle></script>',
      '<script>window.controllerReady = true;</script>',
      '</body>',
    ].join('\n');

    const result = inlineEditorBundle(html, "window.promptMarkdown = { ready: true, source: '$&' };");

    expect(result).toContain("window.promptMarkdown = { ready: true, source: '$&' };");
    expect(result.indexOf('window.promptMarkdown')).toBeLessThan(result.indexOf('window.controllerReady'));
    expect(result).not.toContain('data-prompt-markdown-bundle');
  });

  it('keeps a closing script tag in the bundle from ending the inline script', () => {
    const result = inlineEditorBundle('<script data-prompt-markdown-bundle></script>', "x = '</script>';");

    expect(result).toBe("<script>x = '<\\/script>';</script>");
  });

  it('rejects a page without the bundle insertion point', () => {
    expect(() => inlineEditorBundle('<body></body>', 'bundle')).toThrow(
      'Markdown editor bundle insertion point is missing',
    );
  });
});

describe('promptEditorPage', () => {
  it('builds the framework-free Markdown editor into the page', () => {
    const assets = fileURLToPath(new URL('./page_assets.ts', import.meta.url));
    const script = `import { promptEditorPage } from ${JSON.stringify(assets)}; process.stdout.write(promptEditorPage());`;

    const page = execFileSync(bun, ['-e', script], { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });

    expect(page).toContain('window.promptMarkdown');
    expect(page).not.toContain('data-prompt-markdown-bundle');
    expect(page).not.toContain('<script src=');
    expect(page).not.toContain('cdn.jsdelivr');
    expect(page.indexOf('window.promptMarkdown')).toBeLessThan(page.indexOf('window.promptEditor ='));
  });
});
