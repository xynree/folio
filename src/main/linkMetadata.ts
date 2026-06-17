import type { LinkMetadata } from "../types";

const MAX_HTML_BYTES = 1_500_000;
// Preview images are inlined as data URLs inside canvases.json, so keep them
// small to avoid bloating board metadata.
const MAX_IMAGE_BYTES = 300_000;
const REQUEST_TIMEOUT_MS = 8000;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Folio/1.0 Safari/537.36";

type FetchLike = typeof fetch;

export function normalizeFetchableUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function sourceDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .trim();
}

function metaContent(
  html: string,
  attribute: "property" | "name",
  key: string,
): string | undefined {
  const pattern = new RegExp(
    `<meta[^>]+${attribute}=["']${key}["'][^>]*>`,
    "i",
  );
  const tag = html.match(pattern)?.[0];
  if (!tag) return undefined;
  const content = tag.match(/content=["']([^"']*)["']/i)?.[1];
  return content ? decodeHtmlEntities(content) : undefined;
}

function faviconHref(html: string): string | undefined {
  const linkTags = html.match(/<link[^>]+>/gi) ?? [];
  for (const tag of linkTags) {
    const rel = tag.match(/rel=["']([^"']*)["']/i)?.[1]?.toLowerCase();
    if (!rel || !rel.includes("icon")) continue;
    const href = tag.match(/href=["']([^"']*)["']/i)?.[1];
    if (href) return decodeHtmlEntities(href);
  }
  return undefined;
}

/** Extracts title, description, image, and favicon from raw HTML. */
export function parseLinkMetadataHtml(
  html: string,
  baseUrl: string,
): Omit<LinkMetadata, "url"> {
  const documentTitle =
    decodeHtmlEntities(
      html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "",
    ) || undefined;
  const title =
    metaContent(html, "property", "og:title") ??
    metaContent(html, "name", "twitter:title") ??
    documentTitle;

  const description =
    metaContent(html, "property", "og:description") ??
    metaContent(html, "name", "twitter:description") ??
    metaContent(html, "name", "description");

  const rawImage =
    metaContent(html, "property", "og:image:secure_url") ??
    metaContent(html, "property", "og:image") ??
    metaContent(html, "name", "twitter:image");
  const rawFavicon = faviconHref(html);

  return {
    title: title || undefined,
    description: description || undefined,
    sourceDomain: sourceDomainFromUrl(baseUrl),
    imageUrl: resolveUrl(rawImage, baseUrl),
    faviconUrl: resolveUrl(rawFavicon, baseUrl) ?? defaultFaviconUrl(baseUrl),
  };
}

function resolveUrl(
  value: string | undefined,
  baseUrl: string,
): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return undefined;
  }
}

function defaultFaviconUrl(baseUrl: string): string | undefined {
  try {
    const url = new URL(baseUrl);
    return `${url.origin}/favicon.ico`;
  } catch {
    return undefined;
  }
}

async function readLimitedText(
  response: Response,
  maxBytes: number,
): Promise<string> {
  const body = response.body;
  if (!body) return await response.text();

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (received < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;
    }
  }
  await reader.cancel().catch(() => undefined);

  const merged = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk.subarray(0, Math.max(0, maxBytes - offset)), offset);
    offset += chunk.length;
  }
  return new TextDecoder("utf-8").decode(merged);
}

async function fetchImageAsDataUrl(
  imageUrl: string | undefined,
  fetchImpl: FetchLike,
): Promise<string | undefined> {
  if (!imageUrl) return undefined;
  try {
    const response = await fetchWithTimeout(imageUrl, fetchImpl);
    if (!response.ok) return undefined;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) return undefined;

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_IMAGE_BYTES) return undefined;
    const base64 = Buffer.from(buffer).toString("base64");
    return `data:${contentType};base64,${base64}`;
  } catch {
    return undefined;
  }
}

async function fetchWithTimeout(
  url: string,
  fetchImpl: FetchLike,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetchImpl(url, {
      headers: { "user-agent": USER_AGENT, accept: "*/*" },
      redirect: "follow",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetches a remote page and returns preview metadata. Images and favicons are
 * returned as data URLs so the renderer can display them under the app CSP.
 */
export async function fetchLinkMetadata(
  rawUrl: string,
  fetchImpl: FetchLike = fetch,
): Promise<LinkMetadata> {
  const url = normalizeFetchableUrl(rawUrl);
  if (!url) {
    throw new Error("Invalid link URL");
  }

  const fallback: LinkMetadata = {
    url,
    sourceDomain: sourceDomainFromUrl(url),
  };

  try {
    const response = await fetchWithTimeout(url, fetchImpl);
    if (!response.ok) return fallback;

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("html")) return fallback;

    const html = await readLimitedText(response, MAX_HTML_BYTES);
    const parsed = parseLinkMetadataHtml(html, url);
    const [imageUrl, faviconUrl] = await Promise.all([
      fetchImageAsDataUrl(parsed.imageUrl, fetchImpl),
      fetchImageAsDataUrl(parsed.faviconUrl, fetchImpl),
    ]);

    return {
      url,
      title: parsed.title,
      description: parsed.description,
      sourceDomain: parsed.sourceDomain,
      imageUrl,
      faviconUrl,
    };
  } catch {
    return fallback;
  }
}
