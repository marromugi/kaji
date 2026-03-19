import {
  KNodeType,
  KDocumentNode,
  KElementNode,
  KTextNode,
  KCommentNode,
  KNode,
} from "../types.js";

export const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

export const RAW_TEXT_ELEMENTS = new Set(["script", "style", "xmp"]);
export const RCDATA_ELEMENTS = new Set(["title", "textarea"]);

export const BLOCK_ELEMENTS = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "dd",
  "details",
  "dialog",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hgroup",
  "hr",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "summary",
  "table",
  "ul",
]);

/** Elements that auto-close an open <p> */
export const P_CLOSING_ELEMENTS = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "details",
  "div",
  "dl",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hgroup",
  "hr",
  "li",
  "main",
  "menu",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "summary",
  "table",
  "ul",
]);

export function createDocument(): KDocumentNode {
  return { type: KNodeType.Document, parent: null, children: [] };
}

export function createElement(tagName: string, attributes: Map<string, string>): KElementNode {
  return {
    type: KNodeType.Element,
    tagName,
    attributes,
    children: [],
    parent: null,
  };
}

export function createText(data: string): KTextNode {
  return { type: KNodeType.Text, data, parent: null };
}

export function createComment(data: string): KCommentNode {
  return { type: KNodeType.Comment, data, parent: null };
}

/** Get all text content of a node tree recursively */
export function getTextContent(node: KNode | KDocumentNode): string {
  if (node.type === KNodeType.Text) {
    return node.data;
  }
  if (node.type === KNodeType.Comment) {
    return "";
  }
  // Element or Document
  return node.children.map(getTextContent).join("");
}

/** Get attribute value or empty string */
export function getAttribute(node: KElementNode, name: string): string {
  return node.attributes.get(name) ?? "";
}

/** Get all descendant elements matching a tag name */
export function getElementsByTagName(
  root: KElementNode | KDocumentNode,
  tagName: string,
): KElementNode[] {
  const results: KElementNode[] = [];
  for (const child of root.children) {
    if (child.type === KNodeType.Element) {
      if (child.tagName === tagName) {
        results.push(child);
      }
      results.push(...getElementsByTagName(child, tagName));
    }
  }
  return results;
}

/** Find first descendant element matching a tag name */
export function querySelector(
  root: KElementNode | KDocumentNode,
  tagName: string,
): KElementNode | null {
  for (const child of root.children) {
    if (child.type === KNodeType.Element) {
      if (child.tagName === tagName) return child;
      const found = querySelector(child, tagName);
      if (found) return found;
    }
  }
  return null;
}

/** Remove a child node from its parent */
export function removeNode(node: KNode): void {
  if (!node.parent) return;
  const parent = node.parent;
  const idx = parent.children.indexOf(node);
  if (idx !== -1) {
    parent.children.splice(idx, 1);
  }
  node.parent = null;
}

/** Append a child node to a parent */
export function appendChild(parent: KElementNode | KDocumentNode, child: KNode): void {
  child.parent = parent;
  parent.children.push(child);
}
