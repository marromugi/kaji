# yunagi

> **夕凪 (yunagi)** — the evening calm when the sea wind stills and the ocean surface becomes perfectly smooth.

Zero-dependency HTML-to-Markdown converter with content extraction. Takes turbulent HTML, delivers calm Markdown.

## Install

```bash
npm install yunagi
```

## CLI

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

Run `yunagi --help` for all options.

## API

```typescript
import { toMarkdown, htmlToMarkdown } from 'yunagi'

// Fetch URL and convert
const result = await toMarkdown('https://example.com', {
  respectRobotsTxt: true,
  remove: ['.sidebar', '.ad'],
  converter: { headingStyle: 'atx' },
})

console.log(result.markdown)
console.log(result.title)    // extracted page title
console.log(result.byline)   // extracted author
console.log(result.siteName) // extracted site name

// From HTML string
const result = htmlToMarkdown('<html>...</html>', {
  select: 'article.main',
  keepImages: true,
})
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `remove` | `string[]` | — | CSS selectors for elements to remove before extraction |
| `include` | `string[]` | — | CSS selectors for elements to protect from removal |
| `select` | `string` | — | CSS selector for main content container (bypasses heuristic) |
| `keepImages` | `boolean` | `true` | Keep images in output |
| `charThreshold` | `number` | `500` | Minimum character count for content extraction |
| `respectRobotsTxt` | `boolean` | `false` | Check robots.txt before fetching (`toMarkdown` only) |
| `force` | `boolean` | `false` | Warn instead of error on robots.txt block |
| `converter` | `ConverterOptions` | — | Markdown output options (see below) |
| `siteRules` | `SiteRule[]` | — | Domain-specific filtering rules |

### Converter Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `headingStyle` | `"atx"` \| `"setext"` | `"atx"` | `# Heading` vs underline style |
| `bulletListMarker` | `"*"` \| `"-"` \| `"+"` | `"-"` | Bullet list marker |
| `codeBlockStyle` | `"fenced"` \| `"indented"` | `"fenced"` | Code block style |
| `linkStyle` | `"inlined"` \| `"referenced"` | `"inlined"` | Link style |

## Configuration File

Create a `yunagi.config.json` in your project root:

```json
{
  "keepImages": true,
  "converter": {
    "headingStyle": "atx",
    "bulletListMarker": "-"
  },
  "remove": [".sidebar", ".ad"],
  "siteRules": [
    {
      "url": "zenn.dev",
      "remove": [".topic-badge"],
      "include": [".article-content"]
    }
  ]
}
```

## Advanced Usage

Individual pipeline components are exported for custom workflows:

```typescript
import {
  Tokenizer,
  TreeBuilder,
  extract,
  MarkdownConverter,
  querySelectorAll,
} from 'yunagi'

// Parse HTML
const tokens = new Tokenizer(html).tokenize()
const doc = new TreeBuilder().build(tokens)

// Extract content
const result = extract(doc, { charThreshold: 300 })

// Query elements
const elements = querySelectorAll(doc, 'article h2')

// Convert to Markdown
const converter = new MarkdownConverter({ headingStyle: 'setext' })
const markdown = converter.convert(result.content)
```

## License

MIT
