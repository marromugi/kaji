import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { loadConfig, mergeConfig } from "../../src/config.js";
import type { KajiConfig, KajiOptions } from "../../src/types.js";

const TMP_DIR = join(import.meta.dirname, "__tmp_config_test__");

function writeJson(dir: string, filename: string, data: unknown): string {
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, filename);
  writeFileSync(filePath, JSON.stringify(data), "utf-8");
  return filePath;
}

describe("loadConfig", () => {
  beforeEach(() => mkdirSync(TMP_DIR, { recursive: true }));
  afterEach(() => rmSync(TMP_DIR, { recursive: true, force: true }));

  it("should load a config file by explicit path", () => {
    const config: KajiConfig = {
      charThreshold: 300,
      siteRules: [{ url: "example.com", remove: [".ad"] }],
    };
    const filePath = writeJson(TMP_DIR, "custom.json", config);
    const loaded = loadConfig(filePath);
    expect(loaded).toEqual(config);
  });

  it("should throw when explicit path does not exist", () => {
    expect(() => loadConfig(join(TMP_DIR, "missing.json"))).toThrow(
      "Failed to read config file",
    );
  });

  it("should return null when no config in CWD and no path given", () => {
    const origCwd = process.cwd();
    process.chdir(TMP_DIR);
    try {
      expect(loadConfig()).toBeNull();
    } finally {
      process.chdir(origCwd);
    }
  });

  it("should auto-detect kaji.config.json in CWD", () => {
    const config: KajiConfig = { keepImages: false };
    writeJson(TMP_DIR, "kaji.config.json", config);
    const origCwd = process.cwd();
    process.chdir(TMP_DIR);
    try {
      expect(loadConfig()).toEqual(config);
    } finally {
      process.chdir(origCwd);
    }
  });

  it("should throw on invalid JSON", () => {
    mkdirSync(TMP_DIR, { recursive: true });
    const filePath = join(TMP_DIR, "bad.json");
    writeFileSync(filePath, "not json {{{", "utf-8");
    expect(() => loadConfig(filePath)).toThrow("Invalid JSON");
  });

  it("should throw when config is not an object", () => {
    const filePath = writeJson(TMP_DIR, "array.json", [1, 2, 3]);
    expect(() => loadConfig(filePath)).toThrow("must contain a JSON object");
  });
});

describe("mergeConfig", () => {
  it("should use config values when no options provided", () => {
    const config: KajiConfig = {
      charThreshold: 300,
      keepImages: false,
    };
    const result = mergeConfig(config);
    expect(result.charThreshold).toBe(300);
    expect(result.keepImages).toBe(false);
  });

  it("should let options override config scalar values", () => {
    const config: KajiConfig = { charThreshold: 300, keepImages: false };
    const options: KajiOptions = { charThreshold: 800 };
    const result = mergeConfig(config, options);
    expect(result.charThreshold).toBe(800);
    expect(result.keepImages).toBe(false);
  });

  it("should shallow-merge converter options", () => {
    const config: KajiConfig = {
      converter: { headingStyle: "setext", bulletListMarker: "-" },
    };
    const options: KajiOptions = {
      converter: { bulletListMarker: "+" },
    };
    const result = mergeConfig(config, options);
    expect(result.converter).toEqual({
      headingStyle: "setext",
      bulletListMarker: "+",
    });
  });

  it("should concatenate siteRules (options first, then config)", () => {
    const config: KajiConfig = {
      siteRules: [{ url: "config.com", remove: [".ad"] }],
    };
    const options: KajiOptions = {
      siteRules: [{ url: "option.com", select: "main" }],
    };
    const result = mergeConfig(config, options);
    expect(result.siteRules).toHaveLength(2);
    expect(result.siteRules![0]).toEqual({ url: "option.com", select: "main" });
    expect(result.siteRules![1]).toEqual({ url: "config.com", remove: [".ad"] });
  });

  it("should concatenate remove selectors", () => {
    const config: KajiConfig = { remove: [".config-remove"] };
    const options: KajiOptions = { remove: [".option-remove"] };
    const result = mergeConfig(config, options);
    expect(result.remove).toEqual([".option-remove", ".config-remove"]);
  });

  it("should concatenate include selectors", () => {
    const config: KajiConfig = { include: [".config-include"] };
    const options: KajiOptions = { include: [".option-include"] };
    const result = mergeConfig(config, options);
    expect(result.include).toEqual([".option-include", ".config-include"]);
  });

  it("should handle config-only arrays without options", () => {
    const config: KajiConfig = {
      siteRules: [{ url: "example.com", remove: [".sidebar"] }],
      remove: [".nav"],
    };
    const result = mergeConfig(config);
    expect(result.siteRules).toHaveLength(1);
    expect(result.remove).toEqual([".nav"]);
  });

  it("should not create empty arrays when neither side has values", () => {
    const config: KajiConfig = { charThreshold: 500 };
    const options: KajiOptions = { keepImages: true };
    const result = mergeConfig(config, options);
    expect(result.siteRules).toBeUndefined();
    expect(result.remove).toBeUndefined();
    expect(result.include).toBeUndefined();
  });
});
