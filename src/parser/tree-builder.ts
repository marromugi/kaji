import {
  Token,
  TokenType,
  KDocumentNode,
  KElementNode,
  KNode,
  KNodeType,
} from "../types.js";
import {
  createDocument,
  createElement,
  createText,
  createComment,
  appendChild,
  VOID_ELEMENTS,
  P_CLOSING_ELEMENTS,
} from "./nodes.js";

export class TreeBuilder {
  private document!: KDocumentNode;
  private openElements: KElementNode[] = [];

  build(tokens: Token[]): KDocumentNode {
    this.document = createDocument();
    this.openElements = [];

    for (const token of tokens) {
      this.processToken(token);
    }

    return this.document;
  }

  private get currentNode(): KElementNode | KDocumentNode {
    return this.openElements.length > 0
      ? this.openElements[this.openElements.length - 1]
      : this.document;
  }

  private processToken(token: Token): void {
    switch (token.type) {
      case TokenType.StartTag:
        this.processStartTag(token);
        break;
      case TokenType.EndTag:
        this.processEndTag(token);
        break;
      case TokenType.Text:
        this.processText(token);
        break;
      case TokenType.Comment:
        this.processComment(token);
        break;
      case TokenType.Doctype:
        // Ignored for tree building — we don't need it
        break;
      case TokenType.EOF:
        break;
    }
  }

  private processStartTag(token: { tagName: string; attributes: { name: string; value: string }[]; selfClosing: boolean }): void {
    const tagName = token.tagName;

    // Auto-close <p> when a block element opens
    if (P_CLOSING_ELEMENTS.has(tagName)) {
      this.closePIfOpen();
    }

    // Auto-close <li> when another <li> opens
    if (tagName === "li") {
      this.closeIfInScope("li");
    }

    // Auto-close <dd>/<dt> when another opens
    if (tagName === "dd" || tagName === "dt") {
      this.closeIfInScope("dd");
      this.closeIfInScope("dt");
    }

    // Auto-close <tr> when another opens
    if (tagName === "tr") {
      this.closeIfInScope("tr");
    }

    // Auto-close <td>/<th> when another opens
    if (tagName === "td" || tagName === "th") {
      this.closeIfInScope("td");
      this.closeIfInScope("th");
    }

    // Implicit <tbody> inside <table>
    if (tagName === "tr" && this.currentNodeIs("table")) {
      const tbody = createElement("tbody", new Map());
      this.insertNode(tbody);
      this.openElements.push(tbody);
    }

    // Create element
    const attrs = new Map<string, string>();
    for (const attr of token.attributes) {
      attrs.set(attr.name, attr.value);
    }
    const element = createElement(tagName, attrs);

    this.insertNode(element);

    // Don't push void elements onto the stack
    if (!VOID_ELEMENTS.has(tagName) && !token.selfClosing) {
      this.openElements.push(element);
    }
  }

  private processEndTag(token: { tagName: string }): void {
    const tagName = token.tagName;

    // Void elements never have end tags
    if (VOID_ELEMENTS.has(tagName)) return;

    // Walk up the stack looking for a matching open element
    for (let i = this.openElements.length - 1; i >= 0; i--) {
      if (this.openElements[i].tagName === tagName) {
        // Pop everything down to and including this element
        this.openElements.splice(i);
        return;
      }
    }

    // No matching open element found — ignore (error recovery)
  }

  private processText(token: { data: string }): void {
    if (token.data.length === 0) return;

    const textNode = createText(token.data);
    this.insertNode(textNode);
  }

  private processComment(token: { data: string }): void {
    const commentNode = createComment(token.data);
    this.insertNode(commentNode);
  }

  private insertNode(node: KNode): void {
    appendChild(this.currentNode, node);
  }

  private currentNodeIs(tagName: string): boolean {
    const current = this.currentNode;
    return current.type === KNodeType.Element && current.tagName === tagName;
  }

  private closePIfOpen(): void {
    // If the current node is <p>, close it
    if (this.currentNodeIs("p")) {
      this.openElements.pop();
    }
  }

  private closeIfInScope(tagName: string): void {
    for (let i = this.openElements.length - 1; i >= 0; i--) {
      const el = this.openElements[i];
      if (el.tagName === tagName) {
        this.openElements.splice(i);
        return;
      }
      // Stop at "scope barriers" — don't close across these elements
      if (
        el.tagName === "table" ||
        el.tagName === "html" ||
        el.tagName === "body" ||
        el.tagName === "template"
      ) {
        return;
      }
    }
  }
}
