import { describe, it, expect } from "vitest";
import {
  parseSelector,
  matchesSelector,
  querySelectorAll,
  querySelectorOne,
} from "../../src/selector.js";
import { Tokenizer } from "../../src/parser/tokenizer.js";
import { TreeBuilder } from "../../src/parser/tree-builder.js";
import { querySelector } from "../../src/parser/nodes.js";

function parse(html: string) {
  const tokens = new Tokenizer(html).tokenize();
  return new TreeBuilder().build(tokens);
}

describe("parseSelector", () => {
  it("should parse tag name", () => {
    const sel = parseSelector("div");
    expect(sel).toHaveLength(1);
    expect(sel[0].tag).toBe("div");
    expect(sel[0].classes).toEqual([]);
  });

  it("should parse class", () => {
    const sel = parseSelector(".foo");
    expect(sel).toHaveLength(1);
    expect(sel[0].tag).toBeUndefined();
    expect(sel[0].classes).toEqual(["foo"]);
  });

  it("should parse id", () => {
    const sel = parseSelector("#bar");
    expect(sel).toHaveLength(1);
    expect(sel[0].id).toBe("bar");
  });

  it("should parse tag.class", () => {
    const sel = parseSelector("div.foo");
    expect(sel).toHaveLength(1);
    expect(sel[0].tag).toBe("div");
    expect(sel[0].classes).toEqual(["foo"]);
  });

  it("should parse tag#id", () => {
    const sel = parseSelector("div#bar");
    expect(sel).toHaveLength(1);
    expect(sel[0].tag).toBe("div");
    expect(sel[0].id).toBe("bar");
  });

  it("should parse multiple classes", () => {
    const sel = parseSelector(".foo.bar");
    expect(sel).toHaveLength(1);
    expect(sel[0].classes).toEqual(["foo", "bar"]);
  });

  it("should parse attribute presence", () => {
    const sel = parseSelector("[data-type]");
    expect(sel).toHaveLength(1);
    expect(sel[0].attrs).toEqual([{ name: "data-type" }]);
  });

  it("should parse attribute with value", () => {
    const sel = parseSelector('[role="banner"]');
    expect(sel).toHaveLength(1);
    expect(sel[0].attrs).toEqual([{ name: "role", value: "banner" }]);
  });

  it("should parse attribute with unquoted value", () => {
    const sel = parseSelector("[role=banner]");
    expect(sel[0].attrs).toEqual([{ name: "role", value: "banner" }]);
  });

  it("should parse descendant selector", () => {
    const sel = parseSelector("div .badge");
    expect(sel).toHaveLength(2);
    expect(sel[0].tag).toBe("div");
    expect(sel[1].classes).toEqual(["badge"]);
  });

  it("should parse complex descendant", () => {
    const sel = parseSelector("article.post .sidebar div.badge");
    expect(sel).toHaveLength(3);
    expect(sel[0].tag).toBe("article");
    expect(sel[0].classes).toEqual(["post"]);
    expect(sel[1].classes).toEqual(["sidebar"]);
    expect(sel[2].tag).toBe("div");
    expect(sel[2].classes).toEqual(["badge"]);
  });

  it("should throw on empty selector", () => {
    expect(() => parseSelector("")).toThrow("Invalid selector");
    expect(() => parseSelector("   ")).toThrow("Invalid selector");
  });
});

describe("matchesSelector", () => {
  it("should match tag name", () => {
    const doc = parse("<div><p>text</p></div>");
    const p = querySelector(doc, "p")!;
    expect(matchesSelector(p, parseSelector("p"))).toBe(true);
    expect(matchesSelector(p, parseSelector("div"))).toBe(false);
  });

  it("should match class", () => {
    const doc = parse('<div class="foo bar">text</div>');
    const div = querySelector(doc, "div")!;
    expect(matchesSelector(div, parseSelector(".foo"))).toBe(true);
    expect(matchesSelector(div, parseSelector(".bar"))).toBe(true);
    expect(matchesSelector(div, parseSelector(".baz"))).toBe(false);
  });

  it("should match multiple classes", () => {
    const doc = parse('<div class="foo bar baz">text</div>');
    const div = querySelector(doc, "div")!;
    expect(matchesSelector(div, parseSelector(".foo.bar"))).toBe(true);
    expect(matchesSelector(div, parseSelector(".foo.missing"))).toBe(false);
  });

  it("should match id", () => {
    const doc = parse('<div id="main">text</div>');
    const div = querySelector(doc, "div")!;
    expect(matchesSelector(div, parseSelector("#main"))).toBe(true);
    expect(matchesSelector(div, parseSelector("#other"))).toBe(false);
  });

  it("should match tag+class combined", () => {
    const doc = parse('<div class="foo">text</div><p class="foo">text</p>');
    const div = querySelector(doc, "div")!;
    const p = querySelector(doc, "p")!;
    expect(matchesSelector(div, parseSelector("div.foo"))).toBe(true);
    expect(matchesSelector(p, parseSelector("div.foo"))).toBe(false);
    expect(matchesSelector(p, parseSelector("p.foo"))).toBe(true);
  });

  it("should match attribute presence", () => {
    const doc = parse('<div data-test="1">text</div>');
    const div = querySelector(doc, "div")!;
    expect(matchesSelector(div, parseSelector("[data-test]"))).toBe(true);
    expect(matchesSelector(div, parseSelector("[data-other]"))).toBe(false);
  });

  it("should match attribute value", () => {
    const doc = parse('<div role="banner">text</div>');
    const div = querySelector(doc, "div")!;
    expect(matchesSelector(div, parseSelector('[role="banner"]'))).toBe(true);
    expect(matchesSelector(div, parseSelector('[role="nav"]'))).toBe(false);
  });

  it("should match descendant selector", () => {
    const doc = parse('<article><div><span class="badge">x</span></div></article>');
    const span = querySelector(doc, "span")!;
    expect(matchesSelector(span, parseSelector("article .badge"))).toBe(true);
    expect(matchesSelector(span, parseSelector("section .badge"))).toBe(false);
    expect(matchesSelector(span, parseSelector("article div .badge"))).toBe(true);
  });
});

describe("querySelectorAll", () => {
  it("should find elements by tag", () => {
    const doc = parse("<div><p>a</p><p>b</p><span>c</span></div>");
    const div = querySelector(doc, "div")!;
    const results = querySelectorAll(div, "p");
    expect(results).toHaveLength(2);
  });

  it("should find elements by class", () => {
    const doc = parse('<div><p class="x">a</p><p>b</p><p class="x">c</p></div>');
    const div = querySelector(doc, "div")!;
    const results = querySelectorAll(div, ".x");
    expect(results).toHaveLength(2);
  });

  it("should find nested elements with descendant selector", () => {
    const doc = parse('<div class="a"><span>1</span></div><div class="b"><span>2</span></div>');
    const results = querySelectorAll(doc, ".a span");
    expect(results).toHaveLength(1);
  });

  it("should return empty array when nothing matches", () => {
    const doc = parse("<div><p>text</p></div>");
    expect(querySelectorAll(doc, ".nonexistent")).toHaveLength(0);
  });
});

describe("querySelectorOne", () => {
  it("should return first match", () => {
    const doc = parse('<div><p class="a">first</p><p class="a">second</p></div>');
    const result = querySelectorOne(doc, ".a");
    expect(result).not.toBeNull();
    expect(result!.children.length).toBeGreaterThan(0);
  });

  it("should return null when nothing matches", () => {
    const doc = parse("<div><p>text</p></div>");
    expect(querySelectorOne(doc, ".missing")).toBeNull();
  });
});
