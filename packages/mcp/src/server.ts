import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  kaji,
  Tokenizer,
  TreeBuilder,
  querySelectorAll,
  MarkdownConverter,
  KNodeType,
  type KNode,
  type KElementNode,
  type KDocumentNode,
} from "@kaji/core";

const VOID_ELEMENTS = new Set([
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

function serializeToHtml(node: KNode | KDocumentNode): string {
  if (node.type === KNodeType.Text) {
    return node.data;
  }
  if (node.type === KNodeType.Comment) {
    return `<!--${node.data}-->`;
  }
  if (node.type === KNodeType.Document) {
    return node.children.map(serializeToHtml).join("");
  }
  // Element
  const el = node as KElementNode;
  const attrs = Array.from(el.attributes.entries())
    .map(([k, v]) => (v === "" ? k : `${k}="${v}"`))
    .join(" ");
  const open = attrs ? `<${el.tagName} ${attrs}>` : `<${el.tagName}>`;

  if (VOID_ELEMENTS.has(el.tagName)) {
    return open;
  }

  const inner = el.children.map(serializeToHtml).join("");
  return `${open}${inner}</${el.tagName}>`;
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "User-Agent": "kaji/0.1" },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.text();
}

function parseHtml(html: string): KDocumentNode {
  const tokenizer = new Tokenizer(html);
  const tokens = tokenizer.tokenize();
  const treeBuilder = new TreeBuilder();
  return treeBuilder.build(tokens);
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: "kaji-mcp",
    version: "0.1.0",
  });

  // ── Tool 1: kaji_convert ──

  server.registerTool(
    "kaji_convert",
    {
      description: "Fetch a web page and convert its main content to Markdown",
      inputSchema: {
        url: z.string().describe("URL of the page to fetch"),
        respectRobotsTxt: z.boolean().optional().describe("Check robots.txt before fetching"),
        force: z.boolean().optional().describe("Override robots.txt block"),
        remove: z
          .array(z.string())
          .optional()
          .describe("CSS selectors for elements to remove before extraction"),
        include: z
          .array(z.string())
          .optional()
          .describe("CSS selectors for elements to protect from removal"),
        select: z
          .string()
          .optional()
          .describe("CSS selector for the main content container (bypasses heuristic scoring)"),
        keepImages: z.boolean().optional().describe("Keep images in output (default: true)"),
        charThreshold: z
          .number()
          .optional()
          .describe("Minimum character count for content extraction (default: 500)"),
        headingStyle: z
          .enum(["atx", "setext"])
          .optional()
          .describe("Heading style (default: atx)"),
        bulletListMarker: z
          .enum(["*", "-", "+"])
          .optional()
          .describe("Bullet list marker (default: -)"),
        codeBlockStyle: z
          .enum(["fenced", "indented"])
          .optional()
          .describe("Code block style (default: fenced)"),
        linkStyle: z
          .enum(["inlined", "referenced"])
          .optional()
          .describe("Link style (default: inlined)"),
      },
    },
    async ({
      url,
      respectRobotsTxt,
      force,
      remove,
      include,
      select,
      keepImages,
      charThreshold,
      headingStyle,
      bulletListMarker,
      codeBlockStyle,
      linkStyle,
    }) => {
      const result = await kaji(url, {
        respectRobotsTxt,
        force,
        remove,
        include,
        select,
        keepImages,
        charThreshold,
        converter: {
          ...(headingStyle && { headingStyle }),
          ...(bulletListMarker && { bulletListMarker }),
          ...(codeBlockStyle && { codeBlockStyle }),
          ...(linkStyle && { linkStyle }),
        },
      });

      const meta = [
        result.title && `# ${result.title}`,
        result.byline && `Author: ${result.byline}`,
        result.siteName && `Site: ${result.siteName}`,
      ]
        .filter(Boolean)
        .join("\n");

      const text = meta ? `${meta}\n\n---\n\n${result.markdown}` : result.markdown;

      return { content: [{ type: "text" as const, text }] };
    },
  );

  // ── Tool 2: kaji_select ──

  server.registerTool(
    "kaji_select",
    {
      description: "Fetch a web page and extract elements matching a CSS selector as HTML",
      inputSchema: {
        url: z.string().describe("URL of the page to fetch"),
        selector: z.string().describe("CSS selector to match elements"),
      },
    },
    async ({ url, selector }) => {
      const html = await fetchHtml(url);
      const doc = parseHtml(html);
      const elements = querySelectorAll(doc, selector);

      if (elements.length === 0) {
        return {
          content: [
            { type: "text" as const, text: `No elements matched selector: ${selector}` },
          ],
        };
      }

      const results = elements.map((el, i) => `[${i + 1}] ${serializeToHtml(el)}`);
      return {
        content: [
          {
            type: "text" as const,
            text: `Found ${elements.length} element(s) matching "${selector}":\n\n${results.join("\n\n")}`,
          },
        ],
      };
    },
  );

  // ── Tool 3: kaji_select_markdown ──

  server.registerTool(
    "kaji_select_markdown",
    {
      description:
        "Fetch a web page, extract elements matching a CSS selector, and convert them to Markdown",
      inputSchema: {
        url: z.string().describe("URL of the page to fetch"),
        selector: z.string().describe("CSS selector to match elements"),
        headingStyle: z
          .enum(["atx", "setext"])
          .optional()
          .describe("Heading style (default: atx)"),
        bulletListMarker: z
          .enum(["*", "-", "+"])
          .optional()
          .describe("Bullet list marker (default: -)"),
        codeBlockStyle: z
          .enum(["fenced", "indented"])
          .optional()
          .describe("Code block style (default: fenced)"),
        linkStyle: z
          .enum(["inlined", "referenced"])
          .optional()
          .describe("Link style (default: inlined)"),
      },
    },
    async ({ url, selector, headingStyle, bulletListMarker, codeBlockStyle, linkStyle }) => {
      const html = await fetchHtml(url);
      const doc = parseHtml(html);
      const elements = querySelectorAll(doc, selector);

      if (elements.length === 0) {
        return {
          content: [
            { type: "text" as const, text: `No elements matched selector: ${selector}` },
          ],
        };
      }

      const converter = new MarkdownConverter({
        ...(headingStyle && { headingStyle }),
        ...(bulletListMarker && { bulletListMarker }),
        ...(codeBlockStyle && { codeBlockStyle }),
        ...(linkStyle && { linkStyle }),
      });

      const results = elements.map((el, i) => `[${i + 1}]\n${converter.convert(el)}`);
      return {
        content: [
          {
            type: "text" as const,
            text: `Found ${elements.length} element(s) matching "${selector}":\n\n${results.join("\n\n---\n\n")}`,
          },
        ],
      };
    },
  );

  return server;
}
