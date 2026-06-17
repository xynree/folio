import type { CanvasLink, CanvasPosition } from "../../types";
import { createId } from "../folio/model";

export function normalizeCanvasLinkUrl(rawUrl: string): string | null {
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

export function sourceDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function createCanvasLinkFromUrl(
  rawUrl: string,
  position: CanvasPosition,
  now = new Date().toISOString(),
): CanvasLink | null {
  const url = normalizeCanvasLinkUrl(rawUrl);
  if (!url) return null;

  const sourceDomain = sourceDomainFromUrl(url);
  return {
    id: createId("link"),
    url,
    title: sourceDomain || url,
    sourceDomain,
    capturedAt: now,
    updatedAt: now,
    x: position.x,
    y: position.y,
  };
}
