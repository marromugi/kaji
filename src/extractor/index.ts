import { ExtractionResult, KDocumentNode, KElementNode, KNodeType, KajiOptions } from "../types.js";
import {
  getTextContent,
  getElementsByTagName,
  querySelector,
  removeNode,
  createElement,
  appendChild,
} from "../parser/nodes.js";
import {
  UNLIKELY_CANDIDATES,
  MAYBE_CANDIDATES,
  DIV_TO_P_BLOCK_TAGS,
  STRIP_TAGS,
} from "./patterns.js";
import { scoreDocument } from "./scorer.js";
import { selectCandidate, mergeSiblings } from "./candidate.js";
import { cleanContent } from "./cleaner.js";
import { extractTitle, extractByline, extractSiteName } from "./metadata.js";

/**
 * Main extraction function: takes a parsed document tree,
 * returns the extracted content subtree with metadata.
 */
export function extract(doc: KDocumentNode, options?: KajiOptions): ExtractionResult {
  const charThreshold = options?.charThreshold ?? 500;
  const nTopCandidates = options?.nTopCandidates ?? 5;
  const keepImages = options?.keepImages ?? true;

  // Extract metadata before modifying the tree
  const title = extractTitle(doc);
  const byline = extractByline(doc);
  const siteName = extractSiteName(doc);

  // Find <body> (or use entire doc)
  const body =
    querySelector(doc, "body") ??
    (() => {
      // Create a virtual body from doc's element children
      const vBody = createElement("body", new Map());
      for (const child of [...doc.children]) {
        if (child.type === KNodeType.Element) {
          appendChild(vBody, child);
        }
      }
      return vBody;
    })();

  // Phase 1: Remove script/style/etc.
  for (const tag of STRIP_TAGS) {
    const elements = getElementsByTagName(body, tag);
    for (const el of elements) removeNode(el);
  }

  // Phase 2: Remove unlikely candidates
  removeUnlikelyCandidates(body);

  // Phase 3: Convert divs with no block children to p
  convertDivsToPs(body);

  // Phase 4: Score and select
  const candidates = scoreDocument(body);
  let topCandidate = selectCandidate(candidates, nTopCandidates);

  // Fallback: use body if no candidate found
  if (!topCandidate) {
    topCandidate = body;
  }

  // Phase 5: Merge qualifying siblings
  const topScore = candidates.find((c) => c.node === topCandidate)?.contentScore ?? 0;
  const article = mergeSiblings(topCandidate, topScore);

  // Phase 6: Clean the result
  cleanContent(article, keepImages);

  // Check character threshold — if too short, retry with body
  const text = getTextContent(article);
  if (text.trim().length < charThreshold && article !== body) {
    // Fallback to body
    cleanContent(body, keepImages);
    const bodyText = getTextContent(body);
    if (bodyText.trim().length > text.trim().length) {
      return buildResult(body, title, byline, siteName);
    }
  }

  return buildResult(article, title, byline, siteName);
}

function buildResult(
  content: KElementNode,
  title: string,
  byline: string | null,
  siteName: string | null,
): ExtractionResult {
  const text = getTextContent(content).trim();
  const excerpt = text.slice(0, 200).replace(/\s+/g, " ").trim();

  return { title, content, excerpt, byline, siteName };
}

/** Remove elements matching UNLIKELY_CANDIDATES (unless they also match MAYBE_CANDIDATES) */
function removeUnlikelyCandidates(body: KElementNode): void {
  const toRemove: KElementNode[] = [];

  const walk = (el: KElementNode) => {
    for (const child of el.children) {
      if (child.type !== KNodeType.Element) continue;

      // Never remove body, article, or content-related tags
      if (child.tagName === "body" || child.tagName === "article" || child.tagName === "main") {
        walk(child);
        continue;
      }

      const cls = child.attributes.get("class") ?? "";
      const id = child.attributes.get("id") ?? "";
      const combined = cls + " " + id;

      if (UNLIKELY_CANDIDATES.test(combined) && !MAYBE_CANDIDATES.test(combined)) {
        toRemove.push(child);
      } else {
        walk(child);
      }
    }
  };

  walk(body);
  for (const el of toRemove) removeNode(el);
}

/** Convert divs with no block children into p elements */
function convertDivsToPs(body: KElementNode): void {
  const divs = getElementsByTagName(body, "div");

  for (const div of divs) {
    const hasBlockChild = div.children.some(
      (c) => c.type === KNodeType.Element && DIV_TO_P_BLOCK_TAGS.has(c.tagName),
    );

    if (!hasBlockChild) {
      // Convert this div to a p by changing the tagName
      (div as unknown as { tagName: string }).tagName = "p";
    }
  }
}
