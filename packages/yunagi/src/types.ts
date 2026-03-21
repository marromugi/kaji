// ─── Token Types (Parser output) ───

export const TokenType = {
  StartTag: 1,
  EndTag: 2,
  Text: 3,
  Comment: 4,
  Doctype: 5,
  EOF: 6,
} as const;

export type TokenType = (typeof TokenType)[keyof typeof TokenType];

export interface Attribute {
  name: string;
  value: string;
}

export interface StartTagToken {
  type: typeof TokenType.StartTag;
  tagName: string;
  attributes: Attribute[];
  selfClosing: boolean;
}

export interface EndTagToken {
  type: typeof TokenType.EndTag;
  tagName: string;
}

export interface TextToken {
  type: typeof TokenType.Text;
  data: string;
}

export interface CommentToken {
  type: typeof TokenType.Comment;
  data: string;
}

export interface DoctypeToken {
  type: typeof TokenType.Doctype;
  name: string;
}

export interface EOFToken {
  type: typeof TokenType.EOF;
}

export type Token =
  | StartTagToken
  | EndTagToken
  | TextToken
  | CommentToken
  | DoctypeToken
  | EOFToken;

// ─── Node Types (Tree builder output) ───

export const KNodeType = {
  Document: 0,
  Element: 1,
  Text: 3,
  Comment: 8,
} as const;

export type KNodeType = (typeof KNodeType)[keyof typeof KNodeType];

export interface KBaseNode {
  type: KNodeType;
  parent: KElementNode | KDocumentNode | null;
}

export interface KDocumentNode extends KBaseNode {
  type: typeof KNodeType.Document;
  children: KNode[];
}

export interface KElementNode extends KBaseNode {
  type: typeof KNodeType.Element;
  tagName: string;
  attributes: Map<string, string>;
  children: KNode[];
  /** Mutable scoring metadata (set by extractor) */
  _score?: number;
  _contentScore?: number;
}

export interface KTextNode extends KBaseNode {
  type: typeof KNodeType.Text;
  data: string;
}

export interface KCommentNode extends KBaseNode {
  type: typeof KNodeType.Comment;
  data: string;
}

export type KNode = KElementNode | KTextNode | KCommentNode;

// ─── Extractor Types ───

export interface ExtractionResult {
  title: string;
  content: KElementNode;
  excerpt: string;
  byline: string | null;
  siteName: string | null;
}

// ─── Converter Types ───

export interface ConversionRule {
  filter: string | string[] | ((node: KElementNode) => boolean);
  replacement: (content: string, node: KElementNode, options: ConverterOptions) => string;
}

export interface ConverterOptions {
  headingStyle: "atx" | "setext";
  bulletListMarker: "*" | "-" | "+";
  codeBlockStyle: "fenced" | "indented";
  fence: "```" | "~~~";
  emDelimiter: "_" | "*";
  strongDelimiter: "**" | "__";
  linkStyle: "inlined" | "referenced";
  hr: "---" | "***" | "___";
}

// ─── Public API Types ───

/** Rule for site-specific content filtering. */
export interface SiteRule {
  /** URL matching: string = domain substring match, RegExp = full URL match. */
  url: string | RegExp;
  /** CSS-like selectors for elements to force-remove before extraction. */
  remove?: string[];
  /** CSS-like selectors for elements to protect from heuristic removal. */
  include?: string[];
  /** CSS-like selector for the main content container (bypasses heuristic scoring). */
  select?: string;
}

/** JSON-serializable site rule (RegExp not supported). */
export interface SiteRuleConfig {
  /** URL substring match. */
  url: string;
  /** CSS-like selectors for elements to force-remove before extraction. */
  remove?: string[];
  /** CSS-like selectors for elements to protect from heuristic removal. */
  include?: string[];
  /** CSS-like selector for the main content container (bypasses heuristic scoring). */
  select?: string;
}

/** JSON-serializable configuration loaded from `kaji.config.json`. */
export interface KajiConfig {
  charThreshold?: number;
  nTopCandidates?: number;
  converter?: Partial<ConverterOptions>;
  keepImages?: boolean;
  respectRobotsTxt?: boolean;
  /** CSS-like selectors for elements to force-remove before extraction. */
  remove?: string[];
  /** CSS-like selectors for elements to protect from heuristic removal. */
  include?: string[];
  /** CSS-like selector for the main content container (bypasses heuristic scoring). */
  select?: string;
  /** Domain-specific rules. */
  siteRules?: SiteRuleConfig[];
}

export interface KajiOptions {
  charThreshold?: number;
  nTopCandidates?: number;
  converter?: Partial<ConverterOptions>;
  keepImages?: boolean;
  /** Check robots.txt before fetching (only applies to `kaji()`, not `kajiFromHtml()`). */
  respectRobotsTxt?: boolean;
  /** CSS-like selectors for elements to force-remove before extraction. */
  remove?: string[];
  /** CSS-like selectors for elements to protect from heuristic removal. */
  include?: string[];
  /** CSS-like selector for the main content container (bypasses heuristic scoring). */
  select?: string;
  /** URL-pattern-matched rules (only effective with `kaji()`, ignored by `kajiFromHtml()`). */
  siteRules?: SiteRule[];
  /** Path to a config file. If omitted, `kaji.config.json` in CWD is used when found. */
  config?: string;
}

export interface KajiResult {
  title: string;
  markdown: string;
  excerpt: string;
  byline: string | null;
  siteName: string | null;
  /** `true` if robots.txt disallowed access but fetching proceeded with `force`. */
  robotsTxtBlocked?: boolean;
}
