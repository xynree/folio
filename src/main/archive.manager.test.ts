import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { nativeImage } from "electron";
import { ArchiveManager } from "./archive.manager";
import { FolioDB } from "./database";
import { makeItem } from "../test/fixtures";

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
  beforeEach(() => {
    vi.mocked(nativeImage.createFromPath).mockReturnValue({
      getSize: () => ({ width: 0, height: 0 }),
      isEmpty: () => true,
    } as Electron.NativeImage);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("copies imported files into a project images folder and tags the item with projectId", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "folio-project-"));
    const dotFolio = path.join(tempDir, ".folio");
    await fs.mkdir(dotFolio, { recursive: true });
    const db = new FolioDB(path.join(dotFolio, "folio.db"));
    const sourcePath = path.join(tempDir, "Source Image.PNG");
    await fs.writeFile(sourcePath, "image bytes");

    const manager = new ArchiveManager(tempDir, db);
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

  it("imports buffered project items, resolves name collisions, and generates placeholders", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "folio-project-"));
    const dotFolio = path.join(tempDir, ".folio");
    await fs.mkdir(dotFolio, { recursive: true });
    const db = new FolioDB(path.join(dotFolio, "folio.db"));

    const manager = new ArchiveManager(tempDir, db);
    manager.setItems([]);

    const imported = await manager.importProjectItems(
      "project-1",
      "projects/color-study",
      [
        {
          kind: "buffer",
          filename: "Field Note",
          ext: ".txt",
          data: Buffer.from("first note"),
        },
        {
          kind: "buffer",
          filename: "Field Note",
          ext: ".txt",
          data: Buffer.from("second note"),
        },
      ],
    );

    expect(imported.map((item) => item.path)).toEqual([
      "projects/color-study/documents/field-note.txt",
      "projects/color-study/documents/field-note_2.txt",
    ]);
    expect(imported[0]).toMatchObject({
      projectId: "project-1",
      title: "Field Note",
      type: "text",
      missing: false,
    });

    const thumbnails = await manager.ensureThumbnails([imported[0].id]);
    expect(thumbnails[imported[0].id]).toMatch(/folio:\/\/thumb\/.*-small\.svg/);
    await expect(
      fs.readFile(
        path.join(tempDir, ".folio", "thumbs", `${imported[0].id}-small.svg`),
        "utf-8",
      ),
    ).resolves.toContain("Text");
  });

  it("tracks project files created in place and repairs missing flags", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "folio-project-"));
    const dotFolio = path.join(tempDir, ".folio");
    const imagesDir = path.join(tempDir, "projects", "color-study", "images");
    await fs.mkdir(dotFolio, { recursive: true });
    await fs.mkdir(imagesDir, { recursive: true });
    const db = new FolioDB(path.join(dotFolio, "folio.db"));
    const imagePath = path.join(imagesDir, "tracked.png");
    await fs.writeFile(imagePath, "image bytes");

    const manager = new ArchiveManager(tempDir, db);
    manager.setItems([
      {
        id: "tracked",
        path: "projects/color-study/images/tracked.png",
        hash: "old-hash",
        type: "sketch",
        date: "2026-06-17T10:00:00.000Z",
        title: "Tracked",
        description: "",
        tagIds: [],
        projectId: "project-1",
        missing: true,
      },
    ]);

    const result = await manager.trackExistingFiles(
      [imagePath],
      "project-1",
      "projects/color-study",
    );

    expect(result.changed).toBe(true);
    expect(result.items).toEqual([manager.getItems()[0]]);
    expect(manager.getItems()[0]).toMatchObject({
      id: "tracked",
      missing: false,
      projectId: "project-1",
    });
  });

  it("moves duplicate archive imports into the selected project instead of creating new items", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "folio-project-"));
    const dotFolio = path.join(tempDir, ".folio");
    await fs.mkdir(dotFolio, { recursive: true });
    const db = new FolioDB(path.join(dotFolio, "folio.db"));
    const sourcePath = path.join(tempDir, "Source Image.PNG");
    await fs.writeFile(sourcePath, "image bytes");

    const manager = new ArchiveManager(tempDir, db);
    manager.setItems([]);

    const archiveItems = await manager.copyToFolio([sourcePath]);
    const projectItems = await manager.copyToProject(
      "project-1",
      "projects/color-study",
      [sourcePath],
    );

    expect(archiveItems).toHaveLength(1);
    expect(projectItems).toHaveLength(1);
    expect(projectItems[0].id).toBe(archiveItems[0].id);
    expect(projectItems[0]).toMatchObject({
      projectId: "project-1",
      path: "projects/color-study/images/source-image.png",
    });
    expect(manager.getItems()).toHaveLength(1);
    await expect(
      fs.readFile(path.join(tempDir, projectItems[0].path), "utf-8"),
    ).resolves.toBe("image bytes");
    await expect(
      fs.stat(path.join(tempDir, "projects", "studio-archive", "images", "source-image.png")),
    ).rejects.toThrow();
  });

  it("imports legacy buffered items into the default project documents folder", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "folio-project-"));
    const dotFolio = path.join(tempDir, ".folio");
    await fs.mkdir(dotFolio, { recursive: true });
    const db = new FolioDB(path.join(dotFolio, "folio.db"));

    const manager = new ArchiveManager(tempDir, db);
    manager.setItems([]);

    const imported = await manager.importItems([
      {
        kind: "buffer",
        filename: "Clipboard Note",
        ext: ".md",
        data: Buffer.from("# Clipboard"),
      },
    ]);

    expect(imported).toHaveLength(1);
    expect(imported[0]).toMatchObject({
      title: "Clipboard Note",
      type: "text",
      path: "projects/studio-archive/documents/clipboard-note.md",
      missing: false,
    });
    expect(imported[0].projectId).toBeUndefined();
    await expect(
      fs.readFile(path.join(tempDir, imported[0].path), "utf-8"),
    ).resolves.toBe("# Clipboard");
  });

  it("keeps path helpers rooted in the readable Folio folder", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "folio-project-"));
    const db = new FolioDB(path.join(tempDir, ".folio", "folio.db"));
    const manager = new ArchiveManager(tempDir, db);

    const archivePath = path.join(tempDir, "items", "2026", "alpha.png");
    const projectPath = path.join(tempDir, "projects", "color-study", "images", "alpha.png");
    const outsidePath = path.join(tempDir, "loose.png");

    expect(manager.getAbsolutePath("projects/color-study/images/alpha.png")).toBe(
      projectPath,
    );
    await expect(
      manager.getFileDataUrl("projects/color-study/images/alpha.png"),
    ).resolves.toBe("folio://file/projects%2Fcolor-study%2Fimages%2Falpha.png");
    expect(manager.isInArchiveItems(archivePath)).toBe(true);
    expect(manager.isInArchiveItems(outsidePath)).toBe(false);
    expect(
      manager.isInDirectory(projectPath, path.join(tempDir, "projects", "color-study", "images")),
    ).toBe(true);
    expect(
      manager.isInDirectory(outsidePath, path.join(tempDir, "projects", "color-study", "images")),
    ).toBe(false);
  });

  it("repairs missing flags while creating placeholder thumbnails", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "folio-project-"));
    const dotFolio = path.join(tempDir, ".folio");
    const documentsDir = path.join(tempDir, "projects", "color-study", "documents");
    await fs.mkdir(dotFolio, { recursive: true });
    await fs.mkdir(documentsDir, { recursive: true });
    const db = new FolioDB(path.join(dotFolio, "folio.db"));
    const notePath = path.join(documentsDir, "note.txt");
    await fs.writeFile(notePath, "notes");

    const manager = new ArchiveManager(tempDir, db);
    manager.setItems([
      makeItem("note", {
        path: "projects/color-study/documents/note.txt",
        type: "text",
        title: "Note",
        missing: true,
      }),
    ]);

    const thumbnails = await manager.ensureThumbnails(["missing", "note"]);

    expect(manager.getItems()[0].missing).toBeFalsy();
    expect(thumbnails).toEqual({
      note: "folio://thumb/note-small.svg",
    });
    await expect(
      fs.readFile(path.join(dotFolio, "thumbs", "note-small.svg"), "utf-8"),
    ).resolves.toContain("Text");
    const persistedItems = db.getItems();
    expect(persistedItems[0].missing).toBeFalsy();
  });

  it("repairs missing media dimensions when Electron can read image size", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "folio-project-"));
    const imagesDir = path.join(tempDir, "projects", "color-study", "images");
    await fs.mkdir(imagesDir, { recursive: true });
    const db = new FolioDB(path.join(tempDir, ".folio", "folio.db"));
    const imagePath = path.join(imagesDir, "alpha.png");
    await fs.writeFile(imagePath, "image bytes");
    vi.mocked(nativeImage.createFromPath).mockReturnValue({
      getSize: () => ({ width: 640.4, height: 480.2 }),
      isEmpty: () => false,
    } as Electron.NativeImage);

    const manager = new ArchiveManager(tempDir, db);
    manager.setItems([
      makeItem("alpha", {
        path: "projects/color-study/images/alpha.png",
        mediaWidth: undefined,
        mediaHeight: undefined,
      }),
      makeItem("bravo", {
        path: "projects/color-study/images/missing.png",
        mediaWidth: undefined,
        mediaHeight: undefined,
      }),
    ]);

    await expect(manager.repairMissingMediaDimensions()).resolves.toBe(true);

    expect(manager.getItems()[0]).toMatchObject({
      mediaWidth: 640,
      mediaHeight: 480,
    });
    expect(manager.getItems()[1].mediaWidth).toBeUndefined();
  });

  it("migrates legacy item paths into project media folders by item type", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "folio-project-"));
    const legacyPath = path.join(tempDir, "items", "2026", "06_june", "alpha.PNG");
    await fs.mkdir(path.dirname(legacyPath), { recursive: true });
    await fs.writeFile(legacyPath, "image bytes");
    const legacyNotePath = path.join(tempDir, "items", "2026", "06_june", "note.txt");
    await fs.writeFile(legacyNotePath, "note bytes");
    const db = new FolioDB(path.join(tempDir, ".folio", "folio.db"));

    const manager = new ArchiveManager(tempDir, db);
    manager.setItems([
      makeItem("alpha", {
        path: "items/2026/06_june/alpha.PNG",
        title: "Alpha Study",
        projectId: "project-1",
      }),
      makeItem("bravo", {
        path: "items/2026/06_june/bravo.PNG",
        title: "Bravo Study",
      }),
      makeItem("note", {
        path: "items/2026/06_june/note.txt",
        title: "Field Note",
        type: "text",
        projectId: "project-1",
      }),
    ]);

    const changed = await manager.migrateItemsToProjectMedia(
      new Map([["project-1", "projects/color-study"]]),
    );

    expect(changed).toBe(true);
    expect(manager.getItems()[0].path).toBe(
      "projects/color-study/images/alpha-study.png",
    );
    expect(manager.getItems()[1].path).toBe("items/2026/06_june/bravo.PNG");
    expect(manager.getItems()[2].path).toBe(
      "projects/color-study/documents/field-note.txt",
    );
    await expect(
      fs.readFile(path.join(tempDir, manager.getItems()[0].path), "utf-8"),
    ).resolves.toBe("image bytes");
    await expect(
      fs.readFile(path.join(tempDir, manager.getItems()[2].path), "utf-8"),
    ).resolves.toBe("note bytes");
    await expect(fs.stat(legacyPath)).rejects.toThrow();
    await expect(fs.stat(legacyNotePath)).rejects.toThrow();
  });
});
