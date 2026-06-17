import {
  fetchLinkMetadata,
  normalizeFetchableUrl,
  parseLinkMetadataHtml,
} from "./linkMetadata";

function makeResponse(options: {
  ok?: boolean;
  contentType?: string;
  text?: string;
  bytes?: number[];
  streamText?: string;
}): Response {
  const headers = new Map<string, string>();
  if (options.contentType) headers.set("content-type", options.contentType);

  const body =
    options.streamText === undefined
      ? null
      : {
          getReader: () => {
            let sent = false;
            return {
              read: async () => {
                if (sent) return { done: true, value: undefined };
                sent = true;
                return {
                  done: false,
                  value: new TextEncoder().encode(options.streamText),
                };
              },
              cancel: async () => undefined,
            };
          },
        };

  return {
    ok: options.ok ?? true,
    body,
    headers: {
      get: (key: string) => headers.get(key.toLowerCase()) ?? null,
    },
    text: async () => options.text ?? "",
    arrayBuffer: async () => new Uint8Array(options.bytes ?? []).buffer,
  } as unknown as Response;
}

describe("normalizeFetchableUrl", () => {
  it("adds https when no protocol is present", () => {
    expect(normalizeFetchableUrl("example.com")).toBe("https://example.com/");
  });

  it("keeps an existing http or https protocol", () => {
    expect(normalizeFetchableUrl("http://example.com/path")).toBe(
      "http://example.com/path",
    );
  });

  it("rejects unsupported protocols and empty input", () => {
    expect(normalizeFetchableUrl("ftp://example.com")).toBeNull();
    expect(normalizeFetchableUrl("   ")).toBeNull();
    expect(normalizeFetchableUrl("javascript:alert(1)")).toBeNull();
  });
});

describe("parseLinkMetadataHtml", () => {
  it("extracts Open Graph metadata and resolves relative URLs", () => {
    const html = `
      <html><head>
        <meta property="og:title" content="Hello &amp; World" />
        <meta property="og:description" content="A short description" />
        <meta property="og:image" content="/preview.png" />
        <link rel="icon" href="/favicon.ico" />
      </head></html>`;

    const parsed = parseLinkMetadataHtml(html, "https://example.com/article");

    expect(parsed.title).toBe("Hello & World");
    expect(parsed.description).toBe("A short description");
    expect(parsed.imageUrl).toBe("https://example.com/preview.png");
    expect(parsed.faviconUrl).toBe("https://example.com/favicon.ico");
    expect(parsed.sourceDomain).toBe("example.com");
  });

  it("falls back to the document title and a default favicon", () => {
    const html = "<html><head><title>Plain Title</title></head></html>";

    const parsed = parseLinkMetadataHtml(html, "https://www.example.com/");

    expect(parsed.title).toBe("Plain Title");
    expect(parsed.description).toBeUndefined();
    expect(parsed.imageUrl).toBeUndefined();
    expect(parsed.faviconUrl).toBe("https://www.example.com/favicon.ico");
    expect(parsed.sourceDomain).toBe("example.com");
  });
});

describe("fetchLinkMetadata", () => {
  it("returns parsed metadata with images encoded as data URLs", async () => {
    const html = `
      <head>
        <meta property="og:title" content="Sample" />
        <meta property="og:image" content="https://example.com/p.png" />
        <link rel="icon" href="https://example.com/f.png" />
      </head>`;

    const fetchImpl = vi.fn(async (url: string) => {
      if (url === "https://example.com/") {
        return makeResponse({ contentType: "text/html", text: html });
      }
      return makeResponse({ contentType: "image/png", bytes: [1, 2, 3, 4] });
    });

    const metadata = await fetchLinkMetadata(
      "example.com",
      fetchImpl as unknown as typeof fetch,
    );

    expect(metadata.title).toBe("Sample");
    expect(metadata.sourceDomain).toBe("example.com");
    expect(metadata.imageUrl).toMatch(/^data:image\/png;base64,/);
    expect(metadata.faviconUrl).toMatch(/^data:image\/png;base64,/);
  });

  it("returns a minimal fallback when the response is not HTML", async () => {
    const fetchImpl = vi.fn(async () =>
      makeResponse({ contentType: "application/json", text: "{}" }),
    );

    const metadata = await fetchLinkMetadata(
      "https://example.com/data",
      fetchImpl as unknown as typeof fetch,
    );

    expect(metadata.url).toBe("https://example.com/data");
    expect(metadata.title).toBeUndefined();
    expect(metadata.imageUrl).toBeUndefined();
    expect(metadata.sourceDomain).toBe("example.com");
  });

  it("returns a fallback when the request fails", async () => {
    const fetchImpl = vi.fn(async () => makeResponse({ ok: false }));

    const metadata = await fetchLinkMetadata(
      "https://example.com",
      fetchImpl as unknown as typeof fetch,
    );

    expect(metadata.url).toBe("https://example.com/");
    expect(metadata.title).toBeUndefined();
  });

  it("throws for an invalid URL", async () => {
    await expect(fetchLinkMetadata("   ")).rejects.toThrow("Invalid link URL");
  });

  it("ignores non-image responses for the preview image", async () => {
    const html = `<head><meta property="og:image" content="https://example.com/p" /></head>`;
    const fetchImpl = vi.fn(async (url: string) => {
      if (url === "https://example.com/") {
        return makeResponse({ contentType: "text/html", text: html });
      }
      return makeResponse({ contentType: "text/plain", text: "not an image" });
    });

    const metadata = await fetchLinkMetadata(
      "https://example.com",
      fetchImpl as unknown as typeof fetch,
    );

    expect(metadata.imageUrl).toBeUndefined();
  });

  it("reads HTML from a streamed response body", async () => {
    const html = `<head><meta property="og:title" content="Streamed" /></head>`;
    const fetchImpl = vi.fn(async (url: string) => {
      if (url === "https://example.com/") {
        return makeResponse({ contentType: "text/html", streamText: html });
      }
      return makeResponse({ contentType: "image/png", bytes: [9, 9, 9] });
    });

    const metadata = await fetchLinkMetadata(
      "https://example.com",
      fetchImpl as unknown as typeof fetch,
    );

    expect(metadata.title).toBe("Streamed");
  });

  it("skips preview images that exceed the size cap", async () => {
    const html = `<head><meta property="og:image" content="https://example.com/big.png" /></head>`;
    const oversized = new Array(300_001).fill(0);
    const fetchImpl = vi.fn(async (url: string) => {
      if (url === "https://example.com/") {
        return makeResponse({ contentType: "text/html", text: html });
      }
      return makeResponse({ contentType: "image/png", bytes: oversized });
    });

    const metadata = await fetchLinkMetadata(
      "https://example.com",
      fetchImpl as unknown as typeof fetch,
    );

    expect(metadata.imageUrl).toBeUndefined();
  });

  it("returns a fallback when fetch rejects", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network down");
    });

    const metadata = await fetchLinkMetadata(
      "https://example.com",
      fetchImpl as unknown as typeof fetch,
    );

    expect(metadata.url).toBe("https://example.com/");
    expect(metadata.title).toBeUndefined();
  });

  it("ignores a preview image when the image request rejects", async () => {
    const html = `<head><meta property="og:image" content="https://example.com/p.png" /></head>`;
    const fetchImpl = vi.fn(async (url: string) => {
      if (url === "https://example.com/") {
        return makeResponse({ contentType: "text/html", text: html });
      }
      throw new Error("image failed");
    });

    const metadata = await fetchLinkMetadata(
      "https://example.com",
      fetchImpl as unknown as typeof fetch,
    );

    expect(metadata.imageUrl).toBeUndefined();
  });
});
