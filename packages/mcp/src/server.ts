import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import {
  toMarkdown,
  loadConfig,
  mergeConfig,
  Tokenizer,
  TreeBuilder,
  querySelectorAll,
  MarkdownConverter,
  KNodeType,
  type KNode,
  type KElementNode,
  type KDocumentNode,
  type YunagiConfig,
} from "yunagi";

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
    headers: { "User-Agent": "yunagi/0.1" },
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
    name: "yunagi-mcp",
    version: "0.1.0",
  });

  // ── Tool 1: yunagi_convert ──

  server.registerTool(
    "yunagi_convert",
    {
      description: "Fetch a web page and convert its main content to Markdown",
      inputSchema: {
        url: z.string().describe("URL of the page to fetch"),
        config: z.string().optional().describe("Path to yunagi.config.json (default: ./yunagi.config.json in CWD)"),
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
      config: configPath,
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
      const result = await toMarkdown(url, {
        config: configPath,
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

  // ── Tool 2: yunagi_select ──

  server.registerTool(
    "yunagi_select",
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

  // ── Tool 3: yunagi_select_markdown ──

  server.registerTool(
    "yunagi_select_markdown",
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

  // ── Tool 4: yunagi_config ──

  const siteRuleSchema = z.object({
    url: z.string().describe("URL substring to match (e.g. \"zenn.dev\")"),
    remove: z.array(z.string()).optional().describe("CSS selectors for elements to remove"),
    include: z.array(z.string()).optional().describe("CSS selectors for elements to protect"),
    select: z.string().optional().describe("CSS selector for the main content container"),
  });

  server.registerTool(
    "yunagi_config",
    {
      description:
        "Read or write a yunagi.config.json configuration file. " +
        "When called without siteRules/options, reads the current config. " +
        "When called with siteRules/options, writes them to the config file.",
      inputSchema: {
        path: z
          .string()
          .optional()
          .describe("Path to config file (default: ./yunagi.config.json in CWD)"),
        siteRules: z
          .array(siteRuleSchema)
          .optional()
          .describe("Domain-specific rules to write"),
        charThreshold: z.number().optional().describe("Minimum character count for extraction"),
        keepImages: z.boolean().optional().describe("Keep images in output"),
        respectRobotsTxt: z.boolean().optional().describe("Check robots.txt before fetching"),
        remove: z.array(z.string()).optional().describe("Global CSS selectors to remove"),
        include: z.array(z.string()).optional().describe("Global CSS selectors to protect"),
        select: z.string().optional().describe("Global CSS selector for main content"),
        headingStyle: z.enum(["atx", "setext"]).optional().describe("Heading style"),
        bulletListMarker: z.enum(["*", "-", "+"]).optional().describe("Bullet list marker"),
        codeBlockStyle: z.enum(["fenced", "indented"]).optional().describe("Code block style"),
        linkStyle: z.enum(["inlined", "referenced"]).optional().describe("Link style"),
      },
    },
    async ({
      path: configPath,
      siteRules,
      charThreshold,
      keepImages,
      respectRobotsTxt,
      remove,
      include,
      select,
      headingStyle,
      bulletListMarker,
      codeBlockStyle,
      linkStyle,
    }) => {
      const hasWriteFields =
        siteRules !== undefined ||
        charThreshold !== undefined ||
        keepImages !== undefined ||
        respectRobotsTxt !== undefined ||
        remove !== undefined ||
        include !== undefined ||
        select !== undefined ||
        headingStyle !== undefined ||
        bulletListMarker !== undefined ||
        codeBlockStyle !== undefined ||
        linkStyle !== undefined;

      // ── Read mode ──
      if (!hasWriteFields) {
        const config = loadConfig(configPath);
        if (!config) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No yunagi.config.json found. You can create one by calling this tool with siteRules or other options.",
              },
            ],
          };
        }
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(config, null, 2),
            },
          ],
        };
      }

      // ── Write mode ──
      // Load existing config to merge with new values
      let existing: YunagiConfig = {};
      try {
        existing = loadConfig(configPath) ?? {};
      } catch {
        // No existing config, start fresh
      }

      const converter = {
        ...existing.converter,
        ...(headingStyle && { headingStyle }),
        ...(bulletListMarker && { bulletListMarker }),
        ...(codeBlockStyle && { codeBlockStyle }),
        ...(linkStyle && { linkStyle }),
      };

      const newConfig: YunagiConfig = {
        ...existing,
        ...(charThreshold !== undefined && { charThreshold }),
        ...(keepImages !== undefined && { keepImages }),
        ...(respectRobotsTxt !== undefined && { respectRobotsTxt }),
        ...(remove !== undefined && { remove }),
        ...(include !== undefined && { include }),
        ...(select !== undefined && { select }),
        ...(siteRules !== undefined && { siteRules }),
        ...(Object.keys(converter).length > 0 && { converter }),
      };

      const filePath = configPath
        ? resolve(configPath)
        : resolve(process.cwd(), "yunagi.config.json");
      const json = JSON.stringify(newConfig, null, 2);
      writeFileSync(filePath, json + "\n", "utf-8");

      return {
        content: [
          {
            type: "text" as const,
            text: `Config written to ${filePath}:\n\n${json}`,
          },
        ],
      };
    },
  );

  return server;
}
