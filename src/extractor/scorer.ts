import { KElementNode, KNodeType } from "../types.js";
import { getTextContent } from "../parser/nodes.js";
import { POSITIVE_PATTERN, NEGATIVE_PATTERN, CONTENT_TAGS } from "./patterns.js";

export interface ScoredCandidate {
  node: KElementNode;
  contentScore: number;
}

/** Get base score for an element by tag name */
export function getBaseScore(node: KElementNode): number {
  switch (node.tagName) {
    case "div":
    case "article":
    case "section":
      return 5;
    case "pre":
    case "td":
    case "blockquote":
      return 3;
    case "address":
    case "ul":
    case "ol":
    case "dl":
    case "dd":
    case "li":
    case "form":
      return -3;
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6":
    case "th":
      return -5;
    default:
      return 0;
  }
}

/** Get class/id weight: +25 for positive, -25 for negative patterns */
export function getClassWeight(node: KElementNode): number {
  let weight = 0;
  const cls = node.attributes.get("class") ?? "";
  const id = node.attributes.get("id") ?? "";
  const combined = cls + " " + id;

  if (POSITIVE_PATTERN.test(combined)) weight += 25;
  if (NEGATIVE_PATTERN.test(combined)) weight -= 25;

  return weight;
}

/** Calculate link density: ratio of link text to total text */
export function getLinkDensity(node: KElementNode): number {
  const totalText = getTextContent(node);
  if (totalText.length === 0) return 0;

  let linkLength = 0;
  const walkLinks = (el: KElementNode) => {
    for (const child of el.children) {
      if (child.type === KNodeType.Element) {
        if (child.tagName === "a") {
          linkLength += getTextContent(child).length;
        } else {
          walkLinks(child);
        }
      }
    }
  };
  walkLinks(node);

  return linkLength / totalText.length;
}

/** Initialize a candidate node if not already scored */
function initCandidate(node: KElementNode, candidates: Map<KElementNode, number>): void {
  if (!candidates.has(node)) {
    candidates.set(node, getBaseScore(node) + getClassWeight(node));
  }
}

/**
 * Score all candidate paragraphs and propagate scores to ancestors.
 *
 * For each paragraph-like element with ≥25 chars of text:
 *   score = 1 + commaCount + min(floor(textLen/100), 3)
 * Propagate: parent gets full, grandparent gets half, deeper ancestors get 1/(level*3)
 */
export function scoreDocument(body: KElementNode): ScoredCandidate[] {
  const candidates = new Map<KElementNode, number>();

  const walk = (el: KElementNode) => {
    for (const child of el.children) {
      if (child.type !== KNodeType.Element) continue;

      if (CONTENT_TAGS.has(child.tagName)) {
        const text = getTextContent(child);
        if (text.length < 25) continue;

        const commaCount = (text.match(/,|、/g) ?? []).length;
        const innerScore = 1 + commaCount + Math.min(Math.floor(text.length / 100), 3);

        // Propagate to ancestors
        let current = child.parent;
        let level = 0;
        while (current && current.type === KNodeType.Element) {
          initCandidate(current, candidates);
          const divisor = level === 0 ? 1 : level === 1 ? 2 : level * 3;
          candidates.set(
            current,
            candidates.get(current)! + innerScore / divisor,
          );
          current = current.parent;
          level++;
          if (level > 5) break;
        }
      } else {
        walk(child);
      }
    }
  };

  walk(body);

  return Array.from(candidates.entries()).map(([node, contentScore]) => ({
    node,
    contentScore,
  }));
}
