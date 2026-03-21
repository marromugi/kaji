import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { KajiConfig, KajiOptions } from "./types.js";

const CONFIG_FILENAME = "kaji.config.json";

/**
 * Load a kaji config file.
 *
 * - If `configPath` is given, read that file (throws if missing).
 * - Otherwise, look for `kaji.config.json` in the current working directory.
 *   Returns `null` if the file does not exist.
 */
export function loadConfig(configPath?: string): KajiConfig | null {
  const filePath = configPath ? resolve(configPath) : resolve(process.cwd(), CONFIG_FILENAME);

  if (!configPath && !existsSync(filePath)) {
    return null;
  }

  let raw: string;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch {
    throw new Error(`Failed to read config file: ${filePath}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in config file: ${filePath}`);
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Config file must contain a JSON object: ${filePath}`);
  }

  return parsed as KajiConfig;
}

/**
 * Merge a loaded config with programmatic options.
 *
 * Priority (low → high): config → options.
 * - `siteRules`: concatenated (options first, then config).
 * - `remove` / `include`: concatenated.
 * - `converter`: shallow-merged (options fields override config fields).
 * - All other fields: options override config.
 */
export function mergeConfig(config: KajiConfig, options?: KajiOptions): KajiOptions {
  const merged: KajiOptions = { ...config, ...options };

  // Merge converter options
  if (config.converter || options?.converter) {
    merged.converter = { ...config.converter, ...options?.converter };
  }

  // Concatenate siteRules
  const configRules = config.siteRules ?? [];
  const optionRules = options?.siteRules ?? [];
  if (configRules.length || optionRules.length) {
    merged.siteRules = [...optionRules, ...configRules];
  }

  // Concatenate remove selectors
  const configRemove = config.remove ?? [];
  const optionRemove = options?.remove ?? [];
  if (configRemove.length || optionRemove.length) {
    merged.remove = [...optionRemove, ...configRemove];
  }

  // Concatenate include selectors
  const configInclude = config.include ?? [];
  const optionInclude = options?.include ?? [];
  if (configInclude.length || optionInclude.length) {
    merged.include = [...optionInclude, ...configInclude];
  }

  return merged;
}
