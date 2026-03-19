import { describe, it, expect } from "vitest";
import { decodeEntity, decodeEntities } from "../../../src/parser/entities.js";

describe("decodeEntity", () => {
  it("should decode named entities with semicolon", () => {
    const result = decodeEntity("amp;", 0);
    expect(result.char).toBe("&");
    expect(result.length).toBe(4);
  });

  it("should decode named entities without semicolon", () => {
    const result = decodeEntity("amp ", 0);
    expect(result.char).toBe("&");
    expect(result.length).toBe(3);
  });

  it("should decode common named entities", () => {
    expect(decodeEntity("lt;", 0).char).toBe("<");
    expect(decodeEntity("gt;", 0).char).toBe(">");
    expect(decodeEntity("quot;", 0).char).toBe('"');
    expect(decodeEntity("apos;", 0).char).toBe("'");
    expect(decodeEntity("nbsp;", 0).char).toBe("\u00A0");
    expect(decodeEntity("mdash;", 0).char).toBe("\u2014");
    expect(decodeEntity("ndash;", 0).char).toBe("\u2013");
    expect(decodeEntity("copy;", 0).char).toBe("\u00A9");
  });

  it("should decode decimal numeric entities", () => {
    const result = decodeEntity("#38;", 0);
    expect(result.char).toBe("&");
    expect(result.length).toBe(4);
  });

  it("should decode hex numeric entities", () => {
    const result = decodeEntity("#x26;", 0);
    expect(result.char).toBe("&");
    expect(result.length).toBe(5);
  });

  it("should decode hex with uppercase X", () => {
    const result = decodeEntity("#X41;", 0);
    expect(result.char).toBe("A");
  });

  it("should handle numeric without semicolon", () => {
    const result = decodeEntity("#65 ", 0);
    expect(result.char).toBe("A");
  });

  it("should return replacement character for code point 0", () => {
    const result = decodeEntity("#0;", 0);
    expect(result.char).toBe("\uFFFD");
  });

  it("should return & for unknown entities", () => {
    const result = decodeEntity("unknown;", 0);
    expect(result.char).toBe("&");
    expect(result.length).toBe(0);
  });
});

describe("decodeEntities", () => {
  it("should decode all entities in a string", () => {
    expect(decodeEntities("a &amp; b")).toBe("a & b");
    expect(decodeEntities("&lt;div&gt;")).toBe("<div>");
    expect(decodeEntities("no entities")).toBe("no entities");
  });

  it("should handle multiple entities", () => {
    expect(decodeEntities("&lt;&gt;&amp;")).toBe("<>&");
  });

  it("should handle mixed content", () => {
    expect(decodeEntities("hello &amp; world &#65;")).toBe("hello & world A");
  });

  it("should handle ampersand not part of entity", () => {
    expect(decodeEntities("a & b")).toBe("a & b");
  });
});
