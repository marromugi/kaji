import { parseArgs } from "node:util";
import { readFileSync, writeFileSync } from "node:fs";
import { kaji, kajiFromHtml } from "./kaji.js";
import type { KajiOptions, ConverterOptions } from "./types.js";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    help: { type: "boolean", short: "h" },
    version: { type: "boolean", short: "v" },
    output: { type: "string", short: "o" },
    "heading-style": { type: "string" },
    "bullet-marker": { type: "string" },
    stdin: { type: "boolean" },
    "respect-robots-txt": { type: "boolean" },
    force: { type: "boolean", short: "f" },
  },
});

function printHelp() {
  console.log(`Usage: kaji <url-or-file> [options]

Extract main content from web pages and convert to Markdown.

Arguments:
  <url-or-file>      URL or local file path

Options:
  -h, --help              Show this help
  -v, --version           Show version
  -o, --output FILE       Write output to file
  --stdin                 Read HTML from stdin
  --heading-style         Heading style: atx (default) or setext
  --bullet-marker         Bullet marker: - (default), *, or +
  --respect-robots-txt    Check robots.txt before fetching (error if blocked)
  -f, --force             With --respect-robots-txt, warn instead of error

Examples:
  kaji https://example.com/article
  kaji page.html
  kaji https://example.com -o article.md
  kaji https://example.com --respect-robots-txt
  kaji https://example.com --respect-robots-txt --force
  cat page.html | kaji --stdin`);
}

function buildOptions(): KajiOptions {
  const converter: Partial<ConverterOptions> = {};
  if (values["heading-style"] === "setext") {
    converter.headingStyle = "setext";
  }
  if (values["bullet-marker"] === "*" || values["bullet-marker"] === "+" || values["bullet-marker"] === "-") {
    converter.bulletListMarker = values["bullet-marker"];
  }
  return { converter };
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

async function main() {
  if (values.help) {
    printHelp();
    return;
  }

  if (values.version) {
    console.log("kaji 0.1.0");
    return;
  }

  let markdown: string;

  if (values.stdin) {
    const html = await readStdin();
    const result = kajiFromHtml(html, buildOptions());
    markdown = result.markdown;
  } else if (positionals[0]) {
    const input = positionals[0];
    if (input.startsWith("http://") || input.startsWith("https://")) {
      const opts = {
        ...buildOptions(),
        respectRobotsTxt: !!values["respect-robots-txt"],
        force: !!values.force,
      };
      const result = await kaji(input, opts);
      markdown = result.markdown;
    } else {
      const html = readFileSync(input, "utf-8");
      const result = kajiFromHtml(html, buildOptions());
      markdown = result.markdown;
    }
  } else {
    printHelp();
    process.exit(1);
  }

  if (values.output) {
    writeFileSync(values.output, markdown, "utf-8");
  } else {
    process.stdout.write(markdown);
  }
}

main().catch((err) => {
  console.error(`kaji: ${(err as Error).message}`);
  process.exit(1);
});
