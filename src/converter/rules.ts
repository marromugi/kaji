import { ConversionRule, KElementNode, KNodeType } from "../types.js";
import { getTextContent } from "../parser/nodes.js";

function matchesFilter(filter: ConversionRule["filter"], node: KElementNode): boolean {
  if (typeof filter === "string") {
    return node.tagName === filter;
  }
  if (Array.isArray(filter)) {
    return filter.includes(node.tagName);
  }
  return filter(node);
}

export { matchesFilter };

/** Extract language hint from a <code> element's class (e.g. "language-js" → "js") */
function extractLanguage(node: KElementNode | undefined): string {
  if (!node) return "";
  const cls = node.attributes.get("class") ?? "";
  const match = cls.match(/(?:language|lang)-(\S+)/);
  return match ? match[1] : "";
}

/** Count longest consecutive backtick run in a string */
function longestBacktickRun(text: string): number {
  let max = 0;
  let current = 0;
  for (const ch of text) {
    if (ch === "`") {
      current++;
      if (current > max) max = current;
    } else {
      current = 0;
    }
  }
  return max;
}

/** Get the 1-based index of a <li> within its parent <ol> */
function getListItemIndex(node: KElementNode): number {
  const parent = node.parent;
  if (!parent || parent.type !== KNodeType.Element) return 1;
  let idx = 0;
  for (const child of parent.children) {
    if (child.type === KNodeType.Element && child.tagName === "li") {
      idx++;
      if (child === node) return idx;
    }
  }
  return 1;
}

/** Convert a <table> element to GFM markdown table */
function convertTable(node: KElementNode, processNode: (n: KElementNode) => string): string {
  const rows: string[][] = [];

  // Collect rows from thead, tbody, tfoot, or direct tr children
  const collectRows = (parent: KElementNode) => {
    for (const child of parent.children) {
      if (child.type !== KNodeType.Element) continue;
      if (child.tagName === "tr") {
        const cells: string[] = [];
        for (const cell of child.children) {
          if (cell.type === KNodeType.Element && (cell.tagName === "td" || cell.tagName === "th")) {
            cells.push(processNode(cell).trim().replace(/\|/g, "\\|").replace(/\n/g, " "));
          }
        }
        if (cells.length > 0) rows.push(cells);
      } else if (
        child.tagName === "thead" ||
        child.tagName === "tbody" ||
        child.tagName === "tfoot"
      ) {
        collectRows(child);
      }
    }
  };
  collectRows(node);

  if (rows.length === 0) return "";

  // Determine column count
  const colCount = Math.max(...rows.map((r) => r.length));

  // Pad rows to consistent column count
  for (const row of rows) {
    while (row.length < colCount) row.push("");
  }

  // Calculate column widths
  const widths = Array.from({ length: colCount }, (_, i) =>
    Math.max(3, ...rows.map((r) => r[i].length)),
  );

  // Build table
  const lines: string[] = [];

  // Header row
  const header = rows[0];
  lines.push("| " + header.map((cell, i) => cell.padEnd(widths[i])).join(" | ") + " |");

  // Separator
  lines.push("| " + widths.map((w) => "-".repeat(w)).join(" | ") + " |");

  // Data rows
  for (let r = 1; r < rows.length; r++) {
    lines.push("| " + rows[r].map((cell, i) => cell.padEnd(widths[i])).join(" | ") + " |");
  }

  return lines.join("\n");
}

/** Built-in rules, ordered by priority (first match wins) */
export function createBuiltinRules(processNode: (n: KElementNode) => string): ConversionRule[] {
  return [
    // ── Block rules ──
    {
      filter: "p",
      replacement: (content) => `\n\n${content}\n\n`,
    },

    {
      filter: ["h1", "h2", "h3", "h4", "h5", "h6"],
      replacement: (content, node, options) => {
        const level = parseInt(node.tagName[1], 10);
        if (options.headingStyle === "setext" && level <= 2) {
          const ch = level === 1 ? "=" : "-";
          return `\n\n${content}\n${ch.repeat(content.length)}\n\n`;
        }
        return `\n\n${"#".repeat(level)} ${content}\n\n`;
      },
    },

    {
      filter: "blockquote",
      replacement: (content) => {
        const trimmed = content.trim();
        const lines = trimmed.split("\n");
        const quoted = lines.map((line) => `> ${line}`).join("\n");
        return `\n\n${quoted}\n\n`;
      },
    },

    {
      filter: ["ul", "ol"],
      replacement: (content) => `\n\n${content.trim()}\n\n`,
    },

    {
      filter: "li",
      replacement: (content, node, options) => {
        const parent = node.parent;
        const isOrdered = parent?.type === KNodeType.Element && parent.tagName === "ol";
        const prefix = isOrdered ? `${getListItemIndex(node)}. ` : `${options.bulletListMarker} `;
        const indent = " ".repeat(prefix.length);
        const trimmed = content.trim();
        const lines = trimmed.split("\n");
        const result =
          prefix +
          lines[0] +
          lines
            .slice(1)
            .map((l) => `\n${indent}${l}`)
            .join("");
        return `${result}\n`;
      },
    },

    {
      // Fenced code block: <pre> containing <code>
      filter: (node) =>
        node.tagName === "pre" &&
        node.children.some((c) => c.type === KNodeType.Element && c.tagName === "code"),
      replacement: (_content, node, options) => {
        const codeNode = node.children.find(
          (c): c is KElementNode => c.type === KNodeType.Element && c.tagName === "code",
        );
        const lang = extractLanguage(codeNode);
        const code = getTextContent(codeNode ?? node);
        const fence = options.fence;
        return `\n\n${fence}${lang}\n${code}\n${fence}\n\n`;
      },
    },

    {
      // Bare <pre> without <code>
      filter: "pre",
      replacement: (_content, node, options) => {
        const code = getTextContent(node);
        const fence = options.fence;
        return `\n\n${fence}\n${code}\n${fence}\n\n`;
      },
    },

    {
      filter: "hr",
      replacement: (_content, _node, options) => `\n\n${options.hr}\n\n`,
    },

    {
      filter: "br",
      replacement: () => "  \n",
    },

    {
      // Table (GFM)
      filter: "table",
      replacement: (_content, node) => `\n\n${convertTable(node, processNode)}\n\n`,
    },

    // ── Inline rules ──
    {
      filter: ["strong", "b"],
      replacement: (content, _node, options) =>
        content.trim()
          ? `${options.strongDelimiter}${content.trim()}${options.strongDelimiter}`
          : "",
    },

    {
      filter: ["em", "i"],
      replacement: (content, _node, options) =>
        content.trim() ? `${options.emDelimiter}${content.trim()}${options.emDelimiter}` : "",
    },

    {
      filter: "a",
      replacement: (content, node) => {
        const href = node.attributes.get("href") ?? "";
        const title = node.attributes.get("title");
        if (!href && !content) return "";
        const titlePart = title ? ` "${title}"` : "";
        return `[${content}](${href}${titlePart})`;
      },
    },

    {
      filter: "img",
      replacement: (_content, node) => {
        // Handle lazy-loaded images
        const src =
          node.attributes.get("src") ??
          node.attributes.get("data-src") ??
          node.attributes.get("data-lazy-src") ??
          "";
        const alt = node.attributes.get("alt") ?? "";
        const title = node.attributes.get("title");
        if (!src) return "";
        const titlePart = title ? ` "${title}"` : "";
        return `![${alt}](${src}${titlePart})`;
      },
    },

    {
      // Inline code: <code> NOT inside <pre>
      filter: (node) =>
        node.tagName === "code" &&
        !(node.parent?.type === KNodeType.Element && node.parent.tagName === "pre"),
      replacement: (content) => {
        const count = longestBacktickRun(content) + 1;
        const fence = "`".repeat(count);
        const pad = content.startsWith("`") || content.endsWith("`") ? " " : "";
        return `${fence}${pad}${content}${pad}${fence}`;
      },
    },

    {
      filter: "figure",
      replacement: (content) => `\n\n${content}\n\n`,
    },

    {
      filter: "figcaption",
      replacement: (content) => (content.trim() ? `\n*${content.trim()}*\n` : ""),
    },
  ];
}
