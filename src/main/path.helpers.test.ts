import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  extractCommandErrorMessage,
  getMimeType,
  isPathInsideDirectory,
  isPathWithinRoot,
} from "./path.helpers";

describe("isPathInsideDirectory", () => {
  it("accepts nested files", () => {
    expect(
      isPathInsideDirectory(path.join("/root", "a", "file.png"), "/root"),
    ).toBe(true);
  });

  it("rejects the directory itself and escaping paths", () => {
    expect(isPathInsideDirectory("/root", "/root")).toBe(false);
    expect(isPathInsideDirectory("/other/file.png", "/root")).toBe(false);
    expect(isPathInsideDirectory(path.join("/root", "..", "x"), "/root")).toBe(
      false,
    );
  });
});

describe("isPathWithinRoot", () => {
  it("accepts the root and nested paths", () => {
    expect(isPathWithinRoot("/root", "/root")).toBe(true);
    expect(isPathWithinRoot(path.join("/root", "images", "a.png"), "/root")).toBe(
      true,
    );
  });

  it("rejects siblings that share a name prefix", () => {
    expect(isPathWithinRoot("/root-evil/a.png", "/root")).toBe(false);
    expect(isPathWithinRoot("/elsewhere/a.png", "/root")).toBe(false);
  });
});

describe("getMimeType", () => {
  it("maps known image extensions", () => {
    expect(getMimeType("a.PNG")).toBe("image/png");
    expect(getMimeType("a.jpg")).toBe("image/jpeg");
    expect(getMimeType("a.jpeg")).toBe("image/jpeg");
    expect(getMimeType("a.webp")).toBe("image/webp");
    expect(getMimeType("a.gif")).toBe("image/gif");
    expect(getMimeType("a.svg")).toBe("image/svg+xml");
  });

  it("falls back to a binary type for unknown extensions", () => {
    expect(getMimeType("a.heic")).toBe("application/octet-stream");
    expect(getMimeType("noext")).toBe("application/octet-stream");
  });
});

describe("extractCommandErrorMessage", () => {
  it("prefers trimmed stderr when present", () => {
    expect(extractCommandErrorMessage({ stderr: "  boom  " })).toBe("boom");
  });

  it("unwraps AppleScript execution error noise", () => {
    expect(
      extractCommandErrorMessage(
        new Error("execution error: User cancelled. (-128)"),
      ),
    ).toBe("User cancelled.");
  });

  it("falls back to the error message or string form", () => {
    expect(extractCommandErrorMessage(new Error("plain failure"))).toBe(
      "plain failure",
    );
    expect(extractCommandErrorMessage("raw string")).toBe("raw string");
  });
});
