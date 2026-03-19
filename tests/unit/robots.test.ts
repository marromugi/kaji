import { describe, it, expect } from "vitest";
import { parseRobotsTxt, isAllowed } from "../../src/robots.js";
import type { RobotsTxtRules } from "../../src/robots.js";

function allowed(body: string, ua: string, path: string): boolean {
  return isAllowed(parseRobotsTxt(body), ua, path);
}

describe("parseRobotsTxt", () => {
  it("should parse a simple robots.txt", () => {
    const rules = parseRobotsTxt(
      `User-agent: *\nDisallow: /private/\nAllow: /private/public/`,
    );
    expect(rules.groups).toHaveLength(1);
    expect(rules.groups[0].userAgents).toEqual(["*"]);
    expect(rules.groups[0].rules).toEqual([
      { type: "disallow", path: "/private/" },
      { type: "allow", path: "/private/public/" },
    ]);
  });

  it("should parse multiple user-agent groups", () => {
    const rules = parseRobotsTxt(
      `User-agent: googlebot\nDisallow: /no-google/\n\nUser-agent: *\nDisallow: /secret/`,
    );
    expect(rules.groups).toHaveLength(2);
    expect(rules.groups[0].userAgents).toEqual(["googlebot"]);
    expect(rules.groups[1].userAgents).toEqual(["*"]);
  });

  it("should group multiple user-agents before rules", () => {
    const rules = parseRobotsTxt(
      `User-agent: bot-a\nUser-agent: bot-b\nDisallow: /`,
    );
    expect(rules.groups).toHaveLength(1);
    expect(rules.groups[0].userAgents).toEqual(["bot-a", "bot-b"]);
    expect(rules.groups[0].rules).toEqual([{ type: "disallow", path: "/" }]);
  });

  it("should ignore comments and blank lines", () => {
    const rules = parseRobotsTxt(
      `# This is a comment\nUser-agent: *\n\n# Another comment\nDisallow: /admin/`,
    );
    expect(rules.groups).toHaveLength(1);
    expect(rules.groups[0].rules).toEqual([
      { type: "disallow", path: "/admin/" },
    ]);
  });

  it("should ignore inline comments", () => {
    const rules = parseRobotsTxt(
      `User-agent: * # all bots\nDisallow: /private/ # keep out`,
    );
    expect(rules.groups[0].rules).toEqual([
      { type: "disallow", path: "/private/" },
    ]);
  });

  it("should return empty groups for empty input", () => {
    const rules = parseRobotsTxt("");
    expect(rules.groups).toEqual([]);
  });

  it("should ignore unknown directives", () => {
    const rules = parseRobotsTxt(
      `User-agent: *\nSitemap: https://example.com/sitemap.xml\nCrawl-delay: 10\nDisallow: /api/`,
    );
    expect(rules.groups).toHaveLength(1);
    expect(rules.groups[0].rules).toEqual([
      { type: "disallow", path: "/api/" },
    ]);
  });

  it("should skip disallow with empty value", () => {
    const rules = parseRobotsTxt(`User-agent: *\nDisallow:`);
    expect(rules.groups).toHaveLength(1);
    expect(rules.groups[0].rules).toEqual([]);
  });
});

describe("isAllowed", () => {
  describe("basic allow / disallow", () => {
    it("should allow when no rules exist", () => {
      expect(allowed("", "kaji/0.1", "/anything")).toBe(true);
    });

    it("should disallow a matching path", () => {
      expect(
        allowed("User-agent: *\nDisallow: /private/", "kaji/0.1", "/private/page"),
      ).toBe(false);
    });

    it("should allow a non-matching path", () => {
      expect(
        allowed("User-agent: *\nDisallow: /private/", "kaji/0.1", "/public/page"),
      ).toBe(true);
    });

    it("should disallow root disallow", () => {
      expect(
        allowed("User-agent: *\nDisallow: /", "kaji/0.1", "/anything"),
      ).toBe(false);
    });
  });

  describe("specificity", () => {
    it("should prefer the more specific rule", () => {
      const body = `User-agent: *\nDisallow: /private/\nAllow: /private/public/`;
      expect(allowed(body, "kaji/0.1", "/private/secret")).toBe(false);
      expect(allowed(body, "kaji/0.1", "/private/public/page")).toBe(true);
    });

    it("should prefer allow when specificity is equal", () => {
      const body = `User-agent: *\nDisallow: /path\nAllow: /path`;
      expect(allowed(body, "kaji/0.1", "/path")).toBe(true);
    });
  });

  describe("user-agent matching", () => {
    it("should match a specific user-agent over wildcard", () => {
      const body = `User-agent: kaji\nDisallow: /blocked/\n\nUser-agent: *\nAllow: /`;
      expect(allowed(body, "kaji/0.1", "/blocked/page")).toBe(false);
    });

    it("should fall back to wildcard group", () => {
      const body = `User-agent: googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /secret/`;
      expect(allowed(body, "kaji/0.1", "/public")).toBe(true);
      expect(allowed(body, "kaji/0.1", "/secret/file")).toBe(false);
    });

    it("should allow when no matching group exists and no wildcard", () => {
      const body = `User-agent: googlebot\nDisallow: /`;
      expect(allowed(body, "kaji/0.1", "/anything")).toBe(true);
    });
  });

  describe("wildcard patterns in paths", () => {
    it("should match * in path pattern", () => {
      const body = `User-agent: *\nDisallow: /private/*/secret`;
      expect(allowed(body, "kaji/0.1", "/private/foo/secret")).toBe(false);
      expect(allowed(body, "kaji/0.1", "/private/bar/secret")).toBe(false);
      expect(allowed(body, "kaji/0.1", "/private/foo/public")).toBe(true);
    });

    it("should match $ end anchor", () => {
      const body = `User-agent: *\nDisallow: /*.pdf$`;
      expect(allowed(body, "kaji/0.1", "/docs/file.pdf")).toBe(false);
      expect(allowed(body, "kaji/0.1", "/docs/file.pdf?ref=1")).toBe(true);
      expect(allowed(body, "kaji/0.1", "/docs/file.html")).toBe(true);
    });
  });
});
