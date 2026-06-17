import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ArchiveManager } from "./archive.manager";

vi.mock("electron", () => ({
  nativeImage: {
    createThumbnailFromPath: vi.fn(),
    createFromPath: vi.fn(() => ({
      getSize: () => ({ width: 0, height: 0 }),
      isEmpty: () => true,
    })),
  },
}));

describe("ArchiveManager project imports", () => {
  it("copies imported files into a project images folder and tags the item with projectId", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "folio-project-"));
    const dotFolio = path.join(tempDir, ".folio");
    await fs.mkdir(dotFolio, { recursive: true });
    const dbPath = path.join(dotFolio, "folio.json");
    const sourcePath = path.join(tempDir, "Source Image.PNG");
    await fs.writeFile(sourcePath, "image bytes");

    const manager = new ArchiveManager(tempDir, dbPath);
    manager.setItems([]);

    const imported = await manager.copyToProject(
      "project-1",
      "projects/color-study",
      [sourcePath],
    );

    expect(imported).toHaveLength(1);
    expect(imported[0]).toMatchObject({
      projectId: "project-1",
      path: "projects/color-study/images/source-image.png",
      title: "Source Image",
      type: "sketch",
      missing: false,
    });
    await expect(
      fs.readFile(path.join(tempDir, imported[0].path), "utf-8"),
    ).resolves.toBe("image bytes");
  });
});
