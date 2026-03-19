import { describe, it, expect } from "vitest";
import { Tokenizer } from "../../../src/parser/tokenizer.js";
import { TokenType } from "../../../src/types.js";

function tokenize(html: string) {
  return new Tokenizer(html).tokenize();
}

describe("Tokenizer", () => {
  describe("basic tags", () => {
    it("should tokenize a simple open tag", () => {
      const tokens = tokenize("<div>");
      expect(tokens[0]).toEqual({
        type: TokenType.StartTag,
        tagName: "div",
        attributes: [],
        selfClosing: false,
      });
    });

    it("should tokenize a close tag", () => {
      const tokens = tokenize("</div>");
      expect(tokens[0]).toEqual({
        type: TokenType.EndTag,
        tagName: "div",
      });
    });

    it("should lowercase tag names", () => {
      const tokens = tokenize("<DIV>");
      expect(tokens[0]).toMatchObject({ tagName: "div" });
    });

    it("should handle self-closing tags", () => {
      const tokens = tokenize("<br/>");
      expect(tokens[0]).toMatchObject({
        type: TokenType.StartTag,
        tagName: "br",
        selfClosing: true,
      });
    });

    it("should handle self-closing with space", () => {
      const tokens = tokenize("<br />");
      expect(tokens[0]).toMatchObject({
        type: TokenType.StartTag,
        tagName: "br",
        selfClosing: true,
      });
    });
  });

  describe("attributes", () => {
    it("should parse double-quoted attributes", () => {
      const tokens = tokenize('<div class="foo">');
      expect(tokens[0]).toMatchObject({
        type: TokenType.StartTag,
        tagName: "div",
        attributes: [{ name: "class", value: "foo" }],
      });
    });

    it("should parse single-quoted attributes", () => {
      const tokens = tokenize("<div class='foo'>");
      expect(tokens[0]).toMatchObject({
        attributes: [{ name: "class", value: "foo" }],
      });
    });

    it("should parse unquoted attributes", () => {
      const tokens = tokenize("<div class=foo>");
      expect(tokens[0]).toMatchObject({
        attributes: [{ name: "class", value: "foo" }],
      });
    });

    it("should parse value-less attributes", () => {
      const tokens = tokenize("<input disabled>");
      expect(tokens[0]).toMatchObject({
        attributes: [{ name: "disabled", value: "" }],
      });
    });

    it("should parse multiple attributes", () => {
      const tokens = tokenize('<a href="url" class="link" target="_blank">');
      expect(tokens[0]).toMatchObject({
        attributes: [
          { name: "href", value: "url" },
          { name: "class", value: "link" },
          { name: "target", value: "_blank" },
        ],
      });
    });

    it("should decode entities in attribute values", () => {
      const tokens = tokenize('<a href="a&amp;b">');
      expect(tokens[0]).toMatchObject({
        attributes: [{ name: "href", value: "a&b" }],
      });
    });

    it("should lowercase attribute names", () => {
      const tokens = tokenize('<div CLASS="foo">');
      expect(tokens[0]).toMatchObject({
        attributes: [{ name: "class", value: "foo" }],
      });
    });
  });

  describe("text content", () => {
    it("should emit text between tags", () => {
      const tokens = tokenize("<p>hello</p>");
      expect(tokens[0]).toMatchObject({ type: TokenType.StartTag, tagName: "p" });
      expect(tokens[1]).toMatchObject({ type: TokenType.Text, data: "hello" });
      expect(tokens[2]).toMatchObject({ type: TokenType.EndTag, tagName: "p" });
    });

    it("should decode entities in text", () => {
      const tokens = tokenize("a &amp; b");
      expect(tokens[0]).toMatchObject({ type: TokenType.Text, data: "a & b" });
    });

    it("should handle text before first tag", () => {
      const tokens = tokenize("hello<br>");
      expect(tokens[0]).toMatchObject({ type: TokenType.Text, data: "hello" });
      expect(tokens[1]).toMatchObject({ type: TokenType.StartTag, tagName: "br" });
    });
  });

  describe("comments", () => {
    it("should tokenize comments", () => {
      const tokens = tokenize("<!-- hello -->");
      expect(tokens[0]).toMatchObject({
        type: TokenType.Comment,
        data: " hello ",
      });
    });

    it("should handle empty comments", () => {
      const tokens = tokenize("<!---->");
      expect(tokens[0]).toMatchObject({ type: TokenType.Comment, data: "" });
    });

    it("should handle abrupt comment <!--> ", () => {
      const tokens = tokenize("<!-->text");
      expect(tokens[0]).toMatchObject({ type: TokenType.Comment, data: "" });
      expect(tokens[1]).toMatchObject({ type: TokenType.Text, data: "text" });
    });
  });

  describe("doctype", () => {
    it("should tokenize DOCTYPE", () => {
      const tokens = tokenize("<!DOCTYPE html>");
      expect(tokens[0]).toMatchObject({ type: TokenType.Doctype, name: "html" });
    });

    it("should handle lowercase doctype", () => {
      const tokens = tokenize("<!doctype html>");
      expect(tokens[0]).toMatchObject({ type: TokenType.Doctype });
    });
  });

  describe("raw text elements", () => {
    it("should consume script content as raw text", () => {
      const tokens = tokenize("<script>var x = 1 < 2;</script>");
      expect(tokens[0]).toMatchObject({ type: TokenType.StartTag, tagName: "script" });
      expect(tokens[1]).toMatchObject({ type: TokenType.Text, data: "var x = 1 < 2;" });
      expect(tokens[2]).toMatchObject({ type: TokenType.EndTag, tagName: "script" });
    });

    it("should consume style content as raw text", () => {
      const tokens = tokenize("<style>.a { color: red; }</style>");
      expect(tokens[0]).toMatchObject({ type: TokenType.StartTag, tagName: "style" });
      expect(tokens[1]).toMatchObject({ type: TokenType.Text, data: ".a { color: red; }" });
      expect(tokens[2]).toMatchObject({ type: TokenType.EndTag, tagName: "style" });
    });
  });

  describe("rcdata elements", () => {
    it("should consume title content with entity decoding", () => {
      const tokens = tokenize("<title>A &amp; B</title>");
      expect(tokens[0]).toMatchObject({ type: TokenType.StartTag, tagName: "title" });
      expect(tokens[1]).toMatchObject({ type: TokenType.Text, data: "A & B" });
      expect(tokens[2]).toMatchObject({ type: TokenType.EndTag, tagName: "title" });
    });
  });

  describe("malformed HTML", () => {
    it("should handle < not followed by tag", () => {
      const tokens = tokenize("a < b");
      // '<' splits text: "a " then "< b"
      expect(tokens[0]).toMatchObject({ type: TokenType.Text, data: "a " });
      expect(tokens[1]).toMatchObject({ type: TokenType.Text, data: "< b" });
    });

    it("should always end with EOF", () => {
      const tokens = tokenize("");
      expect(tokens[tokens.length - 1]).toMatchObject({ type: TokenType.EOF });
    });

    it("should handle unclosed tags at EOF", () => {
      const tokens = tokenize("<div><p>text");
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens[tokens.length - 1]).toMatchObject({ type: TokenType.EOF });
    });
  });
});
