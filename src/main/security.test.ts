import {
  buildRendererContentSecurityPolicy,
  installRendererContentSecurityPolicy,
} from "./security";

describe("renderer content security policy", () => {
  it("does not allow eval in development or production", () => {
    expect(buildRendererContentSecurityPolicy()).not.toContain("unsafe-eval");
    expect(
      buildRendererContentSecurityPolicy("http://localhost:5173"),
    ).not.toContain("unsafe-eval");
  });

  it("allows the Vite dev websocket without broad script permissions", () => {
    const policy = buildRendererContentSecurityPolicy("http://localhost:5173");

    expect(policy).toContain("script-src 'self' http://localhost:5173");
    expect(policy).toContain(
      "connect-src 'self' folio: http://localhost:5173 ws://localhost:5173",
    );
    expect(policy).toContain("object-src 'none'");
  });

  it("sets a CSP header without preserving an insecure existing one", () => {
    const onHeadersReceived = vi.fn();
    installRendererContentSecurityPolicy(
      {
        webRequest: {
          onHeadersReceived,
        },
      } as never,
      "http://localhost:5173",
    );

    const listener = onHeadersReceived.mock.calls[0][0] as (
      details: {
        responseHeaders: Record<string, string[]>;
      },
      callback: (result: { responseHeaders?: Record<string, string[] | string> }) => void,
    ) => void;
    const callback = vi.fn();

    listener(
      {
        responseHeaders: {
          "content-security-policy": ["script-src 'self' 'unsafe-eval'"],
        },
      },
      callback,
    );

    expect(callback).toHaveBeenCalledWith({
      responseHeaders: expect.objectContaining({
        "Content-Security-Policy": [
          expect.not.stringContaining("unsafe-eval"),
        ],
      }),
    });
    expect(
      callback.mock.calls[0][0].responseHeaders["content-security-policy"],
    ).toBeUndefined();
  });
});
