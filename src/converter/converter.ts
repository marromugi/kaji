import {
  KNode,
  KElementNode,
  KDocumentNode,
  KTextNode,
  KNodeType,
  ConverterOptions,
  ConversionRule,
} from "../types.js";
import { createBuiltinRules, matchesFilter } from "./rules.js";
import { escapeMarkdown } from "./escape.js";

const DEFAULT_OPTIONS: ConverterOptions = {
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  fence: "```",
  emDelimiter: "*",
  strongDelimiter: "**",
  linkStyle: "inlined",
  hr: "---",
};

export class MarkdownConverter {
  private rules: ConversionRule[];
  private options: ConverterOptions;

  constructor(options?: Partial<ConverterOptions>) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.rules = [
      ...createBuiltinRules((node) => this.processChildren(node)),
    ];
  }

  /** Add a custom rule (prepended, so it takes priority) */
  addRule(rule: ConversionRule): void {
    this.rules.unshift(rule);
  }

  /** Convert a node tree to Markdown */
  convert(node: KElementNode | KDocumentNode): string {
    const raw = this.processNode(node);
    return this.postProcess(raw);
  }

  /** Recursively process a node */
  private processNode(node: KNode | KDocumentNode): string {
    if (node.type === KNodeType.Text) {
      return this.processText(node as KTextNode);
    }

    if (node.type === KNodeType.Comment) {
      return "";
    }

    // Element or Document: process children, then apply rule
    const content = this.processChildren(node as KElementNode | KDocumentNode);

    if (node.type === KNodeType.Document) {
      return content;
    }

    // Find matching rule
    const rule = this.findRule(node as KElementNode);
    if (rule) {
      return rule.replacement(content, node as KElementNode, this.options);
    }

    // Default: return children content (transparent wrapper)
    return content;
  }

  private processChildren(node: KElementNode | KDocumentNode): string {
    return node.children.map((child) => this.processNode(child)).join("");
  }

  /** Process text node: escape markdown chars, handle whitespace */
  private processText(node: KTextNode): string {
    if (this.isInsidePre(node)) {
      return node.data;
    }
    // Collapse whitespace per HTML rules
    const collapsed = node.data.replace(/[\s\n\r\t]+/g, " ");
    return escapeMarkdown(collapsed);
  }

  private isInsidePre(node: KNode): boolean {
    let current = node.parent;
    while (current) {
      if (current.type === KNodeType.Element && current.tagName === "pre") {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  /** Find the first matching rule for an element */
  private findRule(node: KElementNode): ConversionRule | undefined {
    return this.rules.find((rule) => matchesFilter(rule.filter, node));
  }

  /**
   * Post-process the raw markdown:
   * - Collapse 3+ consecutive newlines to 2
   * - Trim leading/trailing whitespace
   * - Ensure trailing newline
   */
  private postProcess(markdown: string): string {
    return markdown.replace(/\n{3,}/g, "\n\n").trim() + "\n";
  }
}
