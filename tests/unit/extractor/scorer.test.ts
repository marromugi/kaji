import { describe, it, expect } from "vitest";
import { getBaseScore, getClassWeight, getLinkDensity, scoreDocument } from "../../../src/extractor/scorer.js";
import { Tokenizer } from "../../../src/parser/tokenizer.js";
import { TreeBuilder } from "../../../src/parser/tree-builder.js";
import { createElement } from "../../../src/parser/nodes.js";
import { getElementsByTagName, querySelector } from "../../../src/parser/nodes.js";

function parse(html: string) {
  const tokens = new Tokenizer(html).tokenize();
  return new TreeBuilder().build(tokens);
}

function el(tagName: string, cls = "", id = "") {
  const attrs = new Map<string, string>();
  if (cls) attrs.set("class", cls);
  if (id) attrs.set("id", id);
  return createElement(tagName, attrs);
}

describe("getBaseScore", () => {
  it("should assign +5 to div", () => {
    expect(getBaseScore(el("div"))).toBe(5);
  });
  it("should assign +5 to article", () => {
    expect(getBaseScore(el("article"))).toBe(5);
  });
  it("should assign +3 to pre/td/blockquote", () => {
    expect(getBaseScore(el("pre"))).toBe(3);
    expect(getBaseScore(el("td"))).toBe(3);
    expect(getBaseScore(el("blockquote"))).toBe(3);
  });
  it("should assign -3 to form/ul/ol", () => {
    expect(getBaseScore(el("form"))).toBe(-3);
    expect(getBaseScore(el("ul"))).toBe(-3);
    expect(getBaseScore(el("ol"))).toBe(-3);
  });
  it("should assign -5 to heading tags", () => {
    expect(getBaseScore(el("h1"))).toBe(-5);
    expect(getBaseScore(el("h3"))).toBe(-5);
  });
  it("should assign 0 to unknown tags", () => {
    expect(getBaseScore(el("span"))).toBe(0);
  });
});

describe("getClassWeight", () => {
  it("should add +25 for positive class patterns", () => {
    expect(getClassWeight(el("div", "article-content"))).toBe(25);
    expect(getClassWeight(el("div", "", "main-body"))).toBe(25);
  });
  it("should subtract 25 for negative class patterns", () => {
    expect(getClassWeight(el("div", "sidebar-widget"))).toBe(-25);
    expect(getClassWeight(el("div", "comment-section"))).toBe(-25);
  });
  it("should handle both positive and negative", () => {
    expect(getClassWeight(el("div", "article sidebar"))).toBe(0);
  });
  it("should return 0 for neutral classes", () => {
    expect(getClassWeight(el("div", "wrapper"))).toBe(0);
  });
});

describe("getLinkDensity", () => {
  it("should return 0 for elements with no links", () => {
    const doc = parse("<div><p>Hello world</p></div>");
    const div = querySelector(doc, "div")!;
    expect(getLinkDensity(div)).toBe(0);
  });
  it("should return high density for link-heavy elements", () => {
    const doc = parse('<div><a href="#">link text</a></div>');
    const div = querySelector(doc, "div")!;
    expect(getLinkDensity(div)).toBe(1);
  });
  it("should return intermediate density for mixed content", () => {
    const doc = parse('<div>regular text <a href="#">link</a></div>');
    const div = querySelector(doc, "div")!;
    const density = getLinkDensity(div);
    expect(density).toBeGreaterThan(0);
    expect(density).toBeLessThan(1);
  });
});

describe("scoreDocument", () => {
  it("should score paragraphs and propagate to ancestors", () => {
    const html = `
      <body>
        <div class="article">
          <p>This is a sufficiently long paragraph with commas, yes, commas to score well in the algorithm.</p>
        </div>
      </body>`;
    const doc = parse(html);
    const body = querySelector(doc, "body")!;
    const candidates = scoreDocument(body);
    expect(candidates.length).toBeGreaterThan(0);

    const articleCandidate = candidates.find(
      (c) => c.node.attributes.get("class") === "article",
    );
    expect(articleCandidate).toBeDefined();
    expect(articleCandidate!.contentScore).toBeGreaterThan(0);
  });

  it("should not score short paragraphs", () => {
    const html = "<body><div><p>short</p></div></body>";
    const doc = parse(html);
    const body = querySelector(doc, "body")!;
    const candidates = scoreDocument(body);
    expect(candidates.length).toBe(0);
  });
});
