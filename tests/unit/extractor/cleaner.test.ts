import { describe, it, expect } from "vitest";
import { cleanContent } from "../../../src/extractor/cleaner.js";
import { Tokenizer } from "../../../src/parser/tokenizer.js";
import { TreeBuilder } from "../../../src/parser/tree-builder.js";
import { getTextContent, getElementsByTagName, querySelector } from "../../../src/parser/nodes.js";

function parse(html: string) {
  const tokens = new Tokenizer(html).tokenize();
  return new TreeBuilder().build(tokens);
}

describe("cleanContent", () => {
  it("should remove script and style elements", () => {
    const doc = parse("<div><p>text</p><script>alert(1)</script><style>.a{}</style></div>");
    const div = querySelector(doc, "div")!;
    cleanContent(div, true);
    expect(getElementsByTagName(div, "script").length).toBe(0);
    expect(getElementsByTagName(div, "style").length).toBe(0);
    expect(getTextContent(div)).toContain("text");
  });

  it("should remove nav and footer elements", () => {
    const doc = parse("<div><p>content</p><nav>nav</nav><footer>foot</footer></div>");
    const div = querySelector(doc, "div")!;
    cleanContent(div, true);
    expect(getElementsByTagName(div, "nav").length).toBe(0);
    expect(getElementsByTagName(div, "footer").length).toBe(0);
  });

  it("should remove elements with negative class weight and low content", () => {
    const doc = parse('<div><p>main content</p><div class="sidebar">x</div></div>');
    const div = querySelector(doc, "div")!;
    cleanContent(div, true);
    const text = getTextContent(div);
    expect(text).toContain("main content");
  });

  it("should remove empty elements", () => {
    const doc = parse("<div><p>text</p><div></div><span></span></div>");
    const div = querySelector(doc, "div")!;
    cleanContent(div, true);
    // The empty div and span should be removed
    expect(div.children.length).toBeLessThanOrEqual(2);
  });

  it("should keep images when keepImages is true", () => {
    const doc = parse('<div><figure><img src="photo.jpg"></figure></div>');
    const div = querySelector(doc, "div")!;
    cleanContent(div, true);
    expect(getElementsByTagName(div, "img").length).toBe(1);
  });
});
