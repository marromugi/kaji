import { KDocumentNode, KNodeType } from "../types.js";
import { getTextContent, getElementsByTagName, querySelector } from "../parser/nodes.js";
import { BYLINE_PATTERN } from "./patterns.js";

/** Extract the article title from the document */
export function extractTitle(doc: KDocumentNode): string {
  // 1. Try og:title
  const metas = getElementsByTagName(doc, "meta");
  for (const meta of metas) {
    const prop = meta.attributes.get("property") ?? meta.attributes.get("name") ?? "";
    if (prop === "og:title" || prop === "twitter:title") {
      const content = meta.attributes.get("content") ?? "";
      if (content) return content.trim();
    }
  }

  // 2. Try <title>
  const titleEl = querySelector(doc, "title");
  if (titleEl) {
    let title = getTextContent(titleEl).trim();
    // Remove site name suffix: "Article Title - Site Name" or "Article Title | Site"
    const separators = [" - ", " | ", " — ", " :: ", " / "];
    for (const sep of separators) {
      const idx = title.lastIndexOf(sep);
      if (idx > 0 && idx > title.length * 0.3) {
        title = title.slice(0, idx).trim();
        break;
      }
    }
    if (title) return title;
  }

  // 3. Try first <h1>
  const h1 = querySelector(doc, "h1");
  if (h1) return getTextContent(h1).trim();

  return "";
}

/** Extract byline/author from the document */
export function extractByline(doc: KDocumentNode): string | null {
  // Check meta tags
  const metas = getElementsByTagName(doc, "meta");
  for (const meta of metas) {
    const name = meta.attributes.get("name") ?? "";
    if (name === "author") {
      const content = meta.attributes.get("content") ?? "";
      if (content) return content.trim();
    }
  }

  // Search for elements with byline patterns in class/id/rel
  const walk = (parent: { children: any[] }): string | null => {
    for (const child of parent.children) {
      if (child.type !== KNodeType.Element) continue;
      const cls = child.attributes.get("class") ?? "";
      const id = child.attributes.get("id") ?? "";
      const rel = child.attributes.get("rel") ?? "";
      const combined = cls + " " + id + " " + rel;

      if (BYLINE_PATTERN.test(combined)) {
        const text = getTextContent(child).trim();
        if (text.length > 0 && text.length < 200) return text;
      }

      const found = walk(child);
      if (found) return found;
    }
    return null;
  };

  return walk(doc);
}

/** Extract site name from meta tags */
export function extractSiteName(doc: KDocumentNode): string | null {
  const metas = getElementsByTagName(doc, "meta");
  for (const meta of metas) {
    const prop = meta.attributes.get("property") ?? meta.attributes.get("name") ?? "";
    if (prop === "og:site_name") {
      const content = meta.attributes.get("content") ?? "";
      if (content) return content.trim();
    }
  }
  return null;
}
