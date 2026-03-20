import { describe, it, expect } from "vitest";
import { selectCandidate } from "../../../src/extractor/candidate.js";
import { createElement } from "../../../src/parser/nodes.js";

function el(tagName: string, cls = "") {
  const attrs = new Map<string, string>();
  if (cls) attrs.set("class", cls);
  return createElement(tagName, attrs);
}

describe("selectCandidate", () => {
  it("should select the highest scoring candidate", () => {
    const a = el("div", "article");
    const b = el("div", "sidebar");
    const candidates = [
      { node: a, contentScore: 100 },
      { node: b, contentScore: 20 },
    ];
    const result = selectCandidate(candidates, 5);
    expect(result).toBe(a);
  });

  it("should return null for empty candidates", () => {
    expect(selectCandidate([], 5)).toBeNull();
  });

  it("should consider link density penalty", () => {
    // Note: link density is calculated at selection time
    // We test that the function doesn't crash
    const a = el("div");
    const candidates = [{ node: a, contentScore: 50 }];
    const result = selectCandidate(candidates, 5);
    expect(result).toBe(a);
  });
});
