import { KDocumentNode, KElementNode, KNodeType } from "./types.js";

// ─── Types ───

interface AttrMatcher {
  name: string;
  value?: string;
}

interface SimpleSelector {
  tag?: string;
  id?: string;
  classes: string[];
  attrs: AttrMatcher[];
}

/** A parsed selector: array of simple selectors (left = ancestor, right = target) */
export type ParsedSelector = SimpleSelector[];

// ─── Parsing ───

/**
 * Parse a CSS-like selector string into a structured form.
 *
 * Supports: tag, .class, #id, [attr], [attr=value], [attr="value"],
 * combinations (div.foo#bar), multiple classes (.a.b),
 * and descendant combinator (space).
 */
export function parseSelector(selector: string): ParsedSelector {
  const trimmed = selector.trim();
  if (!trimmed) throw new Error("Invalid selector: empty string");

  const parts = splitByDescendant(trimmed);
  return parts.map(parseSimpleSelector);
}

/** Split a selector string by whitespace, respecting brackets. */
function splitByDescendant(input: string): string[] {
  const parts: string[] = [];
  let current = "";
  let bracketDepth = 0;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === "[") {
      bracketDepth++;
      current += ch;
    } else if (ch === "]") {
      bracketDepth--;
      current += ch;
    } else if (ch === " " && bracketDepth === 0) {
      if (current) parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);

  if (parts.length === 0) throw new Error(`Invalid selector: "${input}"`);
  return parts;
}

/** Parse a single simple selector (no spaces) like "div.foo#bar[role=banner]" */
function parseSimpleSelector(input: string): SimpleSelector {
  const sel: SimpleSelector = { classes: [], attrs: [] };
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (ch === ".") {
      // Class
      i++;
      const start = i;
      while (i < input.length && isIdentChar(input[i])) i++;
      if (i === start) throw new Error(`Invalid selector: expected class name after '.' in "${input}"`);
      sel.classes.push(input.slice(start, i));
    } else if (ch === "#") {
      // ID
      i++;
      const start = i;
      while (i < input.length && isIdentChar(input[i])) i++;
      if (i === start) throw new Error(`Invalid selector: expected id after '#' in "${input}"`);
      sel.id = input.slice(start, i);
    } else if (ch === "[") {
      // Attribute
      i++;
      const start = i;
      while (i < input.length && input[i] !== "=" && input[i] !== "]") i++;
      const attrName = input.slice(start, i).trim();
      if (!attrName) throw new Error(`Invalid selector: empty attribute in "${input}"`);

      if (i < input.length && input[i] === "=") {
        i++; // skip =
        let value: string;
        if (i < input.length && (input[i] === '"' || input[i] === "'")) {
          const quote = input[i];
          i++; // skip opening quote
          const vStart = i;
          while (i < input.length && input[i] !== quote) i++;
          value = input.slice(vStart, i);
          if (i < input.length) i++; // skip closing quote
        } else {
          const vStart = i;
          while (i < input.length && input[i] !== "]") i++;
          value = input.slice(vStart, i).trim();
        }
        sel.attrs.push({ name: attrName, value });
      } else {
        sel.attrs.push({ name: attrName });
      }

      if (i < input.length && input[i] === "]") i++;
    } else if (isIdentChar(ch)) {
      // Tag name (must be at the start, before qualifiers)
      const start = i;
      while (i < input.length && isIdentChar(input[i])) i++;
      sel.tag = input.slice(start, i).toLowerCase();
    } else {
      throw new Error(`Invalid selector: unexpected character '${ch}' in "${input}"`);
    }
  }

  if (!sel.tag && !sel.id && sel.classes.length === 0 && sel.attrs.length === 0) {
    throw new Error(`Invalid selector: "${input}"`);
  }

  return sel;
}

function isIdentChar(ch: string): boolean {
  return /[a-zA-Z0-9_-]/.test(ch);
}

// ─── Matching ───

/** Check if a KElementNode matches a parsed selector (with descendant chain). */
export function matchesSelector(
  node: KElementNode,
  parsed: ParsedSelector,
): boolean {
  if (parsed.length === 0) return false;

  // The last simple selector must match the node itself
  if (!matchesSimple(node, parsed[parsed.length - 1])) return false;

  // Walk up the ancestor chain for each preceding selector (right to left)
  let current: KElementNode | KDocumentNode | null = node.parent;
  for (let i = parsed.length - 2; i >= 0; i--) {
    let found = false;
    while (current) {
      if (current.type === KNodeType.Element && matchesSimple(current, parsed[i])) {
        current = current.parent;
        found = true;
        break;
      }
      current = current.parent;
    }
    if (!found) return false;
  }

  return true;
}

/** Check if a node matches a single SimpleSelector. */
function matchesSimple(node: KElementNode, sel: SimpleSelector): boolean {
  if (sel.tag && node.tagName !== sel.tag) return false;

  if (sel.id) {
    const nodeId = node.attributes.get("id") ?? "";
    if (nodeId !== sel.id) return false;
  }

  if (sel.classes.length > 0) {
    const nodeClasses = (node.attributes.get("class") ?? "").split(/\s+/).filter(Boolean);
    for (const cls of sel.classes) {
      if (!nodeClasses.includes(cls)) return false;
    }
  }

  for (const attr of sel.attrs) {
    if (attr.value !== undefined) {
      if (node.attributes.get(attr.name) !== attr.value) return false;
    } else {
      if (!node.attributes.has(attr.name)) return false;
    }
  }

  return true;
}

// ─── Query Functions ───

/** Find all descendant elements matching a CSS-like selector string. */
export function querySelectorAll(
  root: KElementNode | KDocumentNode,
  selector: string,
): KElementNode[] {
  const parsed = parseSelector(selector);
  const results: KElementNode[] = [];
  walkElements(root, (el) => {
    if (matchesSelector(el, parsed)) results.push(el);
  });
  return results;
}

/** Find the first descendant element matching a CSS-like selector string. */
export function querySelectorOne(
  root: KElementNode | KDocumentNode,
  selector: string,
): KElementNode | null {
  const parsed = parseSelector(selector);
  return findElement(root, (el) => matchesSelector(el, parsed));
}

/** Walk all element descendants, calling fn for each. */
function walkElements(
  node: KElementNode | KDocumentNode,
  fn: (el: KElementNode) => void,
): void {
  for (const child of node.children) {
    if (child.type === KNodeType.Element) {
      fn(child);
      walkElements(child, fn);
    }
  }
}

/** Find the first element descendant satisfying a predicate. */
function findElement(
  node: KElementNode | KDocumentNode,
  predicate: (el: KElementNode) => boolean,
): KElementNode | null {
  for (const child of node.children) {
    if (child.type === KNodeType.Element) {
      if (predicate(child)) return child;
      const found = findElement(child, predicate);
      if (found) return found;
    }
  }
  return null;
}
