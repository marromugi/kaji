// Main API
export { toMarkdown, htmlToMarkdown } from "./yunagi.js";

// Config
export { loadConfig, mergeConfig } from "./config.js";

// Types
export type {
  YunagiOptions,
  YunagiResult,
  YunagiConfig,
  ConverterOptions,
  ExtractionResult,
  ConversionRule,
  SiteRule,
  SiteRuleConfig,
  KNode,
  KElementNode,
  KTextNode,
  KCommentNode,
  KDocumentNode,
} from "./types.js";

export { KNodeType, TokenType } from "./types.js";

// Individual pipeline components (for advanced users)
export { Tokenizer } from "./parser/tokenizer.js";
export { TreeBuilder } from "./parser/tree-builder.js";
export { extract } from "./extractor/index.js";
export { MarkdownConverter } from "./converter/converter.js";

// Selector utilities (for advanced users)
export { querySelectorAll, querySelectorOne, parseSelector, matchesSelector } from "./selector.js";
export type { ParsedSelector } from "./selector.js";

// robots.txt utilities
export { parseRobotsTxt, isAllowed, checkRobotsTxt } from "./robots.js";
export type { RobotsTxtRules, RobotsTxtGroup, RobotsTxtRule } from "./robots.js";
