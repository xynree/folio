import {
  normalizeArchiveItemType,
  resolveImportSourceMeta,
} from "./archive.helpers";

describe("archive manager helpers", () => {
  it("normalizes legacy and unknown archive item types", () => {
    expect(normalizeArchiveItemType("image")).toBe("sketch");
    expect(normalizeArchiveItemType("audio")).toBe("music");
    expect(normalizeArchiveItemType("video")).toBe("anim");
    expect(normalizeArchiveItemType("ref")).toBe("sketch");
    expect(normalizeArchiveItemType("unknown")).toBe("other");
  });

  it("resolves source metadata while preserving uppercase extension basenames", () => {
    expect(
      resolveImportSourceMeta({
        kind: "path",
        filePath: "/tmp/Reference.PNG",
      }),
    ).toEqual({ filename: "Reference", ext: ".png" });
    expect(
      resolveImportSourceMeta({
        kind: "buffer",
        data: Buffer.from("image"),
        ext: ".JPG",
      }),
    ).toEqual({ filename: "pasted-image", ext: ".jpg" });
    expect(
      resolveImportSourceMeta({
        kind: "buffer",
        data: Buffer.from("image"),
        filename: "Clipboard",
        ext: ".WEBP",
      }),
    ).toEqual({ filename: "Clipboard", ext: ".webp" });
  });
});
