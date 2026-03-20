import { describe, it, expect } from "vitest";
import { extract } from "../../../src/extractor/index.js";
import { htmlToMarkdown } from "../../../src/kaji.js";
import { Tokenizer } from "../../../src/parser/tokenizer.js";
import { TreeBuilder } from "../../../src/parser/tree-builder.js";
import { getTextContent } from "../../../src/parser/nodes.js";

function parse(html: string) {
  const tokens = new Tokenizer(html).tokenize();
  return new TreeBuilder().build(tokens);
}

function makeArticlePage(body: string) {
  return `<html><head><title>Test</title></head><body>${body}</body></html>`;
}

describe("custom remove", () => {
  it("should remove elements matching remove selectors", () => {
    const html = makeArticlePage(`
      <article>
        <div class="topic-badge">Badge1</div>
        <p>${"Article content. ".repeat(50)}</p>
        <div class="author-card">Author info</div>
      </article>
    `);
    const doc = parse(html);
    const result = extract(doc, { remove: [".topic-badge", ".author-card"] });
    const text = getTextContent(result.content);
    expect(text).not.toContain("Badge1");
    expect(text).not.toContain("Author info");
    expect(text).toContain("Article content");
  });

  it("should handle multiple remove selectors", () => {
    const html = makeArticlePage(`
      <article>
        <div id="promo">Promo</div>
        <p>${"Real content here. ".repeat(50)}</p>
        <div class="sidebar">Side</div>
        <div class="footer-links">Links</div>
      </article>
    `);
    const doc = parse(html);
    const result = extract(doc, { remove: ["#promo", ".sidebar", ".footer-links"] });
    const text = getTextContent(result.content);
    expect(text).not.toContain("Promo");
    expect(text).not.toContain("Side");
    expect(text).not.toContain("Links");
    expect(text).toContain("Real content");
  });

  it("should not break extraction if remove selector matches nothing", () => {
    const html = makeArticlePage(`
      <article><p>${"Content text. ".repeat(50)}</p></article>
    `);
    const doc = parse(html);
    const result = extract(doc, { remove: [".nonexistent"] });
    expect(getTextContent(result.content)).toContain("Content text");
  });
});

describe("custom include", () => {
  it("should protect elements from unlikely-candidates removal", () => {
    // "sidebar" matches UNLIKELY_CANDIDATES pattern, but we want to keep it
    const html = makeArticlePage(`
      <article>
        <p>${"Main article content. ".repeat(50)}</p>
        <div class="sidebar-notes">
          <p>${"Important sidebar notes that should be kept. ".repeat(10)}</p>
        </div>
      </article>
    `);
    const doc = parse(html);

    // Without include: sidebar may be removed
    const withoutInclude = extract(parse(html));
    // With include: sidebar should be protected
    const withInclude = extract(doc, { include: [".sidebar-notes"] });
    const text = getTextContent(withInclude.content);
    expect(text).toContain("sidebar notes");
  });

  it("should protect elements from negative-weight removal in cleaner", () => {
    // "ad-" matches NEGATIVE_PATTERN, short text would be removed
    const html = makeArticlePage(`
      <article>
        <p>${"Article body text. ".repeat(50)}</p>
        <div class="ad-notice">Sponsored</div>
      </article>
    `);
    const doc = parse(html);
    const result = extract(doc, { include: [".ad-notice"] });
    const text = getTextContent(result.content);
    expect(text).toContain("Sponsored");
  });

  it("should not break extraction if include selector matches nothing", () => {
    const html = makeArticlePage(`
      <article><p>${"Content. ".repeat(80)}</p></article>
    `);
    const doc = parse(html);
    const result = extract(doc, { include: [".nonexistent"] });
    expect(getTextContent(result.content)).toContain("Content");
  });
});

describe("custom select", () => {
  it("should use selected element as content container", () => {
    const html = makeArticlePage(`
      <div class="wrapper">
        <div class="header">Header noise</div>
        <div class="post-content">
          <p>${"The actual article content. ".repeat(30)}</p>
        </div>
        <div class="comments">Comments noise</div>
      </div>
    `);
    const doc = parse(html);
    const result = extract(doc, { select: ".post-content" });
    const text = getTextContent(result.content);
    expect(text).toContain("actual article content");
    expect(text).not.toContain("Header noise");
    expect(text).not.toContain("Comments noise");
  });

  it("should fall back to heuristic if select matches nothing", () => {
    const html = makeArticlePage(`
      <article><p>${"Fallback content. ".repeat(50)}</p></article>
    `);
    const doc = parse(html);
    const result = extract(doc, { select: ".nonexistent" });
    expect(getTextContent(result.content)).toContain("Fallback content");
  });

  it("should work with select + remove together", () => {
    const html = makeArticlePage(`
      <article class="main">
        <div class="badge">Badge</div>
        <p>${"Article text. ".repeat(50)}</p>
        <div class="author">Author</div>
      </article>
    `);
    const doc = parse(html);
    const result = extract(doc, {
      select: "article.main",
      remove: [".badge", ".author"],
    });
    const text = getTextContent(result.content);
    expect(text).toContain("Article text");
    expect(text).not.toContain("Badge");
    expect(text).not.toContain("Author");
  });
});

describe("htmlToMarkdown with custom filters", () => {
  it("should pass remove/include/select through to extraction", () => {
    const html = makeArticlePage(`
      <div class="noise">Noise</div>
      <article class="content">
        <p>${"Article body. ".repeat(50)}</p>
      </article>
    `);
    const result = htmlToMarkdown(html, {
      remove: [".noise"],
      select: "article.content",
    });
    expect(result.markdown).toContain("Article body");
    expect(result.markdown).not.toContain("Noise");
  });
});
