# Kaji (舵)

> **舵 (kaji)** — Japanese for "rudder." Just as a rudder steers a ship through the sea, Kaji steers you to the essential content within a sea of HTML.

A zero-dependency HTML-to-Markdown converter that extracts main content from web pages. Available as a library, CLI tool, and MCP server.

## Features

- **Content Extraction** - Identifies and extracts main article content using readability heuristics
- **HTML-to-Markdown** - Converts extracted content to clean, formatted Markdown
- **Metadata Extraction** - Extracts page title, author, site name, and excerpt
- **Site-Specific Filtering** - Custom CSS selectors to remove/include/select content per domain
- **robots.txt Support** - Optional robots.txt compliance checking
- **MCP Server** - Exposes functionality via Model Context Protocol for LLM clients

## Packages

| Package | Description |
| --- | --- |
| [@kaji/core](packages/core) | Core library and CLI |
| [@kaji/mcp](packages/mcp) | MCP server |

## Getting Started

```bash
bun install
bun run build
```

## CLI Usage

```bash
# Basic usage
kaji https://example.com/article

# Output to file
kaji https://example.com -o article.md

# With robots.txt compliance
kaji https://example.com --respect-robots-txt

# Custom filtering
kaji https://example.com --remove ".sidebar" --remove ".ad"

# Select specific content
kaji https://example.com --select "article.main"

# From stdin
cat page.html | kaji --stdin
```

## Programmatic API

```typescript
import { toMarkdown, htmlToMarkdown } from '@kaji/core'

// Fetch and convert
const result = await toMarkdown('https://example.com', {
  respectRobotsTxt: true,
  remove: ['.sidebar', '.ad'],
  converter: { headingStyle: 'setext' },
})

// From HTML string
const result = htmlToMarkdown(htmlString, options)
```

## Configuration

Create a `kaji.config.json` in your project root:

```json
{
  "keepImages": true,
  "respectRobotsTxt": false,
  "converter": {
    "headingStyle": "atx",
    "bulletListMarker": "-",
    "codeBlockStyle": "fenced",
    "linkStyle": "inlined"
  },
  "remove": [".sidebar", ".ad"],
  "include": [".main-content"],
  "select": "article.main",
  "siteRules": [
    {
      "url": "zenn.dev",
      "remove": [".topic-badge"],
      "include": [".article-content"]
    }
  ]
}
```

## MCP Server

The MCP server exposes 3 tools:

- **`kaji_convert`** - Fetch a URL, extract main content, and convert to Markdown
- **`kaji_select`** - Extract elements matching a CSS selector as HTML
- **`kaji_select_markdown`** - Extract elements matching a CSS selector as Markdown

### Setup for Claude Desktop

```json
{
  "mcpServers": {
    "kaji": {
      "command": "node",
      "args": ["/path/to/kaji/packages/mcp/dist/index.js"]
    }
  }
}
```

## Development

```bash
bun run dev            # Watch mode
bun run test           # Run tests
bun run typecheck      # Type checking
bun run lint           # Lint
bun run format         # Format
```

## License

MIT