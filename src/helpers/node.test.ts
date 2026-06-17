import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  computeHash,
  createDirectoryByDate,
  exists,
  inferItemType,
  sanitizeFileBaseName,
} from "./node";

describe("node filesystem helpers", () => {
  it("checks whether paths exist", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "folio-exists-"));
    const filePath = path.join(tempDir, "source.txt");
    await fs.writeFile(filePath, "present");

    await expect(exists(filePath)).resolves.toBe(true);
    await expect(exists(path.join(tempDir, "missing.txt"))).resolves.toBe(false);
  });

  it("sanitizes imported filenames for archive storage", () => {
    expect(sanitizeFileBaseName("  Gesture Study #1!!.PNG ")).toBe(
      "gesture-study-1png",
    );
    expect(sanitizeFileBaseName("...")).toBe("untitled");
  });

  it("infers Folio item types from file extensions", () => {
    expect(inferItemType(".PNG")).toBe("sketch");
    expect(inferItemType(".mp3")).toBe("music");
    expect(inferItemType(".mov")).toBe("anim");
    expect(inferItemType(".txt")).toBe("text");
    expect(inferItemType(".zip")).toBe("other");
  });

  it("computes a stable truncated hash from file content", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "folio-hash-"));
    const filePath = path.join(tempDir, "source.txt");
    await fs.writeFile(filePath, "same-content");

    expect(await computeHash(filePath)).toMatch(/^[a-f0-9]{8}$/);
    expect(await computeHash(filePath)).toBe(await computeHash(filePath));
  });

  it("creates import folders using the current year and month", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00"));
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "folio-date-"));

    const destDir = await createDirectoryByDate(tempDir);

    expect(destDir).toBe(path.join(tempDir, "items", "2026", "06_june"));
    await expect(fs.stat(destDir)).resolves.toMatchObject({ isDirectory: expect.any(Function) });

    vi.useRealTimers();
  });
});
