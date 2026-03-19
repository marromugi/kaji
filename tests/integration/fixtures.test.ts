import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { kajiFromHtml } from "../../src/kaji.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "../fixtures");

const fixtures = readdirSync(FIXTURES_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .filter((d) => existsSync(join(FIXTURES_DIR, d.name, "source.html")))
  .map((d) => d.name);

describe("Fixtures", () => {
  for (const fixture of fixtures) {
    it(`should extract and convert: ${fixture}`, () => {
      const dir = join(FIXTURES_DIR, fixture);
      const sourceHtml = readFileSync(join(dir, "source.html"), "utf-8");
      const result = kajiFromHtml(sourceHtml);

      // Basic sanity: should produce non-empty markdown
      expect(result.markdown.trim().length).toBeGreaterThan(0);

      // If expected.md exists, do content checks (not exact match for now)
      const expectedPath = join(dir, "expected.md");
      if (existsSync(expectedPath)) {
        const expectedMd = readFileSync(expectedPath, "utf-8");
        // Check that key content from expected.md appears in the output
        const expectedLines = expectedMd
          .split("\n")
          .filter((l) => l.trim().length > 20)
          .slice(0, 5);
        const strip = (s: string) => s.replace(/[\\*_`\[\]!#>~()\-]/g, "").replace(/\s+/g, " ").trim();
        const strippedMd = strip(result.markdown);
        for (const line of expectedLines) {
          const phrase = strip(line);
          if (phrase.length > 10) {
            expect(strippedMd).toContain(phrase);
          }
        }
      }

      // Optional metadata assertions
      const metadataPath = join(dir, "metadata.json");
      if (existsSync(metadataPath)) {
        const metadata = JSON.parse(readFileSync(metadataPath, "utf-8"));
        if (metadata.title) expect(result.title).toBe(metadata.title);
        if (metadata.byline) expect(result.byline).toBe(metadata.byline);
        if (metadata.siteName) expect(result.siteName).toBe(metadata.siteName);
      }
    });
  }
});
