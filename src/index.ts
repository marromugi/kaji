// Main API
export { kaji, kajiFromHtml } from "./kaji.js";

// Types
export type {
  KajiOptions,
  KajiResult,
  ConverterOptions,
  ExtractionResult,
  ConversionRule,
  SiteRule,
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
