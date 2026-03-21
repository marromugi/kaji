# Yunagi (夕凪)

> **夕凪 (yunagi)** — Japanese for "evening calm." The moment when the sea wind stills and the ocean surface becomes perfectly calm. Yunagi takes the turbulent sea of HTML and delivers serene, readable Markdown.

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
| [yunagi](packages/yunagi) | Core library and CLI |
| [@yunagi/mcp](packages/mcp) | MCP server |

## Getting Started

```bash
bun install
bun run build
```

## CLI Usage

```bash
# Basic usage
yunagi https://example.com/article

# Output to file
yunagi https://example.com -o article.md

# With robots.txt compliance
yunagi https://example.com --respect-robots-txt

# Custom filtering
yunagi https://example.com --remove ".sidebar" --remove ".ad"

# Select specific content
yunagi https://example.com --select "article.main"

# From stdin
cat page.html | yunagi --stdin
```

## Programmatic API

```typescript
import { toMarkdown, htmlToMarkdown } from 'yunagi'

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

Create a `yunagi.config.json` in your project root:

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

- **`yunagi_convert`** - Fetch a URL, extract main content, and convert to Markdown
- **`yunagi_select`** - Extract elements matching a CSS selector as HTML
- **`yunagi_select_markdown`** - Extract elements matching a CSS selector as Markdown

### Setup for Claude Desktop

```json
{
  "mcpServers": {
    "yunagi": {
      "command": "npx",
      "args": ["@yunagi/mcp"]
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
