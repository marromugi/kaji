import { describe, it, expect } from "vitest";
import { kajiFromHtml } from "../../src/kaji.js";

describe("Pipeline", () => {
  it("should handle a minimal HTML document", () => {
    const result = kajiFromHtml("<html><body><p>Hello world</p></body></html>");
    expect(result.markdown).toContain("Hello world");
  });

  it("should extract article from page with sidebar and nav", () => {
    const html = `
      <html>
      <body>
        <nav><a href="/">Home</a><a href="/about">About</a></nav>
        <article class="content">
          <h1>Article Title</h1>
          <p>This is the main article content with enough text to be considered a real paragraph by the scoring algorithm.</p>
          <p>Here is another paragraph with sufficient text content, including commas, periods, and other punctuation marks.</p>
        </article>
        <aside class="sidebar">
          <h3>Related</h3>
          <ul><li><a href="/1">Link 1</a></li></ul>
        </aside>
      </body>
      </html>`;
    const result = kajiFromHtml(html);
    expect(result.markdown).toContain("Article Title");
    expect(result.markdown).toContain("main article content");
    expect(result.markdown).not.toContain("Related");
  });

  it("should preserve code blocks with language hints", () => {
    const html = `
      <html><body>
        <article>
          <p>Here is some code that demonstrates a basic function in JavaScript with proper syntax highlighting.</p>
          <pre><code class="language-js">function hello() { return "world"; }</code></pre>
          <p>And that is how you write a simple function in JavaScript with a return statement and string value.</p>
        </article>
      </body></html>`;
    const result = kajiFromHtml(html);
    expect(result.markdown).toContain("```js");
    expect(result.markdown).toContain('function hello()');
    expect(result.markdown).toContain("```");
  });

  it("should handle malformed HTML gracefully", () => {
    const html = "<div><p>unclosed paragraph<div>another div</div>";
    const result = kajiFromHtml(html);
    expect(result.markdown).toBeTruthy();
  });

  it("should extract title from og:title", () => {
    const html = `
      <html>
      <head><meta property="og:title" content="My Article"></head>
      <body>
        <article>
          <p>This is the main article content with enough text to properly score in the extraction algorithm used here.</p>
        </article>
      </body>
      </html>`;
    const result = kajiFromHtml(html);
    expect(result.title).toBe("My Article");
  });

  it("should extract byline from meta author", () => {
    const html = `
      <html>
      <head><meta name="author" content="John Doe"></head>
      <body>
        <article>
          <p>This is the main article content with enough text to properly score in the extraction algorithm used here.</p>
        </article>
      </body>
      </html>`;
    const result = kajiFromHtml(html);
    expect(result.byline).toBe("John Doe");
  });

  it("should handle images", () => {
    const html = `
      <html><body>
        <article>
          <p>This is a long enough paragraph to be properly scored by the content extraction algorithm for testing purposes.</p>
          <img src="photo.jpg" alt="A beautiful photo">
          <p>Another long enough paragraph to ensure the article scores well in the content extraction scoring algorithm.</p>
        </article>
      </body></html>`;
    const result = kajiFromHtml(html);
    expect(result.markdown).toContain("![A beautiful photo](photo.jpg)");
  });
});
