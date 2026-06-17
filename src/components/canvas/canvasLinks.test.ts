import { describe, expect, it } from "vitest";
import {
  createCanvasLinkFromUrl,
  normalizeCanvasLinkUrl,
  sourceDomainFromUrl,
} from "./canvasLinks";

describe("canvas link helpers", () => {
  it("normalizes http links and rejects unsupported protocols", () => {
    expect(normalizeCanvasLinkUrl("example.com/path")).toBe("https://example.com/path");
    expect(normalizeCanvasLinkUrl("https://openai.com/docs")).toBe(
      "https://openai.com/docs",
    );
    expect(normalizeCanvasLinkUrl("file:///Users/example/file.txt")).toBeNull();
    expect(normalizeCanvasLinkUrl("   ")).toBeNull();
  });

  it("extracts display domains and builds link cards", () => {
    const link = createCanvasLinkFromUrl(
      "https://www.example.com/research",
      { x: 20, y: 30 },
      "2026-06-17T08:00:00.000Z",
    );

    expect(sourceDomainFromUrl("https://www.example.com/research")).toBe("example.com");
    expect(sourceDomainFromUrl("not a url")).toBe("");
    expect(link).toMatchObject({
      url: "https://www.example.com/research",
      title: "example.com",
      sourceDomain: "example.com",
      capturedAt: "2026-06-17T08:00:00.000Z",
      x: 20,
      y: 30,
    });
    expect(link?.id).toMatch(/^link_/);
  });
});
