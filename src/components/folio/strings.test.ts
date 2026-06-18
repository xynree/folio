import { describe, expect, it } from "vitest";
import type { FolioItem } from "../../types";
import {
  basename,
  fileExtension,
  formatCount,
  itemDisplayTitle,
} from "./strings";

function makeItem(overrides: Partial<FolioItem> = {}): FolioItem {
  return {
    id: "item-1",
    path: "projects/studio/images/sketch.png",
    hash: "item-1",
    type: "sketch",
    date: "2026-06-17T16:05:00.000Z",
    title: "Morning sketch",
    description: "",
    tagIds: [],
    ...overrides,
  };
}

describe("basename", () => {
  it("returns the final segment of a POSIX path", () => {
    expect(basename("a/b/c/file.png")).toBe("file.png");
  });

  it("returns the final segment of a Windows path", () => {
    expect(basename("a\\b\\c\\file.png")).toBe("file.png");
  });

  it("returns the input when there is no separator", () => {
    expect(basename("file.png")).toBe("file.png");
  });

  it("returns the input for an empty string", () => {
    expect(basename("")).toBe("");
  });
});

describe("fileExtension", () => {
  it("returns the uppercased extension", () => {
    expect(fileExtension("a/b/photo.jpeg")).toBe("JPEG");
  });

  it("ignores directory dots and uses the file name", () => {
    expect(fileExtension("my.folder/archive.zip")).toBe("ZIP");
  });

  it("returns 'FILE' when there is no extension", () => {
    expect(fileExtension("a/b/README")).toBe("FILE");
  });

  it("uppercases multi-part extensions' final segment", () => {
    expect(fileExtension("notes/sketch.final.png")).toBe("PNG");
  });
});

describe("itemDisplayTitle", () => {
  it("returns the title when present", () => {
    expect(itemDisplayTitle(makeItem({ title: "Morning sketch" }))).toBe(
      "Morning sketch",
    );
  });

  it("falls back to the file name when the title is empty", () => {
    expect(
      itemDisplayTitle(
        makeItem({ title: "", path: "projects/studio/images/wip.png" }),
      ),
    ).toBe("wip.png");
  });
});

describe("formatCount", () => {
  it("uses the singular label for a count of one", () => {
    expect(formatCount(1, "item")).toBe("1 item");
  });

  it("uses the default plural label for other counts", () => {
    expect(formatCount(0, "item")).toBe("0 items");
    expect(formatCount(3, "item")).toBe("3 items");
  });

  it("uses a custom plural label when provided", () => {
    expect(formatCount(2, "entry", "entries")).toBe("2 entries");
  });
});
