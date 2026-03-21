# @yunagi/mcp

MCP (Model Context Protocol) server that exposes [yunagi](../yunagi) as tools for LLM clients.

## Tools

### `yunagi_convert`

Fetch a web page and convert its main content to Markdown.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes | URL of the page to fetch |
| `respectRobotsTxt` | boolean | No | Check robots.txt before fetching |
| `force` | boolean | No | Override robots.txt block |
| `remove` | string[] | No | CSS selectors for elements to remove before extraction |
| `include` | string[] | No | CSS selectors for elements to protect from removal |
| `select` | string | No | CSS selector for main content container (bypasses heuristic scoring) |
| `keepImages` | boolean | No | Keep images in output (default: true) |
| `charThreshold` | number | No | Minimum character count for content extraction (default: 500) |
| `headingStyle` | `"atx"` \| `"setext"` | No | Heading style (default: atx) |
| `bulletListMarker` | `"*"` \| `"-"` \| `"+"` | No | Bullet list marker (default: -) |
| `codeBlockStyle` | `"fenced"` \| `"indented"` | No | Code block style (default: fenced) |
| `linkStyle` | `"inlined"` \| `"referenced"` | No | Link style (default: inlined) |

### `yunagi_select`

Fetch a web page and extract elements matching a CSS selector as HTML.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes | URL of the page to fetch |
| `selector` | string | Yes | CSS selector to match elements |

### `yunagi_select_markdown`

Fetch a web page, extract elements matching a CSS selector, and convert them to Markdown.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes | URL of the page to fetch |
| `selector` | string | Yes | CSS selector to match elements |
| `headingStyle` | `"atx"` \| `"setext"` | No | Heading style |
| `bulletListMarker` | `"*"` \| `"-"` \| `"+"` | No | Bullet list marker |
| `codeBlockStyle` | `"fenced"` \| `"indented"` | No | Code block style |
| `linkStyle` | `"inlined"` \| `"referenced"` | No | Link style |

## Setup

### Claude Desktop

Add to `claude_desktop_config.json`:

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

### Claude Code

```bash
claude mcp add yunagi npx @yunagi/mcp
```

## Build

```bash
bun install
bun run build
```
