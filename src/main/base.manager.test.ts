import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { FolioManager } from "./base.manager";
import { computeHash } from "../helpers";
import { SCHEMA_VERSION } from "../constants";
import { makeCanvas, makeData, makeItem, makeProject } from "../test/fixtures";
import type { Canvas, FolioData } from "../types";

type WatchCallback = (filePath: string) => void | Promise<void>;

const electronMocks = vi.hoisted(() => ({
  homePath: "",
  ipcHandle: vi.fn(),
  openPath: vi.fn(),
  protocolHandle: vi.fn(),
  showMessageBox: vi.fn(),
  showOpenDialog: vi.fn(),
  showItemInFolder: vi.fn(),
  trashItem: vi.fn(),
  relaunch: vi.fn(),
  exit: vi.fn(),
}));

const chokidarMocks = vi.hoisted(() => {
  const state = {
    events: {} as Record<string, WatchCallback>,
    watcher: {
      on: vi.fn(),
    },
    watch: vi.fn(),
  };

  state.watcher.on.mockImplementation(
    (eventName: string, callback: WatchCallback) => {
      state.events[eventName] = callback;
      return state.watcher;
    },
  );
  state.watch.mockReturnValue(state.watcher);

  return state;
});

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => electronMocks.homePath),
    getAppPath: vi.fn(() => ""),
    relaunch: electronMocks.relaunch,
    exit: electronMocks.exit,
  },
  BrowserWindow: vi.fn(),
  dialog: {
    showOpenDialog: electronMocks.showOpenDialog,
    showMessageBox: electronMocks.showMessageBox,
  },
  ipcMain: {
    handle: electronMocks.ipcHandle,
  },
  nativeImage: {
    createThumbnailFromPath: vi.fn(),
    createFromPath: vi.fn(() => ({
      getSize: () => ({ width: 0, height: 0 }),
      isEmpty: () => true,
    })),
  },
  protocol: {
    handle: electronMocks.protocolHandle,
  },
  shell: {
    openPath: electronMocks.openPath,
    showItemInFolder: electronMocks.showItemInFolder,
    trashItem: electronMocks.trashItem,
  },
}));

vi.mock("chokidar", () => ({
  watch: chokidarMocks.watch,
}));

async function makeTempFolioHome(prefix = "folio-manager-") {
  const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  electronMocks.homePath = tempHome;
  const folioRoot = path.join(tempHome, "Documents", "Folio");
  const dotFolio = path.join(folioRoot, ".folio");
  await fs.mkdir(dotFolio, { recursive: true });
  return { tempHome, folioRoot, dotFolio };
}

async function writeRawFolioFiles(dotFolio: string, data: FolioData) {
  await fs.writeFile(
    path.join(dotFolio, "folio.json"),
    JSON.stringify({ version: SCHEMA_VERSION, items: data.items }, null, 2),
  );
  await fs.writeFile(
    path.join(dotFolio, "tags.json"),
    JSON.stringify({ version: SCHEMA_VERSION, tags: data.tags }, null, 2),
  );
  await fs.writeFile(
    path.join(dotFolio, "canvases.json"),
    JSON.stringify(
      { version: SCHEMA_VERSION, canvases: data.canvases },
      null,
      2,
    ),
  );
  await fs.writeFile(
    path.join(dotFolio, "projects.json"),
    JSON.stringify(
      { version: SCHEMA_VERSION, projects: data.projects },
      null,
      2,
    ),
  );
}

describe("FolioManager project Works", () => {
  beforeEach(() => {
    chokidarMocks.events = {};
    chokidarMocks.watch.mockClear();
    chokidarMocks.watcher.on.mockClear();
    electronMocks.ipcHandle.mockClear();
    electronMocks.openPath.mockReset();
    electronMocks.protocolHandle.mockClear();
    electronMocks.showMessageBox.mockReset();
    electronMocks.showOpenDialog.mockReset();
    electronMocks.showItemInFolder.mockClear();
    electronMocks.trashItem.mockReset();
  });

  it("stores Works as a project subset and syncs the readable works folder", async () => {
    const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "folio-manager-"));
    electronMocks.homePath = tempHome;

    const folioRoot = path.join(tempHome, "Documents", "Folio");
    const projectFolder = path.join(folioRoot, "projects", "color-study");
    const imagePath = path.join(projectFolder, "images", "alpha.png");
    const dotFolio = path.join(folioRoot, ".folio");
    await fs.mkdir(path.dirname(imagePath), { recursive: true });
    await fs.mkdir(dotFolio, { recursive: true });
    await fs.writeFile(imagePath, "image bytes");

    const manager = new FolioManager();
    await manager.saveFolioData(
      makeData({
        items: [
          makeItem("alpha", {
            title: "Alpha Work",
            path: "projects/color-study/images/alpha.png",
            projectId: "project-1",
          }),
          makeItem("bravo", {
            title: "Bravo",
            path: "projects/color-study/images/bravo.png",
            projectId: "project-1",
          }),
        ],
        canvases: [],
        projects: [
          makeProject("project-1", {
            title: "Color Study",
            folderPath: "projects/color-study",
            imageIds: ["alpha", "bravo"],
            workItemIds: [],
            boardIds: [],
          }),
        ],
      }),
    );

    const promotedData = await manager.setProjectWorkItems("project-1", [
      "alpha",
      "missing",
      "alpha",
    ]);

    expect(promotedData.projects[0].workItemIds).toEqual(["alpha"]);
    expect(promotedData.projects[0].workUpdatedAt).toEqual(expect.any(String));
    expect(
      promotedData.items.find((item) => item.id === "alpha")?.stage,
    ).toBeUndefined();

    const worksDir = path.join(projectFolder, "works");
    await expect(fs.readdir(worksDir)).resolves.toEqual([
      "alpha-work-alpha.png",
    ]);
    await expect(
      fs.readFile(path.join(worksDir, "alpha-work-alpha.png"), "utf-8"),
    ).resolves.toBe("image bytes");

    const persistedProjects = JSON.parse(
      await fs.readFile(path.join(dotFolio, "projects.json"), "utf-8"),
    ) as { projects: Array<{ workItemIds: string[]; workUpdatedAt?: string }> };
    expect(persistedProjects.projects[0].workItemIds).toEqual(["alpha"]);
    expect(persistedProjects.projects[0].workUpdatedAt).toEqual(
      expect.any(String),
    );

    const unmarkedData = await manager.setProjectWorkItems("project-1", []);

    expect(unmarkedData.projects[0].workItemIds).toEqual([]);
    await expect(fs.readdir(worksDir)).resolves.toEqual([]);
  });

  it("migrates legacy item folders into project media folders", async () => {
    const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "folio-manager-"));
    electronMocks.homePath = tempHome;

    const folioRoot = path.join(tempHome, "Documents", "Folio");
    const dotFolio = path.join(folioRoot, ".folio");
    const legacyItemPath = path.join(
      folioRoot,
      "items",
      "2026",
      "06_june",
      "alpha.png",
    );
    await fs.mkdir(path.dirname(legacyItemPath), { recursive: true });
    await fs.mkdir(dotFolio, { recursive: true });
    await fs.writeFile(legacyItemPath, "image bytes");
    const legacyNotePath = path.join(
      folioRoot,
      "items",
      "2026",
      "06_june",
      "field-note.txt",
    );
    await fs.writeFile(legacyNotePath, "note bytes");
    const legacyCanvas = {
      ...makeCanvas("board-1", {
        projectId: "project-1",
        itemIds: ["alpha"],
      }),
      references: [
        {
          id: "legacy-reference",
          filename: "swatch.png",
          path: "projects/color-study/boards/board-1/references/swatch.png",
          x: 0,
          y: 0,
        },
      ],
    } as Canvas & { references: unknown[] };

    const manager = new FolioManager();
    await manager.saveFolioData(
      makeData({
        items: [
          makeItem("alpha", {
            title: "Alpha",
            path: "items/2026/06_june/alpha.png",
            projectId: "project-1",
          }),
          makeItem("note", {
            title: "Field Note",
            path: "items/2026/06_june/field-note.txt",
            type: "text",
            projectId: "project-1",
          }),
        ],
        canvases: [legacyCanvas],
        projects: [
          makeProject("project-1", {
            title: "Color Study",
            folderPath: "projects/color-study",
            imageIds: ["alpha", "note"],
            workItemIds: ["alpha"],
            boardIds: ["board-1"],
          }),
        ],
      }),
    );

    const data = await manager.loadData();

    expect(data.items[0].path).toBe("projects/color-study/images/alpha.png");
    expect(data.items[1].path).toBe(
      "projects/color-study/documents/field-note.txt",
    );
    expect("references" in data.canvases[0]).toBe(false);
    await expect(
      fs.readFile(
        path.join(folioRoot, "projects", "color-study", "images", "alpha.png"),
        "utf-8",
      ),
    ).resolves.toBe("image bytes");
    await expect(
      fs.readFile(
        path.join(
          folioRoot,
          "projects",
          "color-study",
          "documents",
          "field-note.txt",
        ),
        "utf-8",
      ),
    ).resolves.toBe("note bytes");
    await expect(
      fs.readFile(
        path.join(
          folioRoot,
          "projects",
          "color-study",
          "works",
          "alpha-alpha.png",
        ),
        "utf-8",
      ),
    ).resolves.toBe("image bytes");
    await expect(fs.stat(path.join(folioRoot, "items"))).rejects.toThrow();
    await expect(fs.stat(legacyNotePath)).rejects.toThrow();
    await expect(fs.stat(path.join(folioRoot, "images"))).rejects.toThrow();
    await expect(fs.stat(path.join(folioRoot, "works"))).rejects.toThrow();
  });

  it("opens folders directly and reveals files in Finder", async () => {
    const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "folio-manager-"));
    electronMocks.homePath = tempHome;
    electronMocks.openPath.mockResolvedValue("");

    const folioRoot = path.join(tempHome, "Documents", "Folio");
    const folderPath = path.join(folioRoot, "projects", "color-study");
    const filePath = path.join(folderPath, "image.png");
    await fs.mkdir(folderPath, { recursive: true });
    await fs.writeFile(filePath, "image bytes");

    const manager = new FolioManager();

    await manager.openInFinder("projects/color-study");
    await manager.openInFinder("projects/color-study/image.png");

    expect(electronMocks.openPath).toHaveBeenCalledWith(folderPath);
    expect(electronMocks.showItemInFolder).toHaveBeenCalledWith(filePath);
  });

  it("registers IPC handlers and serves safe folio protocol files", async () => {
    const { folioRoot } = await makeTempFolioHome();
    const imagePath = path.join(
      folioRoot,
      "projects",
      "color-study",
      "images",
      "alpha.png",
    );
    const webpPath = path.join(
      folioRoot,
      "projects",
      "color-study",
      "images",
      "alpha.webp",
    );
    const gifPath = path.join(
      folioRoot,
      "projects",
      "color-study",
      "images",
      "alpha.gif",
    );
    const jpgPath = path.join(
      folioRoot,
      "projects",
      "color-study",
      "images",
      "alpha.jpg",
    );
    const txtPath = path.join(
      folioRoot,
      "projects",
      "color-study",
      "images",
      "alpha.txt",
    );
    const thumbPath = path.join(
      folioRoot,
      ".folio",
      "thumbs",
      "alpha-small.svg",
    );
    await fs.mkdir(path.dirname(imagePath), { recursive: true });
    await fs.mkdir(path.dirname(thumbPath), { recursive: true });
    await fs.writeFile(imagePath, "image bytes");
    await fs.writeFile(webpPath, "webp bytes");
    await fs.writeFile(gifPath, "gif bytes");
    await fs.writeFile(jpgPath, "jpg bytes");
    await fs.writeFile(txtPath, "text bytes");
    await fs.writeFile(thumbPath, "<svg />");

    const manager = new FolioManager();
    manager.registerHandlers();
    manager.registerProtocol();

    expect(electronMocks.ipcHandle.mock.calls.map(([name]) => name)).toEqual(
      expect.arrayContaining([
        "folio:get-folio-data",
        "folio:create-project",
        "folio:copy-to-project",
        "folio:import-sources-to-project",
        "folio:open-in-finder",
      ]),
    );
    expect(electronMocks.protocolHandle).toHaveBeenCalledWith(
      "folio",
      expect.any(Function),
    );

    const protocolHandler = electronMocks.protocolHandle.mock.calls.at(
      -1,
    )?.[1] as (request: { url: string }) => Promise<Response>;
    const response = await protocolHandler({
      url: "folio://file/projects%2Fcolor-study%2Fimages%2Falpha.png",
    });
    const unsafeResponse = await protocolHandler({
      url: "folio://file/..%2Fsecret.png",
    });
    const webpResponse = await protocolHandler({
      url: "folio://file/projects%2Fcolor-study%2Fimages%2Falpha.webp",
    });
    const gifResponse = await protocolHandler({
      url: "folio://file/projects%2Fcolor-study%2Fimages%2Falpha.gif",
    });
    const jpgResponse = await protocolHandler({
      url: "folio://file/projects%2Fcolor-study%2Fimages%2Falpha.jpg",
    });
    const txtResponse = await protocolHandler({
      url: "folio://file/projects%2Fcolor-study%2Fimages%2Falpha.txt",
    });
    const thumbResponse = await protocolHandler({
      url: "folio://thumb/alpha-small.svg",
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(await response.text()).toBe("image bytes");
    expect(webpResponse.headers.get("content-type")).toBe("image/webp");
    expect(gifResponse.headers.get("content-type")).toBe("image/gif");
    expect(jpgResponse.headers.get("content-type")).toBe("image/jpeg");
    expect(txtResponse.headers.get("content-type")).toBe(
      "application/octet-stream",
    );
    expect(thumbResponse.headers.get("content-type")).toBe("image/svg+xml");
    expect(unsafeResponse.status).toBe(404);
  });

  it("creates uniquely named project folders and persists project metadata", async () => {
    const { folioRoot, dotFolio } = await makeTempFolioHome();
    await fs.mkdir(path.join(folioRoot, "projects", "color-study"), {
      recursive: true,
    });

    const manager = new FolioManager();
    const data = await manager.createProject({
      title: "Color Study",
      description: "  Soft gradients  ",
      status: "paused",
    });

    expect(data.projects[0]).toMatchObject({
      title: "Color Study",
      description: "Soft gradients",
      status: "paused",
      folderPath: "projects/color-study-2",
      imageIds: [],
      workItemIds: [],
      boardIds: [],
      reviews: [],
    });
    await expect(
      fs.stat(path.join(folioRoot, "projects", "color-study-2", "images")),
    ).resolves.toBeTruthy();
    await expect(
      fs.stat(path.join(folioRoot, "projects", "color-study-2", "documents")),
    ).resolves.toBeTruthy();
    await expect(
      fs.stat(path.join(folioRoot, "projects", "color-study-2", "works")),
    ).resolves.toBeTruthy();

    const persisted = JSON.parse(
      await fs.readFile(path.join(dotFolio, "projects.json"), "utf-8"),
    ) as { projects: Array<{ folderPath: string }> };
    expect(persisted.projects[0].folderPath).toBe("projects/color-study-2");
  });

  it("imports source buffers into project images and writes review markdown files", async () => {
    const { folioRoot } = await makeTempFolioHome();
    const manager = new FolioManager();
    await manager.saveFolioData(
      makeData({
        items: [],
        canvases: [],
        projects: [
          makeProject("project-1", {
            title: "Color Study",
            folderPath: "projects/color-study",
            imageIds: [],
            workItemIds: [],
            boardIds: [],
            reviews: [
              {
                id: "review-1",
                title: "Week 1",
                markdown: "# Week 1\n\nGood start.",
                workItemIds: [],
                createdAt: "2026-06-17T10:00:00.000Z",
                updatedAt: "2026-06-17T10:00:00.000Z",
              },
            ],
          }),
        ],
      }),
    );

    const imported = await manager.importSourcesToProject("project-1", [
      {
        kind: "buffer",
        filename: "Paint Study",
        ext: ".png",
        data: Buffer.from("image bytes"),
      },
      {
        kind: "buffer",
        filename: "Process Note",
        ext: ".md",
        data: Buffer.from("# Process"),
      },
    ]);

    expect(imported).toHaveLength(2);
    expect(imported[0]).toMatchObject({
      title: "Paint Study",
      projectId: "project-1",
      path: "projects/color-study/images/paint-study.png",
    });
    expect(imported[1]).toMatchObject({
      title: "Process Note",
      projectId: "project-1",
      path: "projects/color-study/documents/process-note.md",
    });
    await expect(
      fs.readFile(
        path.join(
          folioRoot,
          "projects",
          "color-study",
          "images",
          "paint-study.png",
        ),
        "utf-8",
      ),
    ).resolves.toBe("image bytes");
    await expect(
      fs.readFile(
        path.join(
          folioRoot,
          "projects",
          "color-study",
          "documents",
          "process-note.md",
        ),
        "utf-8",
      ),
    ).resolves.toBe("# Process");
    await expect(
      fs.readFile(
        path.join(
          folioRoot,
          "projects",
          "color-study",
          "reviews",
          "review-review-1.md",
        ),
        "utf-8",
      ),
    ).resolves.toBe("# Week 1\n\nGood start.");

    const data = await manager.loadData();
    expect(data.projects[0].imageIds).toEqual(imported.map((item) => item.id));
  });

  it("imports selected files into the default project when no project exists", async () => {
    const { folioRoot, dotFolio } = await makeTempFolioHome();
    const sourcePath = path.join(folioRoot, "loose-source.png");
    await fs.writeFile(sourcePath, "image bytes");
    electronMocks.showMessageBox.mockResolvedValue({ response: 0 });
    electronMocks.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: [sourcePath],
    });

    const manager = new FolioManager();
    const imported = await manager.importToFolio();

    expect(imported).toHaveLength(1);
    expect(imported[0]).toMatchObject({
      projectId: "project_default",
      path: "projects/studio-archive/images/loose-source.png",
    });

    const persistedProjects = JSON.parse(
      await fs.readFile(path.join(dotFolio, "projects.json"), "utf-8"),
    ) as { projects: Array<{ id: string; imageIds: string[] }> };
    expect(persistedProjects.projects[0].id).toBe("project_default");
    expect(persistedProjects.projects[0].imageIds).toEqual([imported[0].id]);
  });

  it("returns no imports when the file picker is cancelled", async () => {
    await makeTempFolioHome();
    electronMocks.showMessageBox.mockResolvedValue({ response: 0 });
    electronMocks.showOpenDialog.mockResolvedValue({
      canceled: true,
      filePaths: ["/ignored.png"],
    });

    const manager = new FolioManager();

    await expect(manager.openFileDialog()).resolves.toEqual([]);
    await expect(manager.importToFolio()).resolves.toEqual([]);
  });

  it("deletes items from metadata, canvases, projects, and disk", async () => {
    const { folioRoot } = await makeTempFolioHome();
    const projectFolder = path.join(folioRoot, "projects", "color-study");
    const imagePath = path.join(projectFolder, "images", "alpha.png");
    await fs.mkdir(path.dirname(imagePath), { recursive: true });
    await fs.writeFile(imagePath, "image bytes");
    electronMocks.trashItem.mockResolvedValue(undefined);

    const manager = new FolioManager();
    await manager.saveFolioData(
      makeData({
        items: [
          makeItem("alpha", {
            path: "projects/color-study/images/alpha.png",
            projectId: "project-1",
          }),
          makeItem("bravo", {
            path: "projects/color-study/images/bravo.png",
            projectId: "project-1",
          }),
        ],
        canvases: [
          makeCanvas("board-1", {
            itemIds: ["alpha", "bravo"],
            positions: {
              alpha: { x: 10, y: 20 },
              bravo: { x: 30, y: 40 },
            },
            edges: [
              {
                id: "edge-1",
                fromId: "alpha",
                toId: "bravo",
                relationshipType: "version-of",
                createdAt: "2026-06-17T10:00:00.000Z",
              },
            ],
          }),
        ],
        projects: [
          makeProject("project-1", {
            folderPath: "projects/color-study",
            imageIds: ["alpha", "bravo"],
            workItemIds: ["alpha"],
            boardIds: ["board-1"],
          }),
        ],
      }),
    );

    const data = await manager.deleteItems(["alpha"]);

    expect(electronMocks.trashItem).toHaveBeenCalledWith(imagePath);
    expect(data.items.map((item) => item.id)).toEqual(["bravo"]);
    expect(data.canvases[0].itemIds).toEqual(["bravo"]);
    expect(data.canvases[0].positions).toEqual({ bravo: { x: 30, y: 40 } });
    expect(data.canvases[0].edges).toEqual([]);
    expect(data.projects[0].imageIds).toEqual(["bravo"]);
    expect(data.projects[0].workItemIds).toEqual([]);
  });

  it("reconciles relocated, missing, repaired, and untracked project files on launch", async () => {
    const { folioRoot, dotFolio } = await makeTempFolioHome();
    const imagesDir = path.join(folioRoot, "projects", "color-study", "images");
    await fs.mkdir(imagesDir, { recursive: true });

    const relocatedPath = path.join(imagesDir, "relocated.png");
    const repairedPath = path.join(imagesDir, "repaired.png");
    const untrackedPath = path.join(imagesDir, "untracked.png");
    await fs.writeFile(relocatedPath, "relocated bytes");
    await fs.writeFile(repairedPath, "repaired bytes");
    await fs.writeFile(untrackedPath, "untracked bytes");

    const relocatedHash = await computeHash(relocatedPath);
    const repairedHash = await computeHash(repairedPath);
    await writeRawFolioFiles(
      dotFolio,
      makeData({
        items: [
          makeItem("relocated", {
            path: "projects/color-study/images/original.png",
            hash: relocatedHash,
            projectId: "project-1",
            missing: false,
          }),
          makeItem("missing", {
            path: "projects/color-study/images/missing.png",
            hash: "missing-hash",
            projectId: "project-1",
            missing: false,
          }),
          makeItem("repaired", {
            path: "projects/color-study/images/repaired.png",
            hash: repairedHash,
            projectId: "project-1",
            missing: true,
          }),
        ],
        canvases: [],
        projects: [
          makeProject("project-1", {
            folderPath: "projects/color-study",
            imageIds: ["relocated", "missing", "repaired"],
            workItemIds: ["repaired"],
            boardIds: [],
          }),
        ],
      }),
    );

    const manager = new FolioManager();
    await manager.prepareForLaunch();

    const reconciliation = manager.getReconciliationResult();
    expect(reconciliation.relocatedItems).toEqual([
      expect.objectContaining({
        id: "relocated",
        path: "projects/color-study/images/relocated.png",
        missing: false,
      }),
    ]);
    expect(reconciliation.missingItems).toEqual([
      expect.objectContaining({
        id: "missing",
        missing: true,
      }),
    ]);
    expect(reconciliation.untrackedFiles).toEqual([
      expect.objectContaining({
        path: "projects/color-study/images/untracked.png",
      }),
    ]);

    const persisted = JSON.parse(
      await fs.readFile(path.join(dotFolio, "folio.json"), "utf-8"),
    ) as { items: Array<{ id: string; path: string; missing?: boolean }> };
    expect(persisted.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "relocated",
          path: "projects/color-study/images/relocated.png",
          missing: false,
        }),
        expect.objectContaining({
          id: "missing",
          missing: true,
        }),
        expect.objectContaining({
          id: "repaired",
          missing: false,
        }),
      ]),
    );
  });

  it("registers project media additions and removals from the filesystem watcher", async () => {
    vi.useFakeTimers();
    try {
      const { folioRoot } = await makeTempFolioHome();
      const projectFolder = path.join(folioRoot, "projects", "color-study");
      const imagePath = path.join(projectFolder, "images", "new-file.png");
      const notePath = path.join(projectFolder, "documents", "new-note.md");
      const mainWindow = {
        webContents: {
          send: vi.fn(),
        },
      };
      const manager = new FolioManager();
      await manager.saveFolioData(
        makeData({
          items: [],
          canvases: [],
          projects: [
            makeProject("project-1", {
              folderPath: "projects/color-study",
              imageIds: [],
              workItemIds: [],
              boardIds: [],
            }),
          ],
        }),
      );

      manager.startWatcher(mainWindow as never);
      await fs.writeFile(imagePath, "image bytes");
      await fs.writeFile(notePath, "# note");
      chokidarMocks.events.add(imagePath);
      chokidarMocks.events.add(notePath);
      await (
        manager as unknown as {
          flushWatcherAdds(window: typeof mainWindow): Promise<void>;
        }
      ).flushWatcherAdds(mainWindow);

      expect(chokidarMocks.watch).toHaveBeenCalledWith(
        path.join(folioRoot, "projects"),
        expect.objectContaining({ ignoreInitial: true }),
      );
      expect(mainWindow.webContents.send).toHaveBeenCalledWith(
        "folio:files-added",
        expect.arrayContaining([
          expect.objectContaining({
            path: "projects/color-study/images/new-file.png",
          }),
          expect.objectContaining({
            path: "projects/color-study/documents/new-note.md",
          }),
        ]),
      );

      const addedData = await manager.loadData();
      const addedItem = addedData.items[0];
      expect(addedData.projects[0].imageIds).toHaveLength(2);

      await fs.rm(imagePath);
      await chokidarMocks.events.unlink(imagePath);

      expect(mainWindow.webContents.send).toHaveBeenLastCalledWith(
        "folio:files-added",
        [expect.objectContaining({ id: addedItem.id, missing: true })],
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("persists direct metadata saves and strips legacy canvas references", async () => {
    const { dotFolio } = await makeTempFolioHome();
    const manager = new FolioManager();
    await manager.saveFolioData(
      makeData({ items: [], canvases: [], projects: [] }),
    );

    await manager.saveItems([
      makeItem("alpha", {
        stage: "sketch",
      }),
    ]);
    await manager.saveTags([{ id: "tag-blue", text: "blue" }]);
    await manager.saveCanvases([
      {
        ...makeCanvas("board-1"),
        references: [{ id: "legacy-reference" }],
      } as Canvas & { references: unknown[] },
    ]);

    const folio = JSON.parse(
      await fs.readFile(path.join(dotFolio, "folio.json"), "utf-8"),
    ) as { items: Array<{ id: string }> };
    const tags = JSON.parse(
      await fs.readFile(path.join(dotFolio, "tags.json"), "utf-8"),
    ) as { tags: Array<{ text: string }> };
    const canvases = JSON.parse(
      await fs.readFile(path.join(dotFolio, "canvases.json"), "utf-8"),
    ) as { canvases: Array<Record<string, unknown>> };

    expect(folio.items).toEqual([expect.objectContaining({ id: "alpha" })]);
    expect(tags.tags).toEqual([{ id: "tag-blue", text: "blue" }]);
    expect(canvases.canvases[0].references).toBeUndefined();
  });

  it("imports files into an existing project and handles Photos picker failure", async () => {
    const { folioRoot } = await makeTempFolioHome();
    const sourcePath = path.join(folioRoot, "loose-source.png");
    await fs.writeFile(sourcePath, "image bytes");
    electronMocks.showMessageBox.mockResolvedValueOnce({ response: 0 });
    electronMocks.showOpenDialog.mockResolvedValueOnce({
      canceled: false,
      filePaths: [sourcePath],
    });

    const manager = new FolioManager();
    await manager.saveFolioData(
      makeData({
        items: [],
        canvases: [],
        projects: [
          makeProject("project-1", {
            folderPath: "projects/color-study",
            imageIds: [],
            workItemIds: [],
            boardIds: [],
          }),
        ],
      }),
    );

    const imported = await manager.importToProject("project-1");

    expect(imported).toHaveLength(1);
    expect(imported[0]).toMatchObject({
      projectId: "project-1",
      path: "projects/color-study/images/loose-source.png",
    });

    electronMocks.showMessageBox.mockResolvedValueOnce({ response: 2 });
    await expect(manager.importToProject("project-1")).resolves.toEqual([]);

    const photosManager = manager as unknown as {
      openPhotosImportDialog(): Promise<{ filePaths: string[] }>;
      runPhotosPickerHelper(
        exportDir: string,
      ): Promise<"exported" | "cancelled">;
    };
    photosManager.runPhotosPickerHelper = async () => {
      throw { stderr: "execution error: Access denied (-128)" };
    };

    const photosResult = await photosManager.openPhotosImportDialog();

    expect(photosResult).toEqual({ filePaths: [] });
    expect(electronMocks.showMessageBox).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "error",
        message: "Photos import failed",
        detail: "Access denied",
      }),
    );
  });
});

describe("FolioManager storage location", () => {
  beforeEach(() => {
    electronMocks.relaunch.mockClear();
    electronMocks.exit.mockClear();
    electronMocks.showItemInFolder.mockClear();
  });

  it("reports storage settings for the active Documents location", async () => {
    const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "folio-storage-"));
    electronMocks.homePath = tempHome;
    await fs.mkdir(
      path.join(tempHome, "Library", "Mobile Documents", "com~apple~CloudDocs"),
      { recursive: true },
    );

    const manager = new FolioManager();
    const settings = await manager.getStorageSettings();

    expect(settings.location).toBe("documents");
    expect(settings.iCloudAvailable).toBe(true);
    expect(settings.documentsPath).toBe(
      path.join(tempHome, "Documents", "Folio"),
    );

    await fs.rm(tempHome, { recursive: true, force: true });
  });

  it("targets the opposite location for backups", async () => {
    const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "folio-storage-"));
    electronMocks.homePath = tempHome;

    const manager = new FolioManager();
    const status = await manager.getBackupStatus();

    // A Documents source backs up to iCloud Drive.
    expect(status.target).toBe("icloud");
    expect(status.backupPath).toBe(
      path.join(
        tempHome,
        "Library",
        "Mobile Documents",
        "com~apple~CloudDocs",
        "Folio Backup",
      ),
    );

    await fs.rm(tempHome, { recursive: true, force: true });
  });

  it("does nothing when switching to the current location", async () => {
    const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "folio-storage-"));
    electronMocks.homePath = tempHome;

    const manager = new FolioManager();
    await manager.setStorageLocation("documents");

    expect(electronMocks.relaunch).not.toHaveBeenCalled();
    expect(electronMocks.exit).not.toHaveBeenCalled();

    await fs.rm(tempHome, { recursive: true, force: true });
  });

  it("switches location, reveals the folder, and relaunches", async () => {
    const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "folio-storage-"));
    electronMocks.homePath = tempHome;
    await fs.mkdir(
      path.join(tempHome, "Library", "Mobile Documents", "com~apple~CloudDocs"),
      { recursive: true },
    );
    const folioRoot = path.join(tempHome, "Documents", "Folio");
    await fs.mkdir(path.join(folioRoot, ".folio"), { recursive: true });
    await fs.writeFile(
      path.join(folioRoot, ".folio", "folio.json"),
      JSON.stringify({ version: SCHEMA_VERSION, items: [] }),
    );

    const manager = new FolioManager();
    await manager.setStorageLocation("icloud");

    const iCloudRoot = path.join(
      tempHome,
      "Library",
      "Mobile Documents",
      "com~apple~CloudDocs",
      "Folio",
    );
    expect(
      await fs
        .access(path.join(iCloudRoot, ".folio", "folio.json"))
        .then(() => true)
        .catch(() => false),
    ).toBe(true);
    expect(electronMocks.showItemInFolder).toHaveBeenCalledWith(iCloudRoot);
    expect(electronMocks.relaunch).toHaveBeenCalled();
    expect(electronMocks.exit).toHaveBeenCalledWith(0);

    await fs.rm(tempHome, { recursive: true, force: true });
  });
});
