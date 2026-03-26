import { describe, expect, it } from 'vitest';
import { extractContent } from './extract.js';

const ARTICLE_HTML = `
<html>
<head><title>Test Article</title></head>
<body>
  <nav><a href="/">Home</a></nav>
  <article>
    <h1>Test Article Title</h1>
    <p>By <span class="author">Jane Doe</span></p>
    <p>This is the first paragraph of the article content. It needs to be long enough
    for readability to consider it meaningful content worth extracting. Readability uses
    scoring heuristics based on content length, paragraph density, and other signals.</p>
    <p>Here is another paragraph with more content to boost the readability score.
    The algorithm needs enough text to distinguish article content from boilerplate.
    Additional sentences help establish this as the main content area of the page.</p>
    <p>A third paragraph with a <a href="https://example.com">link to example</a>
    and some <code>inline code</code> for good measure. This gives us enough content
    density for readability to confidently extract the article.</p>
  </article>
  <footer>Copyright 2026</footer>
</body>
</html>
`;

const MINIMAL_HTML = '<html><body><p>Too short</p></body></html>';

describe('extractContent', () => {
  it('should extract article content from well-structured HTML', () => {
    const result = extractContent(ARTICLE_HTML, 'https://example.com/article');
    expect(result).not.toBeNull();
    // Readability extracts title from <title> tag, not <h1>
    expect(result?.title).toBe('Test Article');
    expect(result?.html).toContain('first paragraph');
    expect(result?.html).not.toContain('<nav>');
    expect(result?.html).not.toContain('Copyright');
  });

  it('should extract links from article content', () => {
    const result = extractContent(ARTICLE_HTML, 'https://example.com/article');
    expect(result).not.toBeNull();
    expect(result?.links.length).toBeGreaterThan(0);
    const exampleLink = result?.links.find((l) => l.href.includes('example.com'));
    expect(exampleLink).toBeDefined();
  });

  it('should still extract content from minimal pages', () => {
    // Readability can parse even very short content — it wraps it in a readability container
    const result = extractContent(MINIMAL_HTML, 'https://example.com/minimal');
    expect(result).not.toBeNull();
    expect(result?.html).toContain('Too short');
  });

  it('should handle empty HTML gracefully', () => {
    const result = extractContent('', 'https://example.com/empty');
    expect(result).toBeNull();
  });

  it('should not execute scripts in the HTML', () => {
    const htmlWithScript = `
    <html><body>
      <article>
        <p>Content here with enough text for readability scoring purposes.
        We need several sentences to make this work properly with the algorithm.</p>
        <p>Another paragraph of content for density scoring.</p>
        <p>And a third paragraph to be safe.</p>
      </article>
      <script>throw new Error("should not execute")</script>
    </body></html>`;
    // Should not throw — scripts must not execute
    expect(() => extractContent(htmlWithScript, 'https://example.com')).not.toThrow();
  });
});
