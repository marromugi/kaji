import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";

function mockFetch(html: string, status = 200) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(html, {
      status,
      headers: { "Content-Type": "text/html" },
    }),
  );
}

describe("kaji-mcp server", () => {
  let client: Client;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = createServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);

    client = new Client({ name: "test-client", version: "1.0.0" });
    await client.connect(clientTransport);

    cleanup = async () => {
      await client.close();
      await server.close();
    };
  });

  afterAll(async () => {
    await cleanup();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("listTools", () => {
    it("should list all 4 tools", async () => {
      const { tools } = await client.listTools();
      const names = tools.map((t) => t.name);
      expect(names).toContain("kaji_convert");
      expect(names).toContain("kaji_select");
      expect(names).toContain("kaji_select_markdown");
      expect(names).toContain("kaji_config");
      expect(tools).toHaveLength(4);
    });

    it("kaji_convert should have url as required parameter", async () => {
      const { tools } = await client.listTools();
      const tool = tools.find((t) => t.name === "kaji_convert")!;
      expect(tool.inputSchema.required).toContain("url");
    });

    it("kaji_select should have url and selector as required parameters", async () => {
      const { tools } = await client.listTools();
      const tool = tools.find((t) => t.name === "kaji_select")!;
      expect(tool.inputSchema.required).toContain("url");
      expect(tool.inputSchema.required).toContain("selector");
    });
  });

  describe("kaji_convert", () => {
    it("should convert a page to markdown", async () => {
      const html = `
        <html>
          <head><title>Test Page</title></head>
          <body>
            <article>
              <h1>Hello World</h1>
              <p>This is a test article with enough content to pass the character threshold.
              We need to make sure the content is long enough for the extractor to pick it up.
              Adding more text here to ensure we have sufficient content for extraction.
              The kaji extractor uses a character threshold to determine valid content.
              This paragraph should contain enough text to meet that threshold easily.
              More content is always better for testing purposes and ensures reliability.
              Let us add even more text to be absolutely certain this works correctly.</p>
            </article>
          </body>
        </html>`;
      mockFetch(html);

      const result = await client.callTool({
        name: "kaji_convert",
        arguments: { url: "https://example.com/article" },
      });

      expect(result.content).toHaveLength(1);
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain("Hello World");
    });

    it("should include metadata in output", async () => {
      const html = `
        <html>
          <head>
            <title>My Article</title>
            <meta property="og:site_name" content="Test Blog">
            <meta name="author" content="John Doe">
          </head>
          <body>
            <article>
              <h1>My Article</h1>
              <address class="author">By John Doe</address>
              <p>This is a test article with enough content to pass the character threshold.
              We need to make sure the content is long enough for the extractor to pick it up.
              Adding more text here to ensure we have sufficient content for extraction.
              The kaji extractor uses a character threshold to determine valid content.
              This paragraph should contain enough text to meet that threshold easily.
              More content is always better for testing purposes and ensures reliability.</p>
            </article>
          </body>
        </html>`;
      mockFetch(html);

      const result = await client.callTool({
        name: "kaji_convert",
        arguments: { url: "https://example.com/article" },
      });

      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain("# My Article");
      expect(text).toContain("Site: Test Blog");
    });

    it("should handle fetch errors", async () => {
      mockFetch("Not Found", 404);

      const result = await client.callTool({
        name: "kaji_convert",
        arguments: { url: "https://example.com/missing" },
      });

      expect(result.isError).toBe(true);
    });
  });

  describe("kaji_select", () => {
    it("should select elements by CSS selector", async () => {
      const html = `
        <html>
          <body>
            <ul>
              <li class="item">First</li>
              <li class="item">Second</li>
              <li class="item">Third</li>
            </ul>
          </body>
        </html>`;
      mockFetch(html);

      const result = await client.callTool({
        name: "kaji_select",
        arguments: { url: "https://example.com", selector: ".item" },
      });

      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain("Found 3 element(s)");
      expect(text).toContain("First");
      expect(text).toContain("Second");
      expect(text).toContain("Third");
    });

    it("should return message when no elements match", async () => {
      const html = `<html><body><p>Hello</p></body></html>`;
      mockFetch(html);

      const result = await client.callTool({
        name: "kaji_select",
        arguments: { url: "https://example.com", selector: ".nonexistent" },
      });

      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain("No elements matched selector: .nonexistent");
    });

    it("should return HTML with attributes", async () => {
      const html = `
        <html>
          <body>
            <a href="https://example.com" class="link">Click me</a>
          </body>
        </html>`;
      mockFetch(html);

      const result = await client.callTool({
        name: "kaji_select",
        arguments: { url: "https://example.com", selector: "a" },
      });

      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain("href=");
      expect(text).toContain("Click me");
      expect(text).toContain("</a>");
    });
  });

  describe("kaji_select_markdown", () => {
    it("should select elements and convert to markdown", async () => {
      const html = `
        <html>
          <body>
            <div class="content">
              <h2>Section Title</h2>
              <p>Some paragraph with <strong>bold text</strong> and <a href="https://example.com">a link</a>.</p>
            </div>
          </body>
        </html>`;
      mockFetch(html);

      const result = await client.callTool({
        name: "kaji_select_markdown",
        arguments: { url: "https://example.com", selector: ".content" },
      });

      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain("Found 1 element(s)");
      expect(text).toContain("## Section Title");
      expect(text).toContain("**bold text**");
      expect(text).toContain("[a link](https://example.com)");
    });

    it("should return message when no elements match", async () => {
      const html = `<html><body><p>Hello</p></body></html>`;
      mockFetch(html);

      const result = await client.callTool({
        name: "kaji_select_markdown",
        arguments: { url: "https://example.com", selector: ".missing" },
      });

      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain("No elements matched selector: .missing");
    });

    it("should convert multiple matched elements", async () => {
      const html = `
        <html>
          <body>
            <section class="block"><h3>One</h3><p>First block</p></section>
            <section class="block"><h3>Two</h3><p>Second block</p></section>
          </body>
        </html>`;
      mockFetch(html);

      const result = await client.callTool({
        name: "kaji_select_markdown",
        arguments: { url: "https://example.com", selector: ".block" },
      });

      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain("Found 2 element(s)");
      expect(text).toContain("### One");
      expect(text).toContain("### Two");
      expect(text).toContain("---");
    });

    it("should handle void elements like img", async () => {
      const html = `
        <html>
          <body>
            <div class="card">
              <img src="photo.jpg" alt="A photo">
              <p>Caption text</p>
            </div>
          </body>
        </html>`;
      mockFetch(html);

      const result = await client.callTool({
        name: "kaji_select_markdown",
        arguments: { url: "https://example.com", selector: ".card" },
      });

      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain("Caption text");
    });
  });
});
