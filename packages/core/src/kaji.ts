import { Tokenizer } from "./parser/tokenizer.js";
import { TreeBuilder } from "./parser/tree-builder.js";
import { extract } from "./extractor/index.js";
import { MarkdownConverter } from "./converter/converter.js";
import { KajiOptions, KajiResult } from "./types.js";
import { checkRobotsTxt } from "./robots.js";

/**
 * Fetch a URL, extract main content, and return Markdown.
 *
 * When `options.respectRobotsTxt` is `true`, the site's robots.txt is checked
 * before fetching. If the path is disallowed:
 *   - By default an error is thrown.
 *   - With `force: true`, a warning is logged and fetching proceeds
 *     (the result will have `robotsTxtBlocked: true`).
 */
export async function kaji(
  url: string,
  options?: KajiOptions & { force?: boolean },
): Promise<KajiResult> {
  let robotsTxtBlocked = false;

  if (options?.respectRobotsTxt) {
    const allowed = await checkRobotsTxt(url);
    if (!allowed) {
      if (options.force) {
        console.warn(`kaji: robots.txt disallows access to ${url} (proceeding with --force)`);
        robotsTxtBlocked = true;
      } else {
        throw new Error(
          `Blocked by robots.txt: ${url}\nUse { force: true } or --force to override.`,
        );
      }
    }
  }

  const response = await fetch(url, {
    headers: { "User-Agent": "kaji/0.1" },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  const html = await response.text();
  const resolved = resolveSiteRules(url, options);
  const result = kajiFromHtml(html, resolved);
  if (robotsTxtBlocked) {
    result.robotsTxtBlocked = true;
  }
  return result;
}

/**
 * Resolve `siteRules` by matching the URL and merging into a flat options object.
 * - `remove` / `include` arrays are concatenated from all matching rules.
 * - `select` uses the first match (direct option takes precedence).
 */
function resolveSiteRules(
  url: string,
  options?: KajiOptions & { force?: boolean },
): KajiOptions & { force?: boolean } {
  if (!options?.siteRules?.length) return options ?? {};

  const mergedRemove = [...(options.remove ?? [])];
  const mergedInclude = [...(options.include ?? [])];
  let mergedSelect = options.select;

  for (const rule of options.siteRules) {
    const matches =
      typeof rule.url === "string" ? url.includes(rule.url) : rule.url.test(url);

    if (matches) {
      if (rule.remove) mergedRemove.push(...rule.remove);
      if (rule.include) mergedInclude.push(...rule.include);
      if (rule.select && !mergedSelect) mergedSelect = rule.select;
    }
  }

  return {
    ...options,
    remove: mergedRemove.length ? mergedRemove : undefined,
    include: mergedInclude.length ? mergedInclude : undefined,
    select: mergedSelect,
  };
}

/**
 * Extract main content from an HTML string and return Markdown.
 * This is the synchronous core — no network IO.
 */
export function kajiFromHtml(html: string, options?: KajiOptions): KajiResult {
  // 1. Parse
  const tokenizer = new Tokenizer(html);
  const tokens = tokenizer.tokenize();
  const treeBuilder = new TreeBuilder();
  const doc = treeBuilder.build(tokens);

  // 2. Extract
  const extracted = extract(doc, options);

  // 3. Convert
  const converter = new MarkdownConverter(options?.converter);
  const markdown = converter.convert(extracted.content);

  return {
    title: extracted.title,
    markdown,
    excerpt: extracted.excerpt,
    byline: extracted.byline,
    siteName: extracted.siteName,
  };
}
