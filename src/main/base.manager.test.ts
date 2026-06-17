import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { FolioManager } from "./base.manager";
import { makeCanvas, makeData, makeItem, makeProject } from "../test/fixtures";

const electronMocks = vi.hoisted(() => ({
  homePath: "",
  openPath: vi.fn(),
  showItemInFolder: vi.fn(),
  trashItem: vi.fn(),
}));

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => electronMocks.homePath),
    getAppPath: vi.fn(() => ""),
  },
  BrowserWindow: vi.fn(),
  dialog: {
    showOpenDialog: vi.fn(),
    showMessageBox: vi.fn(),
  },
  ipcMain: {
    handle: vi.fn(),
  },
  nativeImage: {
    createThumbnailFromPath: vi.fn(),
    createFromPath: vi.fn(() => ({
      getSize: () => ({ width: 0, height: 0 }),
      isEmpty: () => true,
    })),
  },
  protocol: {
    handle: vi.fn(),
  },
  shell: {
    openPath: electronMocks.openPath,
    showItemInFolder: electronMocks.showItemInFolder,
    trashItem: electronMocks.trashItem,
  },
}));

describe("FolioManager project Works", () => {
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
    expect(promotedData.items.find((item) => item.id === "alpha")?.stage)
      .toBeUndefined();

    const worksDir = path.join(projectFolder, "works");
    await expect(fs.readdir(worksDir)).resolves.toEqual(["alpha-work-alpha.png"]);
    await expect(
      fs.readFile(path.join(worksDir, "alpha-work-alpha.png"), "utf-8"),
    ).resolves.toBe("image bytes");

    const persistedProjects = JSON.parse(
      await fs.readFile(path.join(dotFolio, "projects.json"), "utf-8"),
    ) as { projects: Array<{ workItemIds: string[] }> };
    expect(persistedProjects.projects[0].workItemIds).toEqual(["alpha"]);

    const unmarkedData = await manager.setProjectWorkItems("project-1", []);

    expect(unmarkedData.projects[0].workItemIds).toEqual([]);
    await expect(fs.readdir(worksDir)).resolves.toEqual([]);
  });

  it("copies board references under the owning project board folder", async () => {
    const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "folio-manager-"));
    electronMocks.homePath = tempHome;

    const folioRoot = path.join(tempHome, "Documents", "Folio");
    const dotFolio = path.join(folioRoot, ".folio");
    const sourcePath = path.join(tempHome, "Reference.PNG");
    await fs.mkdir(dotFolio, { recursive: true });
    await fs.writeFile(sourcePath, "reference bytes");

    const manager = new FolioManager();
    await manager.saveFolioData(
      makeData({
        items: [],
        canvases: [
          makeCanvas("board-1", {
            projectId: "project-1",
            itemIds: [],
            positions: {},
          }),
        ],
        projects: [
          makeProject("project-1", {
            title: "Color Study",
            folderPath: "projects/color-study",
            imageIds: [],
            workItemIds: [],
            boardIds: ["board-1"],
          }),
        ],
      }),
    );
    await expect(
      fs.stat(
        path.join(
          folioRoot,
          "projects",
          "color-study",
          "boards",
          "board-1",
          "references",
        ),
      ),
    ).resolves.toBeTruthy();

    const references = await manager.copyReference("board-1", [sourcePath]);

    expect(references).toHaveLength(1);
    expect(references[0].path).toMatch(
      /^projects\/color-study\/boards\/board-1\/references\/reference.*\.png$/,
    );
    await expect(
      fs.readFile(path.join(folioRoot, references[0].path), "utf-8"),
    ).resolves.toBe("reference bytes");
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
});
