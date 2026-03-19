import { KElementNode, KNode, KNodeType } from "../types.js";
import { getTextContent, removeNode, getElementsByTagName } from "../parser/nodes.js";
import { STRIP_TAGS, NEGATIVE_PATTERN } from "./patterns.js";
import { getLinkDensity } from "./scorer.js";

/**
 * Clean the extracted content tree by removing non-content elements.
 * Operates in-place on the tree.
 */
export function cleanContent(node: KElementNode, keepImages: boolean): void {
  // Phase 1: Remove STRIP_TAGS
  removeByTags(node);

  // Phase 2: Remove elements with negative weight and low content
  removeNegativeWeight(node);

  // Phase 3: Remove empty elements
  removeEmpty(node, keepImages);

  // Phase 4: Remove high link-density elements
  removeHighLinkDensity(node);

  // Phase 5: Normalize lazy-loaded images
  normalizeLazyImages(node);
}

function removeByTags(node: KElementNode): void {
  const toRemove: KNode[] = [];
  for (const child of node.children) {
    if (child.type === KNodeType.Element) {
      if (STRIP_TAGS.has(child.tagName)) {
        toRemove.push(child);
      } else {
        removeByTags(child);
      }
    }
  }
  for (const el of toRemove) removeNode(el);
}

function removeNegativeWeight(node: KElementNode): void {
  const toRemove: KNode[] = [];
  for (const child of node.children) {
    if (child.type !== KNodeType.Element) continue;

    const cls = child.attributes.get("class") ?? "";
    const id = child.attributes.get("id") ?? "";
    const combined = cls + " " + id;

    if (NEGATIVE_PATTERN.test(combined)) {
      const text = getTextContent(child);
      if (text.length < 200) {
        toRemove.push(child);
        continue;
      }
    }
    removeNegativeWeight(child);
  }
  for (const el of toRemove) removeNode(el);
}

function removeEmpty(node: KElementNode, keepImages: boolean): void {
  const toRemove: KNode[] = [];
  for (const child of node.children) {
    if (child.type !== KNodeType.Element) continue;

    removeEmpty(child, keepImages);

    const text = getTextContent(child).trim();
    if (text.length === 0) {
      // Keep if it has images and we want images
      if (keepImages && hasImages(child)) continue;
      // Keep certain structural elements
      if (child.tagName === "br" || child.tagName === "hr" || child.tagName === "img") continue;
      toRemove.push(child);
    }
  }
  for (const el of toRemove) removeNode(el);
}

function removeHighLinkDensity(node: KElementNode): void {
  const toRemove: KNode[] = [];
  for (const child of node.children) {
    if (child.type !== KNodeType.Element) continue;

    // Don't remove certain important tags
    if (
      child.tagName === "p" ||
      child.tagName === "pre" ||
      child.tagName === "code" ||
      child.tagName === "blockquote"
    ) {
      removeHighLinkDensity(child);
      continue;
    }

    const density = getLinkDensity(child);
    const text = getTextContent(child);
    if (density > 0.5 && text.length < 500) {
      toRemove.push(child);
      continue;
    }

    removeHighLinkDensity(child);
  }
  for (const el of toRemove) removeNode(el);
}

function hasImages(node: KElementNode): boolean {
  if (node.tagName === "img") return true;
  return node.children.some((c) => c.type === KNodeType.Element && hasImages(c));
}

/** Normalize lazy-loaded images: copy data-src to src */
function normalizeLazyImages(node: KElementNode): void {
  const images = getElementsByTagName(node, "img");
  for (const img of images) {
    if (!img.attributes.get("src")) {
      const dataSrc =
        img.attributes.get("data-src") ??
        img.attributes.get("data-lazy-src") ??
        img.attributes.get("data-srcset");
      if (dataSrc) {
        img.attributes.set("src", dataSrc);
      }
    }
  }
}
