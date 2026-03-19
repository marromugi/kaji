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
  replacement: (
    content: string,
    node: KElementNode,
    options: ConverterOptions,
  ) => string;
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

export interface KajiOptions {
  charThreshold?: number;
  nTopCandidates?: number;
  converter?: Partial<ConverterOptions>;
  keepImages?: boolean;
  /** Check robots.txt before fetching (only applies to `kaji()`, not `kajiFromHtml()`). */
  respectRobotsTxt?: boolean;
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
