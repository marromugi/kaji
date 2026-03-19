import { describe, it, expect } from "vitest";
import { Tokenizer } from "../../../src/parser/tokenizer.js";
import { TreeBuilder } from "../../../src/parser/tree-builder.js";
import { MarkdownConverter } from "../../../src/converter/converter.js";
import { KNodeType } from "../../../src/types.js";
import { getElementsByTagName } from "../../../src/parser/nodes.js";

function htmlToMd(html: string): string {
  const tokens = new Tokenizer(html).tokenize();
  const doc = new TreeBuilder().build(tokens);
  // Find body, or use doc directly
  const body = getElementsByTagName(doc, "body")[0] ?? doc;
  return new MarkdownConverter().convert(body);
}

describe("MarkdownConverter", () => {
  describe("headings", () => {
    it("should convert h1 to atx heading", () => {
      expect(htmlToMd("<h1>Title</h1>")).toBe("# Title\n");
    });

    it("should convert h2-h6", () => {
      expect(htmlToMd("<h2>Sub</h2>")).toBe("## Sub\n");
      expect(htmlToMd("<h3>Sub</h3>")).toBe("### Sub\n");
    });
  });

  describe("paragraphs", () => {
    it("should convert paragraphs with double newlines", () => {
      expect(htmlToMd("<p>Hello</p><p>World</p>")).toBe("Hello\n\nWorld\n");
    });
  });

  describe("emphasis", () => {
    it("should convert strong to bold", () => {
      expect(htmlToMd("<p><strong>bold</strong></p>")).toBe("**bold**\n");
    });

    it("should convert em to italic", () => {
      expect(htmlToMd("<p><em>italic</em></p>")).toBe("*italic*\n");
    });

    it("should handle nested emphasis", () => {
      expect(htmlToMd("<p><strong><em>bold italic</em></strong></p>")).toBe(
        "***bold italic***\n",
      );
    });
  });

  describe("links", () => {
    it("should convert links", () => {
      expect(htmlToMd('<a href="https://example.com">text</a>')).toBe(
        "[text](https://example.com)\n",
      );
    });

    it("should handle links with title", () => {
      expect(
        htmlToMd('<a href="url" title="My Title">text</a>'),
      ).toBe('[text](url "My Title")\n');
    });
  });

  describe("images", () => {
    it("should convert images", () => {
      expect(htmlToMd('<img src="photo.jpg" alt="A photo">')).toBe(
        "![A photo](photo.jpg)\n",
      );
    });

    it("should handle lazy-loaded images", () => {
      expect(htmlToMd('<img data-src="photo.jpg" alt="lazy">')).toBe(
        "![lazy](photo.jpg)\n",
      );
    });
  });

  describe("lists", () => {
    it("should convert unordered lists", () => {
      expect(htmlToMd("<ul><li>a</li><li>b</li><li>c</li></ul>")).toBe(
        "- a\n- b\n- c\n",
      );
    });

    it("should convert ordered lists", () => {
      expect(htmlToMd("<ol><li>first</li><li>second</li></ol>")).toBe(
        "1. first\n2. second\n",
      );
    });
  });

  describe("code", () => {
    it("should convert inline code", () => {
      expect(htmlToMd("<p>use <code>foo()</code> here</p>")).toBe(
        "use `foo()` here\n",
      );
    });

    it("should convert code blocks", () => {
      const html = '<pre><code class="language-js">const x = 1;</code></pre>';
      expect(htmlToMd(html)).toBe("```js\nconst x = 1;\n```\n");
    });
  });

  describe("blockquotes", () => {
    it("should convert blockquotes", () => {
      expect(htmlToMd("<blockquote><p>quoted text</p></blockquote>")).toBe(
        "> quoted text\n",
      );
    });
  });

  describe("horizontal rules", () => {
    it("should convert hr", () => {
      expect(htmlToMd("<p>above</p><hr><p>below</p>")).toBe(
        "above\n\n---\n\nbelow\n",
      );
    });
  });

  describe("line breaks", () => {
    it("should convert br to markdown line break", () => {
      expect(htmlToMd("<p>line1<br>line2</p>")).toBe("line1  \nline2\n");
    });
  });

  describe("tables", () => {
    it("should convert simple table", () => {
      const html = `
        <table>
          <thead><tr><th>Name</th><th>Age</th></tr></thead>
          <tbody><tr><td>Alice</td><td>30</td></tr></tbody>
        </table>`;
      const md = htmlToMd(html);
      expect(md).toContain("| Name");
      expect(md).toContain("| ---");
      expect(md).toContain("| Alice");
    });
  });

  describe("whitespace", () => {
    it("should collapse consecutive newlines", () => {
      const md = htmlToMd("<p>a</p><p>b</p><p>c</p>");
      expect(md).not.toContain("\n\n\n");
    });
  });
});
