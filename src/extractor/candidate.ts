import { KElementNode, KNodeType } from "../types.js";
import { createElement, appendChild, getTextContent } from "../parser/nodes.js";
import { ScoredCandidate, getLinkDensity } from "./scorer.js";

/**
 * Select the best content candidate from scored nodes.
 *
 * 1. Adjust scores by link density: finalScore = contentScore * (1 - linkDensity)
 * 2. Sort by final score descending
 * 3. Return the top candidate
 * 4. If top candidate is a single-child wrapper, unwrap it
 */
export function selectCandidate(
  candidates: ScoredCandidate[],
  nTopCandidates: number,
): KElementNode | null {
  if (candidates.length === 0) return null;

  // Calculate final scores with link density penalty
  const scored = candidates.map((c) => ({
    node: c.node,
    finalScore: c.contentScore * (1 - getLinkDensity(c.node)),
  }));

  // Sort by score descending, take top N
  scored.sort((a, b) => b.finalScore - a.finalScore);
  const topN = scored.slice(0, nTopCandidates);

  if (topN.length === 0) return null;

  let topCandidate = topN[0].node;

  // If top candidate is a div with a single block child, use that child
  if (topCandidate.tagName === "div") {
    const blockChildren = topCandidate.children.filter(
      (c) =>
        c.type === KNodeType.Element &&
        (c.tagName === "div" || c.tagName === "article" || c.tagName === "section"),
    );
    if (blockChildren.length === 1 && blockChildren[0].type === KNodeType.Element) {
      topCandidate = blockChildren[0] as KElementNode;
    }
  }

  return topCandidate;
}

/**
 * Merge qualifying siblings of the top candidate into a wrapper element.
 * A sibling qualifies if:
 * - It has a score >= threshold (max(10, topScore * 0.2))
 * - It is a <p> with low link density and substantial text
 */
export function mergeSiblings(topCandidate: KElementNode, topScore: number): KElementNode {
  const parent = topCandidate.parent;
  if (!parent || parent.type !== KNodeType.Element) return topCandidate;

  const threshold = Math.max(10, topScore * 0.2);

  // Check if siblings qualify for merging
  const siblings = parent.children.filter((c) => c.type === KNodeType.Element) as KElementNode[];

  const qualifying = siblings.filter((sibling) => {
    if (sibling === topCandidate) return true;

    // Check score
    if (sibling._contentScore !== undefined && sibling._contentScore >= threshold) {
      return true;
    }

    // Check if it's a <p> with substantial text and low link density
    if (sibling.tagName === "p") {
      const text = getTextContent(sibling);
      if (text.length >= 80 && getLinkDensity(sibling) < 0.25) {
        return true;
      }
    }

    return false;
  });

  // If only the top candidate qualifies, return it as-is
  if (qualifying.length <= 1) return topCandidate;

  // Wrap qualifying siblings in a new div
  const wrapper = createElement("div", new Map());
  for (const sibling of qualifying) {
    appendChild(wrapper, sibling);
  }

  return wrapper;
}
