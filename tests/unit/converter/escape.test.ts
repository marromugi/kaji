import { describe, it, expect } from "vitest";
import { escapeMarkdown } from "../../../src/converter/escape.js";

describe("escapeMarkdown", () => {
  it("should escape backslashes", () => {
    expect(escapeMarkdown("a\\b")).toBe("a\\\\b");
  });

  it("should escape asterisks", () => {
    expect(escapeMarkdown("a*b*c")).toBe("a\\*b\\*c");
  });

  it("should escape underscores", () => {
    expect(escapeMarkdown("a_b")).toBe("a\\_b");
  });

  it("should escape backticks", () => {
    expect(escapeMarkdown("a`b`c")).toBe("a\\`b\\`c");
  });

  it("should escape square brackets", () => {
    expect(escapeMarkdown("[link]")).toBe("\\[link\\]");
  });

  it("should escape hash at start", () => {
    expect(escapeMarkdown("#heading")).toBe("\\#heading");
  });

  it("should escape leading list markers", () => {
    expect(escapeMarkdown("- item")).toBe("\\- item");
    // The whole marker "1." is prefixed with backslash
    expect(escapeMarkdown("1. item")).toMatch(/\\1\. item/);
  });

  it("should not escape plain text", () => {
    expect(escapeMarkdown("hello world")).toBe("hello world");
  });
});
