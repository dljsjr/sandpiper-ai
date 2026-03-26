import { describe, expect, it } from 'vitest';
import { htmlToMarkdown } from './convert.js';

describe('htmlToMarkdown', () => {
  it('should convert headings', () => {
    const md = htmlToMarkdown('<h1>Title</h1><h2>Subtitle</h2>');
    expect(md).toContain('# Title');
    expect(md).toContain('## Subtitle');
  });

  it('should convert paragraphs', () => {
    const md = htmlToMarkdown('<p>Hello world</p>');
    expect(md).toContain('Hello world');
  });

  it('should convert links', () => {
    const md = htmlToMarkdown('<a href="https://example.com">Example</a>');
    expect(md).toContain('[Example](https://example.com)');
  });

  it('should convert inline code', () => {
    const md = htmlToMarkdown('<p>Use <code>npm install</code> to install</p>');
    expect(md).toContain('`npm install`');
  });

  it('should convert fenced code blocks with language', () => {
    const md = htmlToMarkdown('<pre><code class="language-typescript">const x = 1;</code></pre>');
    expect(md).toContain('```typescript');
    expect(md).toContain('const x = 1;');
    expect(md).toContain('```');
  });

  it('should convert fenced code blocks without language', () => {
    const md = htmlToMarkdown('<pre><code>plain code</code></pre>');
    expect(md).toContain('```');
    expect(md).toContain('plain code');
  });

  it('should convert unordered lists', () => {
    const md = htmlToMarkdown('<ul><li>One</li><li>Two</li></ul>');
    // turndown uses 3-space indent after bullet marker
    expect(md).toContain('-   One');
    expect(md).toContain('-   Two');
  });

  it('should convert bold and italic', () => {
    const md = htmlToMarkdown('<p><strong>bold</strong> and <em>italic</em></p>');
    expect(md).toContain('**bold**');
    expect(md).toContain('*italic*');
  });

  it('should handle empty input', () => {
    expect(htmlToMarkdown('')).toBe('');
  });
});
