import { makeItem } from "../../test/fixtures";
import {
  chooseAndImportItems,
  clipboardImageExtension,
  getImportFailureMessage,
} from "./importing";

describe("folio importing helpers", () => {
  it("uses the direct import bridge when available", async () => {
    const imported = [makeItem("alpha")];
    vi.mocked(window.folio.importToFolio).mockResolvedValue(imported);

    await expect(chooseAndImportItems()).resolves.toEqual(imported);

    expect(window.folio.importToFolio).toHaveBeenCalledTimes(1);
    expect(window.folio.openFileDialog).not.toHaveBeenCalled();
  });

  it("falls back to the legacy file dialog for old preload bridges", async () => {
    const imported = [makeItem("legacy")];
    vi.mocked(window.folio.importToFolio).mockRejectedValue(
      new Error("No handler registered for 'folio:import-to-folio'"),
    );
    vi.mocked(window.folio.openFileDialog).mockResolvedValue([
      "/tmp/a.png",
      "/tmp/a.png",
      "",
      "/tmp/b.png",
    ]);
    vi.mocked(window.folio.copyToFolio).mockResolvedValue(imported);

    await expect(chooseAndImportItems()).resolves.toEqual(imported);

    expect(window.folio.copyToFolio).toHaveBeenCalledWith([
      "/tmp/a.png",
      "/tmp/b.png",
    ]);
  });

  it("rethrows non-legacy import failures", async () => {
    vi.mocked(window.folio.importToFolio).mockRejectedValue(
      new Error("Disk full"),
    );

    await expect(chooseAndImportItems()).rejects.toThrow("Disk full");
  });

  it("formats useful import failure messages", () => {
    expect(getImportFailureMessage(new Error("Denied"), "Import failed")).toBe(
      "Import failed: Denied",
    );
    expect(getImportFailureMessage({}, "Import failed")).toBe("Import failed");
  });
});

describe("clipboardImageExtension", () => {
  it("prefers the extension from the file name", () => {
    const file = { name: "shot.JPEG", type: "image/png" } as File;
    expect(clipboardImageExtension(file)).toBe(".jpeg");
  });

  it("falls back to the MIME type when there is no extension", () => {
    expect(
      clipboardImageExtension({ name: "clip", type: "image/png" } as File),
    ).toBe(".png");
    expect(
      clipboardImageExtension({ name: "clip", type: "image/jpeg" } as File),
    ).toBe(".jpg");
    expect(
      clipboardImageExtension({ name: "clip", type: "image/webp" } as File),
    ).toBe(".webp");
    expect(
      clipboardImageExtension({ name: "clip", type: "image/gif" } as File),
    ).toBe(".gif");
  });

  it("defaults to .png for unknown types", () => {
    expect(
      clipboardImageExtension({ name: "clip", type: "image/bmp" } as File),
    ).toBe(".png");
  });
});
