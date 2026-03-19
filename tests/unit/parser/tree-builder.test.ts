import { describe, it, expect } from "vitest";
import { Tokenizer } from "../../../src/parser/tokenizer.js";
import { TreeBuilder } from "../../../src/parser/tree-builder.js";
import { KNodeType } from "../../../src/types.js";
import { getTextContent, getElementsByTagName } from "../../../src/parser/nodes.js";

function parse(html: string) {
  const tokens = new Tokenizer(html).tokenize();
  return new TreeBuilder().build(tokens);
}

function findElement(doc: ReturnType<typeof parse>, tagName: string) {
  return getElementsByTagName(doc, tagName)[0] ?? null;
}

describe("TreeBuilder", () => {
  describe("basic tree construction", () => {
    it("should build a simple tree", () => {
      const doc = parse("<html><body><p>hello</p></body></html>");
      const p = findElement(doc, "p");
      expect(p).not.toBeNull();
      expect(getTextContent(p!)).toBe("hello");
    });

    it("should handle nested elements", () => {
      const doc = parse("<div><span>a</span><span>b</span></div>");
      const spans = getElementsByTagName(doc, "span");
      expect(spans.length).toBe(2);
      expect(getTextContent(spans[0])).toBe("a");
      expect(getTextContent(spans[1])).toBe("b");
    });

    it("should preserve attributes", () => {
      const doc = parse('<div class="article" id="main">text</div>');
      const div = findElement(doc, "div");
      expect(div?.attributes.get("class")).toBe("article");
      expect(div?.attributes.get("id")).toBe("main");
    });
  });

  describe("void elements", () => {
    it("should not require closing tags for void elements", () => {
      const doc = parse("<p>before<br>after</p>");
      const p = findElement(doc, "p");
      expect(p).not.toBeNull();
      const br = findElement(doc, "br");
      expect(br).not.toBeNull();
      expect(getTextContent(p!)).toBe("beforeafter");
    });

    it("should handle img as void element", () => {
      const doc = parse('<p><img src="a.png">text</p>');
      const img = findElement(doc, "img");
      expect(img).not.toBeNull();
      expect(img?.attributes.get("src")).toBe("a.png");
    });
  });

  describe("implicit closing", () => {
    it("should auto-close <p> when block element opens", () => {
      const doc = parse("<p>para1<div>div</div><p>para2</p>");
      const ps = getElementsByTagName(doc, "p");
      expect(ps.length).toBe(2);
      expect(getTextContent(ps[0])).toBe("para1");
      expect(getTextContent(ps[1])).toBe("para2");
    });

    it("should auto-close <li> when another <li> opens", () => {
      const doc = parse("<ul><li>a<li>b<li>c</ul>");
      const lis = getElementsByTagName(doc, "li");
      expect(lis.length).toBe(3);
      expect(getTextContent(lis[0])).toBe("a");
      expect(getTextContent(lis[1])).toBe("b");
      expect(getTextContent(lis[2])).toBe("c");
    });

    it("should auto-close <dd>/<dt>", () => {
      const doc = parse("<dl><dt>term<dd>definition<dt>term2<dd>def2</dl>");
      const dts = getElementsByTagName(doc, "dt");
      const dds = getElementsByTagName(doc, "dd");
      expect(dts.length).toBe(2);
      expect(dds.length).toBe(2);
    });
  });

  describe("implicit tbody", () => {
    it("should insert implicit <tbody> when <tr> is inside <table>", () => {
      const doc = parse("<table><tr><td>cell</td></tr></table>");
      const tbody = findElement(doc, "tbody");
      expect(tbody).not.toBeNull();
      const td = findElement(doc, "td");
      expect(getTextContent(td!)).toBe("cell");
    });
  });

  describe("error recovery", () => {
    it("should ignore unmatched end tags", () => {
      const doc = parse("<div></span></div>");
      const div = findElement(doc, "div");
      expect(div).not.toBeNull();
    });

    it("should handle unclosed elements at EOF", () => {
      const doc = parse("<div><p>unclosed");
      const p = findElement(doc, "p");
      expect(p).not.toBeNull();
      expect(getTextContent(p!)).toBe("unclosed");
    });

    it("should set parent references", () => {
      const doc = parse("<div><p>text</p></div>");
      const p = findElement(doc, "p");
      expect(p?.parent?.type).toBe(KNodeType.Element);
      expect((p?.parent as any)?.tagName).toBe("div");
    });
  });
});
