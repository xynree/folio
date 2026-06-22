import type { Session } from "electron";

type HeaderMap = Record<string, string[] | string | undefined>;

function uniqueSources(sources: string[]) {
  return Array.from(new Set(sources.filter(Boolean)));
}

function devServerSources(devServerUrl?: string) {
  if (!devServerUrl) {
    return {
      connect: [] as string[],
      script: [] as string[],
    };
  }

  try {
    const url = new URL(devServerUrl);
    const websocketProtocol = url.protocol === "https:" ? "wss:" : "ws:";
    return {
      connect: [url.origin, `${websocketProtocol}//${url.host}`],
      // Vite's dev client injects small inline scripts (HMR runtime and error
      // overlay), so inline scripts must be permitted while the dev server is in
      // use. This is dev-only: production builds resolve no dev server URL and
      // keep the strict script-src below.
      script: [url.origin, "'unsafe-inline'"],
    };
  } catch {
    return {
      connect: [] as string[],
      script: [] as string[],
    };
  }
}

export function buildRendererContentSecurityPolicy(devServerUrl?: string) {
  const devSources = devServerSources(devServerUrl);
  const directives: Array<[string, string[]]> = [
    ["default-src", ["'self'"]],
    ["script-src", uniqueSources(["'self'", ...devSources.script])],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", ["'self'", "data:", "folio:"]],
    ["media-src", ["'self'", "data:", "folio:"]],
    ["font-src", ["'self'", "data:"]],
    ["connect-src", uniqueSources(["'self'", "folio:", ...devSources.connect])],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'none'"]],
    ["frame-ancestors", ["'none'"]],
  ];

  return directives
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}

function withHeader(
  headers: HeaderMap | undefined,
  name: string,
  value: string,
) {
  const nextHeaders: HeaderMap = { ...(headers ?? {}) };
  Object.keys(nextHeaders).forEach((key) => {
    if (key.toLowerCase() === name.toLowerCase()) {
      delete nextHeaders[key];
    }
  });
  nextHeaders[name] = [value];
  return nextHeaders;
}

export function installRendererContentSecurityPolicy(
  browserSession: Session,
  devServerUrl?: string,
) {
  const policy = buildRendererContentSecurityPolicy(devServerUrl);

  browserSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: withHeader(
        details.responseHeaders as HeaderMap | undefined,
        "Content-Security-Policy",
        policy,
      ),
    });
  });
}
