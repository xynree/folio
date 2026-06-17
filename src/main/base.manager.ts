import { app, BrowserWindow, dialog, ipcMain, protocol, shell } from "electron";
import { watch } from "chokidar";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { nanoid } from "nanoid";
import { computeHash, sanitizeFileBaseName } from "../helpers";
import { SCHEMA_VERSION } from "../constants";
import {
  Canvas,
  CanvasReference,
  FolioData,
  FolioItem,
  ImportSource,
  Project,
  ProjectStatus,
  ReconciliationFile,
  ReconciliationResult,
  Tag,
  ThumbnailUrls,
} from "../types";
import { ArchiveManager } from "./archive.manager";
import { readImageDimensionsForFile } from "./media.helpers";
import { FolioStorage } from "./storage.manager";

const execFileAsync = promisify(execFile);
const PHOTOS_PICKER_CANCELLED = "__FOLIO_PHOTOS_PICKER_CANCELLED__";
const PHOTOS_PICKER_HELPER_NAME = "FolioPhotosPicker";
const IMAGES_DIR_NAME = "images";
const WORKS_DIR_NAME = "works";
const REFERENCES_DIR_NAME = "references";

interface ImportFileSelection {
  filePaths: string[];
  cleanupDir?: string;
}

interface CreateProjectInput {
  title: string;
  description?: string;
  status?: ProjectStatus;
}

/**
 * The core engine of the main process.
 * Manages in-memory data, file operations, reconciliation, watcher events, and IPC.
 */
export interface FolioManagerInterface {
  registerHandlers(): void;
  registerProtocol(): void;
  prepareForLaunch(): Promise<void>;
  loadData(): Promise<FolioData>;
  saveFolioData(data: FolioData): Promise<void>;
  createProject(input: CreateProjectInput): Promise<FolioData>;
  copyToFolio(filePaths: string[]): Promise<FolioItem[]>;
  copyToProject(projectId: string, filePaths: string[]): Promise<FolioItem[]>;
  importToFolio(): Promise<FolioItem[]>;
  importToProject(projectId: string): Promise<FolioItem[]>;
  setProjectWorkItems(projectId: string, workItemIds: string[]): Promise<FolioData>;
  copyReference(
    canvasId: string,
    filePaths: string[],
  ): Promise<CanvasReference[]>;
  deleteItems(itemIds: string[]): Promise<FolioData>;
  ensureReferenceThumbnail(referenceId: string, filePath: string): Promise<string>;
  startWatcher(mainWindow: BrowserWindow): void;
}

const emptyReconciliationResult = (): ReconciliationResult => ({
  scannedAt: new Date().toISOString(),
  untrackedFiles: [],
  missingItems: [],
  relocatedItems: [],
});

export class FolioManager implements FolioManagerInterface {
  private canvases: Canvas[] = [];
  private tags: Tag[] = [];
  private projects: Project[] = [];
  private version: number = SCHEMA_VERSION;
  private reconciliationResult: ReconciliationResult = emptyReconciliationResult();
  private pendingWatcherAdds = new Set<string>();
  private watcherFlushTimer?: ReturnType<typeof setTimeout>;

  private readonly folioRoot: string;
  private readonly dotFolio: string;
  private readonly dbPath: string;
  private readonly tagsPath: string;
  private readonly canvasesPath: string;
  private readonly projectsPath: string;

  private archiveManager: ArchiveManager;
  private storageManager = FolioStorage.getInstance();

  constructor() {
    this.folioRoot = path.join(app.getPath("home"), "Documents", "Folio");
    this.dotFolio = path.join(this.folioRoot, ".folio");
    this.dbPath = path.join(this.dotFolio, "folio.json");
    this.tagsPath = path.join(this.dotFolio, "tags.json");
    this.canvasesPath = path.join(this.dotFolio, "canvases.json");
    this.projectsPath = path.join(this.dotFolio, "projects.json");

    this.archiveManager = new ArchiveManager(this.folioRoot, this.dbPath);
  }

  registerHandlers() {
    ipcMain.handle("folio:get-folio-data", () => this.loadData());
    ipcMain.handle("folio:save-folio-data", (_: unknown, data: FolioData) =>
      this.saveFolioData(data),
    );
    ipcMain.handle("folio:create-project", (_: unknown, input: CreateProjectInput) =>
      this.createProject(input),
    );
    ipcMain.handle("folio:copy-to-folio", (_: unknown, filePaths: string[]) =>
      this.copyToFolio(filePaths),
    );
    ipcMain.handle("folio:import-to-folio", () => this.importToFolio());
    ipcMain.handle(
      "folio:copy-to-project",
      (_: unknown, projectId: string, filePaths: string[]) =>
        this.copyToProject(projectId, filePaths),
    );
    ipcMain.handle("folio:import-to-project", (_: unknown, projectId: string) =>
      this.importToProject(projectId),
    );
    ipcMain.handle(
      "folio:set-project-work-items",
      (_: unknown, projectId: string, workItemIds: string[]) =>
        this.setProjectWorkItems(projectId, workItemIds),
    );
    ipcMain.handle(
      "folio:import-sources-to-project",
      (_: unknown, projectId: string, sources: ImportSource[]) =>
        this.importSourcesToProject(projectId, sources),
    );
    ipcMain.handle(
      "folio:copy-reference",
      (_: unknown, canvasId: string, filePaths: string[]) =>
        this.copyReference(canvasId, filePaths),
    );
    ipcMain.handle("folio:delete-items", (_: unknown, itemIds: string[]) =>
      this.deleteItems(itemIds),
    );
    ipcMain.handle("folio:open-file-dialog", () => this.openFileDialog());
    ipcMain.handle("folio:ensure-thumbnails", (_: unknown, itemIds: string[]) =>
      this.ensureThumbnails(itemIds),
    );
    ipcMain.handle(
      "folio:ensure-reference-thumbnail",
      (_: unknown, referenceId: string, filePath: string) =>
        this.ensureReferenceThumbnail(referenceId, filePath),
    );
    ipcMain.handle("folio:get-file-data-url", (_: unknown, filePath: string) =>
      this.archiveManager.getFileDataUrl(filePath),
    );
    ipcMain.handle("folio:get-reconciliation-result", () =>
      this.getReconciliationResult(),
    );
    ipcMain.handle("folio:open-in-finder", (_: unknown, filePath: string) =>
      this.openInFinder(filePath),
    );

    // Compatibility with the earlier prototype bridge.
    ipcMain.handle("folio:get-data", () => this.loadData());
    ipcMain.handle("folio:save-items", (_: unknown, items: FolioItem[]) =>
      this.saveItems(items),
    );
    ipcMain.handle("folio:save-canvases", (_: unknown, canvases: Canvas[]) =>
      this.saveCanvases(canvases),
    );
    ipcMain.handle("folio:save-tags", (_: unknown, tags: Tag[]) =>
      this.saveTags(tags),
    );
    ipcMain.handle(
      "folio:import-items",
      async (_: unknown, sources: ImportSource[]) => {
        const project = await this.ensureDefaultProject();
        const items = await this.archiveManager.importProjectItems(
          project.id,
          project.folderPath,
          sources,
        );
        await this.appendItemsToProject(project.id, items);
        return items;
      },
    );
  }

  registerProtocol() {
    protocol.handle("folio", async (request) => {
      try {
        const url = new URL(request.url);
        let absolutePath: string | null = null;

        if (url.hostname === "thumb") {
          const filename = path.basename(decodeURIComponent(url.pathname.slice(1)));
          absolutePath = path.join(this.dotFolio, "thumbs", filename);
        }

        if (url.hostname === "file") {
          const relativePath = decodeURIComponent(url.pathname.slice(1));
          absolutePath = path.resolve(this.folioRoot, relativePath);
        }

        if (!absolutePath || !this.isSafeFolioPath(absolutePath)) {
          return new Response("Not found", { status: 404 });
        }

        const data = await fs.readFile(absolutePath);
        return new Response(new Uint8Array(data), {
          headers: {
            "content-type": this.getMimeType(absolutePath),
            "cache-control": "no-store",
          },
        });
      } catch (error) {
        console.error("Folio protocol failed", error);
        return new Response("Not found", { status: 404 });
      }
    });
  }

  async prepareForLaunch(): Promise<void> {
    await this.loadData();
    this.reconciliationResult = await this.reconcileArchive();
  }

  public startWatcher(mainWindow: BrowserWindow) {
    const projectsRoot = path.join(this.folioRoot, "projects");
    const watcher = watch(projectsRoot, {
      ignored: (filePath) => {
        const relative = path.relative(this.folioRoot, filePath);
        return (
          relative.startsWith(".folio") ||
          path.basename(filePath).startsWith(".")
        );
      },
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100,
      },
    });

    watcher.on("add", (filePath) => {
      if (!this.getProjectForImageFilePath(filePath)) return;
      if (this.archiveManager.isRecentlyCopied(filePath)) return;
      this.pendingWatcherAdds.add(filePath);
      this.scheduleWatcherFlush(mainWindow);
    });

    watcher.on("unlink", async (filePath) => {
      if (!this.getProjectForImageFilePath(filePath)) return;
      const item = this.archiveManager
        .getItems()
        .find(
          (candidate) =>
            path.resolve(this.folioRoot, candidate.path) === path.resolve(filePath),
        );

      if (!item || item.missing) return;
      item.missing = true;
      await this.archiveManager.save(this.version);
      mainWindow.webContents.send("folio:files-added", [item]);
    });
  }

  async loadData(): Promise<FolioData> {
    const [rawFolio, rawTags, rawCanvases, rawProjects] = await Promise.all([
      fs.readFile(this.dbPath, "utf-8"),
      fs.readFile(this.tagsPath, "utf-8"),
      fs.readFile(this.canvasesPath, "utf-8"),
      fs.readFile(this.projectsPath, "utf-8"),
    ]);

    const folioBase = JSON.parse(rawFolio);
    const tagsBase = JSON.parse(rawTags);
    const canvasesBase = JSON.parse(rawCanvases);
    const projectsBase = JSON.parse(rawProjects);

    this.validateSchema("folio.json", folioBase, "items");
    this.validateSchema("tags.json", tagsBase, "tags");
    this.validateSchema("canvases.json", canvasesBase, "canvases");
    this.validateSchema("projects.json", projectsBase, "projects");

    this.version = SCHEMA_VERSION;
    this.archiveManager.setItems(folioBase.items);
    this.tags = tagsBase.tags;
    this.canvases = canvasesBase.canvases;
    this.projects = projectsBase.projects;

    await this.ensureMediaDirectories();
    const repairedLegacyOutputStages = this.repairLegacyOutputStages();
    const migratedProjects = await this.migrateProjectData();
    const migratedMediaFiles = await this.migrateMediaFilesToFlatFolders();
    const repairedMissingFlags = await this.repairMissingFlagsForExistingFiles();
    const repairedMediaDimensions =
      await this.archiveManager.repairMissingMediaDimensions();
    const repairedReferenceMediaDimensions =
      this.repairReferenceMediaDimensions();

    if (
      repairedLegacyOutputStages ||
      migratedProjects ||
      migratedMediaFiles.itemsChanged ||
      repairedMissingFlags ||
      repairedMediaDimensions
    ) {
      await this.archiveManager.save(this.version);
    }

    if (
      migratedProjects ||
      migratedMediaFiles.referencesChanged ||
      repairedReferenceMediaDimensions
    ) {
      await Promise.all([
        this.storageManager.saveCanvases(
          this.canvasesPath,
          this.canvases,
          this.version,
        ),
        this.storageManager.saveProjects(
          this.projectsPath,
          this.projects,
          this.version,
        ),
      ]);
    }

    return {
      version: SCHEMA_VERSION,
      items: this.archiveManager.getItems(),
      tags: this.tags,
      canvases: this.canvases,
      projects: this.projects,
    };
  }

  private repairReferenceMediaDimensions(): boolean {
    let changed = false;

    this.canvases = this.canvases.map((canvas) => {
      let canvasChanged = false;
      const references = (canvas.references ?? []).map((reference) => {
        if (reference.mediaWidth && reference.mediaHeight) return reference;

        const dimensions = readImageDimensionsForFile(
          path.join(this.folioRoot, reference.path),
        );
        if (!dimensions) return reference;

        canvasChanged = true;
        return { ...reference, ...dimensions };
      });

      if (!canvasChanged) return canvas;
      changed = true;
      return { ...canvas, references };
    });

    return changed;
  }

  async saveFolioData(data: FolioData): Promise<void> {
    this.version = SCHEMA_VERSION;
    this.archiveManager.setItems(
      data.items.map((item) =>
        (item.stage as string | undefined) === "output"
          ? { ...item, stage: "final" }
          : item,
      ),
    );
    this.tags = data.tags;
    this.canvases = data.canvases;
    this.projects = data.projects.map((project) => ({
      ...project,
      reviews: project.reviews ?? [],
    }));

    await this.ensureMediaDirectories();
    await Promise.all(this.projects.map((project) => this.ensureProjectDirectories(project)));
    await Promise.all(this.projects.map((project) => this.syncProjectReviewFiles(project)));
    await Promise.all(
      this.projects.map((project) => this.syncProjectWorksFolder(project)),
    );

    await Promise.all([
      this.archiveManager.save(this.version),
      this.storageManager.saveTags(this.tagsPath, this.tags, this.version),
      this.storageManager.saveCanvases(
        this.canvasesPath,
        this.canvases,
        this.version,
      ),
      this.storageManager.saveProjects(
        this.projectsPath,
        this.projects,
        this.version,
      ),
    ]);
  }

  async createProject(input: CreateProjectInput): Promise<FolioData> {
    const now = new Date().toISOString();
    const projectId = nanoid();
    const title = input.title.trim() || "Untitled Project";
    const project: Project = {
      id: projectId,
      title,
      description: input.description?.trim() ?? "",
      status: input.status ?? "active",
      createdAt: now,
      updatedAt: now,
      folderPath: await this.createProjectFolderPath(title, projectId),
      imageIds: [],
      workItemIds: [],
      boardIds: [],
      reviews: [],
    };

    await this.ensureMediaDirectories();
    await this.ensureProjectDirectories(project);
    this.projects = [project, ...this.projects];
    await this.storageManager.saveProjects(
      this.projectsPath,
      this.projects,
      this.version,
    );

    return this.currentData();
  }

  private async appendItemsToProject(
    projectId: string,
    items: FolioItem[],
  ): Promise<void> {
    if (!items.length) return;

    const itemIds = items.map((item) => item.id);
    const savedAt = new Date().toISOString();
    this.projects = this.projects.map((project) =>
      project.id === projectId
        ? {
            ...project,
            imageIds: Array.from(new Set([...project.imageIds, ...itemIds])),
            updatedAt: savedAt,
          }
        : project,
    );

    await Promise.all([
      this.archiveManager.save(this.version),
      this.storageManager.saveProjects(
        this.projectsPath,
        this.projects,
        this.version,
      ),
    ]);
  }

  private getProjectOrThrow(projectId: string): Project {
    const project = this.projects.find((candidate) => candidate.id === projectId);
    if (!project) {
      throw new Error(`Project ${projectId} was not found.`);
    }
    return project;
  }

  private getProjectForCanvas(canvasId: string): Project | undefined {
    const canvas = this.canvases.find((candidate) => candidate.id === canvasId);
    if (canvas?.projectId) {
      const project = this.projects.find(
        (candidate) => candidate.id === canvas.projectId,
      );
      if (project) return project;
    }

    return this.projects.find((project) => project.boardIds.includes(canvasId));
  }

  private getProjectForCanvasOrThrow(canvasId: string): Project {
    const project = this.getProjectForCanvas(canvasId);
    if (!project) {
      throw new Error(`Project for board ${canvasId} was not found.`);
    }
    return project;
  }

  private getProjectForImageFilePath(filePath: string): Project | undefined {
    const absolutePath = path.resolve(filePath);
    return this.projects.find((project) =>
      this.isPathInsideDirectory(
        absolutePath,
        path.join(this.folioRoot, project.folderPath, IMAGES_DIR_NAME),
      ),
    );
  }

  async saveItems(items: FolioItem[]): Promise<void> {
    this.archiveManager.setItems(items);
    await this.archiveManager.save(this.version);
  }

  async saveCanvases(canvases: Canvas[]): Promise<void> {
    this.canvases = canvases;
    await this.storageManager.saveCanvases(
      this.canvasesPath,
      this.canvases,
      this.version,
    );
  }

  async saveTags(tags: Tag[]): Promise<void> {
    this.tags = tags;
    await this.storageManager.saveTags(this.tagsPath, this.tags, this.version);
  }

  async copyToFolio(filePaths: string[]): Promise<FolioItem[]> {
    const project = await this.ensureDefaultProject();
    return this.copyToProject(project.id, filePaths);
  }

  async copyToProject(projectId: string, filePaths: string[]): Promise<FolioItem[]> {
    const project = this.getProjectOrThrow(projectId);
    const items = await this.archiveManager.copyToProject(
      project.id,
      project.folderPath,
      filePaths,
    );
    await this.appendItemsToProject(project.id, items);

    void this.archiveManager
      .ensureThumbnails(items.map((item) => item.id))
      .catch((error) => console.error("Thumbnail generation failed", error));

    return items;
  }

  async importToFolio(): Promise<FolioItem[]> {
    const selection = await this.chooseImportFilePaths();
    if (!selection.filePaths.length) return [];

    try {
      return await this.copyToFolio(selection.filePaths);
    } finally {
      if (selection.cleanupDir) {
        await this.removeTemporaryDirectory(selection.cleanupDir);
      }
    }
  }

  async importToProject(projectId: string): Promise<FolioItem[]> {
    const selection = await this.chooseImportFilePaths();
    if (!selection.filePaths.length) return [];

    try {
      return await this.copyToProject(projectId, selection.filePaths);
    } finally {
      if (selection.cleanupDir) {
        await this.removeTemporaryDirectory(selection.cleanupDir);
      }
    }
  }

  async importSourcesToProject(
    projectId: string,
    sources: ImportSource[],
  ): Promise<FolioItem[]> {
    const project = this.getProjectOrThrow(projectId);
    const items = await this.archiveManager.importProjectItems(
      project.id,
      project.folderPath,
      sources,
    );
    await this.appendItemsToProject(project.id, items);

    void this.archiveManager
      .ensureThumbnails(items.map((item) => item.id))
      .catch((error) => console.error("Thumbnail generation failed", error));

    return items;
  }

  async setProjectWorkItems(
    projectId: string,
    workItemIds: string[],
  ): Promise<FolioData> {
    const project = this.getProjectOrThrow(projectId);
    const projectImageIds = new Set(project.imageIds);
    const nextWorkItemIds = Array.from(new Set(workItemIds)).filter((itemId) =>
      projectImageIds.has(itemId),
    );
    const savedAt = new Date().toISOString();

    this.projects = this.projects.map((candidate) =>
      candidate.id === projectId
        ? {
            ...candidate,
            workItemIds: nextWorkItemIds,
            updatedAt: savedAt,
          }
        : candidate,
    );

    const updatedProject = this.getProjectOrThrow(projectId);
    await this.syncProjectWorksFolder(updatedProject);
    await this.storageManager.saveProjects(
      this.projectsPath,
      this.projects,
      this.version,
    );

    return this.currentData();
  }

  async copyReference(
    canvasId: string,
    filePaths: string[],
  ): Promise<CanvasReference[]> {
    const project = this.getProjectForCanvasOrThrow(canvasId);
    return this.archiveManager.copyReferences(project.folderPath, filePaths);
  }

  async deleteItems(itemIds: string[]): Promise<FolioData> {
    const ids = new Set(itemIds);
    const itemsToDelete = this.archiveManager
      .getItems()
      .filter((item) => ids.has(item.id));

    for (const item of itemsToDelete) {
      const absolutePath = this.archiveManager.getAbsolutePath(item.path);
      try {
        await fs.access(absolutePath);
        await shell.trashItem(absolutePath);
      } catch {
        // Missing files can still be removed from Folio metadata.
      }
    }

    const remainingItems = this.archiveManager
      .getItems()
      .filter((item) => !ids.has(item.id));

    const savedAt = new Date().toISOString();
    const updatedCanvases = this.canvases.map((canvas) => {
      const positions = { ...canvas.positions };
      ids.forEach((id) => delete positions[id]);
      const itemIds = canvas.itemIds.filter((id) => !ids.has(id));
      const edges = canvas.edges.filter(
        (edge) => !ids.has(edge.fromId) && !ids.has(edge.toId),
      );
      const changed =
        itemIds.length !== canvas.itemIds.length
        || edges.length !== canvas.edges.length
        || Object.keys(positions).length !== Object.keys(canvas.positions).length;

      const nextCanvas = {
        ...canvas,
        itemIds,
        positions,
      };

      return changed
        ? {
            ...nextCanvas,
            createdAt: canvas.createdAt ?? canvas.updatedAt ?? savedAt,
            updatedAt: savedAt,
          }
        : nextCanvas;
    });

    const nextData = {
      version: SCHEMA_VERSION,
      items: remainingItems,
      tags: this.tags,
      canvases: updatedCanvases,
      projects: this.projects.map((project) => ({
        ...project,
        imageIds: project.imageIds.filter((id) => !ids.has(id)),
        workItemIds: project.workItemIds.filter((id) => !ids.has(id)),
      })),
    };

    await this.saveFolioData(nextData);
    return nextData;
  }

  async openFileDialog(): Promise<string[]> {
    const result = await dialog.showOpenDialog({
      properties: ["openFile", "multiSelections"],
      filters: [
        {
          name: "Studio files",
          extensions: [
            "jpg",
            "jpeg",
            "png",
            "webp",
            "heic",
            "gif",
            "mp3",
            "wav",
            "aiff",
            "m4a",
            "mp4",
            "mov",
            "txt",
            "md",
            "rtf",
            "docx",
          ],
        },
        { name: "All files", extensions: ["*"] },
      ],
    });

    return result.canceled ? [] : result.filePaths;
  }

  private async chooseImportFilePaths(): Promise<ImportFileSelection> {
    if (process.platform !== "darwin") {
      return { filePaths: await this.openFileDialog() };
    }

    const result = await dialog.showMessageBox({
      type: "question",
      buttons: ["Choose files", "Photos", "Cancel"],
      defaultId: 0,
      cancelId: 2,
      title: "Import",
      message: "Import from where?",
      detail:
        "Choose files from your drive, or select photos and videos from the macOS Photos app.",
    });

    if (result.response === 0) {
      return { filePaths: await this.openFileDialog() };
    }

    if (result.response === 1) {
      return this.openPhotosImportDialog();
    }

    return { filePaths: [] };
  }

  private async openPhotosImportDialog(): Promise<ImportFileSelection> {
    const exportDir = await fs.mkdtemp(path.join(os.tmpdir(), "folio-photos-"));

    try {
      const result = await this.runPhotosPickerHelper(exportDir);
      if (result === "cancelled") {
        await this.removeTemporaryDirectory(exportDir);
        return { filePaths: [] };
      }

      const filePaths = await this.listFilesRecursive(exportDir);

      if (!filePaths.length) {
        await this.removeTemporaryDirectory(exportDir);
        await dialog.showMessageBox({
          type: "warning",
          message: "No Photos items were exported",
          detail: "Select one or more items in the Photos picker and try again.",
        });
        return { filePaths: [] };
      }

      return { filePaths, cleanupDir: exportDir };
    } catch (error) {
      await this.removeTemporaryDirectory(exportDir);
      await dialog.showMessageBox({
        type: "error",
        message: "Photos import failed",
        detail: this.errorMessage(error),
      });
      return { filePaths: [] };
    }
  }

  async ensureThumbnails(itemIds: string[]): Promise<ThumbnailUrls> {
    return this.archiveManager.ensureThumbnails(itemIds);
  }

  async ensureReferenceThumbnail(
    referenceId: string,
    filePath: string,
  ): Promise<string> {
    return this.archiveManager.ensureReferenceThumbnail(referenceId, filePath);
  }

  getReconciliationResult(): ReconciliationResult {
    return this.reconciliationResult;
  }

  async openInFinder(filePath: string): Promise<void> {
    const absolutePath = this.archiveManager.getAbsolutePath(filePath);
    try {
      const stats = await fs.stat(absolutePath);
      if (stats.isDirectory()) {
        const error = await shell.openPath(absolutePath);
        if (error) throw new Error(error);
        return;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }

    shell.showItemInFolder(absolutePath);
  }

  private scheduleWatcherFlush(mainWindow: BrowserWindow) {
    if (this.watcherFlushTimer) {
      clearTimeout(this.watcherFlushTimer);
    }

    this.watcherFlushTimer = setTimeout(() => {
      void this.flushWatcherAdds(mainWindow);
    }, 300);
  }

  private async flushWatcherAdds(mainWindow: BrowserWindow) {
    const filePaths = Array.from(this.pendingWatcherAdds).filter(
      (filePath) => !this.archiveManager.isRecentlyCopied(filePath),
    );
    this.pendingWatcherAdds.clear();

    if (!filePaths.length) return;

    const filesByProject = new Map<Project, string[]>();
    for (const filePath of filePaths) {
      const project = this.getProjectForImageFilePath(filePath);
      if (!project) continue;
      const projectFiles = filesByProject.get(project) ?? [];
      projectFiles.push(filePath);
      filesByProject.set(project, projectFiles);
    }

    const addedItems: FolioItem[] = [];
    for (const [project, projectFilePaths] of filesByProject) {
      const result = await this.archiveManager.trackExistingFiles(
        projectFilePaths,
        project.id,
        project.folderPath,
      );
      if (result.changed) {
        await this.archiveManager.save(this.version);
      }
      if (result.items.length) {
        addedItems.push(...result.items);
        await this.appendItemsToProject(project.id, result.items);
      }
    }

    if (addedItems.length) {
      mainWindow.webContents.send("folio:files-added", addedItems);
    }
  }

  private async reconcileArchive(): Promise<ReconciliationResult> {
    await this.repairMissingFlagsForExistingFiles();
    const diskFiles = await this.scanArchiveFiles();
    const diskByPath = new Map(
      diskFiles.map((file) => [path.resolve(file.absolutePath), file]),
    );
    const diskByHash = new Map(diskFiles.map((file) => [file.hash, file]));
    const missingItems: FolioItem[] = [];
    const relocatedItems: FolioItem[] = [];
    let changed = false;

    for (const item of this.archiveManager.getItems()) {
      const absolutePath = path.resolve(this.folioRoot, item.path);
      if (await this.fileExists(absolutePath)) {
        if (item.missing) {
          item.missing = false;
          changed = true;
        }
        continue;
      }

      if (diskByPath.has(absolutePath)) {
        if (item.missing) {
          item.missing = false;
          changed = true;
        }
        continue;
      }

      const relocatedFile = diskByHash.get(item.hash);
      if (relocatedFile) {
        item.path = relocatedFile.path;
        item.missing = false;
        relocatedItems.push(item);
        changed = true;
        continue;
      }

      if (!item.missing) {
        item.missing = true;
        changed = true;
      }
      missingItems.push(item);
    }

    const trackedPaths = new Set(
      this.archiveManager
        .getItems()
        .map((item) => path.resolve(this.folioRoot, item.path)),
    );
    const trackedHashes = new Set(
      this.archiveManager.getItems().map((item) => item.hash),
    );
    const untrackedFiles = diskFiles.filter(
      (file) =>
        !trackedPaths.has(path.resolve(file.absolutePath)) &&
        !trackedHashes.has(file.hash),
    );

    if (changed) {
      await this.archiveManager.save(this.version);
    }

    return {
      scannedAt: new Date().toISOString(),
      untrackedFiles,
      missingItems,
      relocatedItems,
    };
  }

  private async scanArchiveFiles(): Promise<ReconciliationFile[]> {
    const folioRoot = this.folioRoot;
    const roots = [
      path.join(folioRoot, IMAGES_DIR_NAME),
      path.join(folioRoot, "items"),
      ...this.projects.map((project) =>
        path.join(folioRoot, project.folderPath, IMAGES_DIR_NAME),
      ),
    ];
    const files: ReconciliationFile[] = [];

    async function walk(dir: string): Promise<void> {
      let entries: Array<import("node:fs").Dirent>;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;

        const absolutePath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(absolutePath);
          continue;
        }
        if (!entry.isFile()) continue;

        try {
          const hash = await computeHash(absolutePath);
          files.push({
            path: path.relative(folioRoot, absolutePath),
            absolutePath,
            hash,
          });
        } catch (error) {
          console.error("Unable to hash archive file", absolutePath, error);
        }
      }
    }

    for (const root of roots) {
      await walk(root);
    }
    return files;
  }

  private async repairMissingFlagsForExistingFiles(): Promise<boolean> {
    let changed = false;

    for (const item of this.archiveManager.getItems()) {
      if (!item.missing) continue;

      const absolutePath = this.archiveManager.getAbsolutePath(item.path);
      if (await this.fileExists(absolutePath)) {
        item.missing = false;
        changed = true;
      }
    }

    return changed;
  }

  private async migrateMediaFilesToFlatFolders(): Promise<{
    itemsChanged: boolean;
    referencesChanged: boolean;
  }> {
    await this.ensureMediaDirectories();

    const projectFolderById = new Map(
      this.projects.map((project) => [project.id, project.folderPath]),
    );
    const itemsChanged = await this.archiveManager.migrateItemsToProjectImages(
      projectFolderById,
      this.projects[0]?.id,
    );
    const referencesChanged = await this.migrateReferencesToProjectFolders();

    await Promise.all(
      this.projects.map((project) => this.syncProjectWorksFolder(project)),
    );
    await this.removeLegacyMediaDirectories();

    return { itemsChanged, referencesChanged };
  }

  private async migrateReferencesToProjectFolders(): Promise<boolean> {
    let changed = false;

    this.canvases = await Promise.all(
      this.canvases.map(async (canvas) => {
        const project = this.getProjectForCanvas(canvas.id);
        if (!project) return canvas;

        let canvasChanged = false;
        const referencesDir = path.join(
          this.folioRoot,
          project.folderPath,
          REFERENCES_DIR_NAME,
        );
        await fs.mkdir(referencesDir, { recursive: true });

        const references = await Promise.all(
          (canvas.references ?? []).map(async (reference) => {
            const sourcePath = this.archiveManager.getAbsolutePath(reference.path);
            if (!(await this.fileExists(sourcePath))) return reference;

            if (this.isFlatFileInDirectory(sourcePath, referencesDir)) {
              return reference;
            }

            const destPath = await this.moveFileToDirectory(
              sourcePath,
              referencesDir,
              reference.filename || path.basename(reference.path),
            );
            const nextReference = {
              ...reference,
              filename: path.basename(destPath),
              path: path.relative(this.folioRoot, destPath),
            };
            canvasChanged = true;
            return nextReference;
          }),
        );

        if (!canvasChanged) return canvas;
        changed = true;
        return { ...canvas, references };
      }),
    );

    return changed;
  }

  private async ensureMediaDirectories(): Promise<void> {
    await Promise.all([
      fs.mkdir(this.folioRoot, { recursive: true }),
      fs.mkdir(path.join(this.folioRoot, "projects"), { recursive: true }),
      fs.mkdir(this.dotFolio, { recursive: true }),
    ]);
  }

  private isFlatFileInDirectory(filePath: string, directory: string): boolean {
    return path.resolve(path.dirname(filePath)) === path.resolve(directory);
  }

  private isPathInsideDirectory(filePath: string, directory: string): boolean {
    const relative = path.relative(directory, filePath);
    return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
  }

  private async moveFileToDirectory(
    sourcePath: string,
    destDir: string,
    preferredFilename: string,
  ): Promise<string> {
    await fs.mkdir(destDir, { recursive: true });

    const extension = path.extname(preferredFilename).toLowerCase();
    const baseName = sanitizeFileBaseName(
      path.basename(preferredFilename, extension),
    );
    let destPath = path.join(destDir, `${baseName}${extension}`);
    let counter = 2;

    while (
      (await this.fileExists(destPath)) &&
      path.resolve(destPath) !== path.resolve(sourcePath)
    ) {
      destPath = path.join(destDir, `${baseName}_${counter}${extension}`);
      counter += 1;
    }

    if (path.resolve(destPath) === path.resolve(sourcePath)) return destPath;

    try {
      await fs.rename(sourcePath, destPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EXDEV") {
        throw error;
      }
      await fs.copyFile(sourcePath, destPath);
      await fs.rm(sourcePath, { force: true });
    }

    return destPath;
  }

  private async removeLegacyMediaDirectories(): Promise<void> {
    await this.removeEmptyDirectoryTree(path.join(this.folioRoot, "items"));
    await this.removeEmptyDirectoryTree(path.join(this.folioRoot, IMAGES_DIR_NAME));
    await this.removeGeneratedWorksDirectory(path.join(this.folioRoot, WORKS_DIR_NAME));
    await this.removeDirectoryIfEmpty(path.join(this.folioRoot, WORKS_DIR_NAME));
    await this.removeEmptyDirectoryTree(
      path.join(this.folioRoot, REFERENCES_DIR_NAME),
    );

    await Promise.all(
      this.projects.map(async (project) => {
        const projectRoot = path.join(this.folioRoot, project.folderPath);

        await Promise.all(
          project.boardIds.map((boardId) =>
            this.removeDirectoryIfEmpty(
              path.join(projectRoot, "boards", boardId, REFERENCES_DIR_NAME),
            ),
          ),
        );
      }),
    );
  }

  private async removeDirectoryIfEmpty(directory: string): Promise<void> {
    let entries: string[];
    try {
      entries = await fs.readdir(directory);
    } catch {
      return;
    }

    if (entries.length) return;
    await fs.rm(directory, { recursive: true, force: true });
  }

  private async removeEmptyDirectoryTree(directory: string): Promise<void> {
    let entries: Array<import("node:fs").Dirent>;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

    await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => this.removeEmptyDirectoryTree(path.join(directory, entry.name))),
    );

    await this.removeDirectoryIfEmpty(directory);
  }

  private async removeGeneratedWorksDirectory(worksDir: string): Promise<void> {
    let entries: Array<import("node:fs").Dirent>;
    try {
      entries = await fs.readdir(worksDir, { withFileTypes: true });
    } catch {
      return;
    }

    const knownItemIds = new Set(this.archiveManager.getItems().map((item) => item.id));
    await Promise.all(
      entries.map(async (entry) => {
        if (!entry.isFile() && !entry.isSymbolicLink()) return;
        const isGeneratedWork = Array.from(knownItemIds).some((itemId) =>
          entry.name.includes(`-${itemId}`),
        );
        if (!isGeneratedWork) return;
        await fs.rm(path.join(worksDir, entry.name), { force: true });
      }),
    );

    await this.removeDirectoryIfEmpty(worksDir);
  }

  private validateSchema(
    filename: string,
    data: unknown,
    arrayKey: "items" | "tags" | "canvases" | "projects",
  ) {
    if (
      !data ||
      typeof data !== "object" ||
      (data as { version?: unknown }).version !== SCHEMA_VERSION ||
      !Array.isArray((data as Record<string, unknown>)[arrayKey])
    ) {
      throw new Error(
        `${filename} is not a valid Folio v${SCHEMA_VERSION} data file.`,
      );
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async migrateProjectData(): Promise<boolean> {
    let changed = false;
    const items = this.archiveManager.getItems();

    if (!this.projects.length && (items.length || this.canvases.length)) {
      const now = new Date().toISOString();
      const defaultProjectId = "project_default";
      const defaultProject: Project = {
        id: defaultProjectId,
        title: "Studio Archive",
        description: "Migrated archive items and boards.",
        status: "active",
        createdAt: now,
        updatedAt: now,
        folderPath: "projects/studio-archive",
        imageIds: items.map((item) => item.id),
        workItemIds: [],
        boardIds: this.canvases.map((canvas) => canvas.id),
        reviews: [],
      };
      this.projects = [defaultProject];
      changed = true;
    }

    if (!this.projects.length) return changed;

    const firstProject = this.projects[0];
    const boardIdsByProject = new Map(
      this.projects.map((project) => [project.id, new Set(project.boardIds)]),
    );

    this.canvases = this.canvases.map((canvas) => {
      const projectId = canvas.projectId ?? firstProject.id;
      const boardIds = boardIdsByProject.get(projectId);
      if (boardIds && !boardIds.has(canvas.id)) {
        boardIds.add(canvas.id);
        changed = true;
      }
      if (canvas.projectId === projectId) return canvas;
      changed = true;
      return { ...canvas, projectId };
    });

    const itemIdsByProject = new Map(
      this.projects.map((project) => [project.id, new Set(project.imageIds)]),
    );

    for (const item of items) {
      const projectId = item.projectId ?? firstProject.id;
      const imageIds = itemIdsByProject.get(projectId);
      if (imageIds && !imageIds.has(item.id)) {
        imageIds.add(item.id);
        changed = true;
      }
      if (!item.projectId) {
        item.projectId = projectId;
        changed = true;
      }
    }

    this.projects = await Promise.all(
      this.projects.map(async (project) => {
        await this.ensureProjectDirectories(project);
        const imageIds = Array.from(itemIdsByProject.get(project.id) ?? []);
        const boardIds = Array.from(boardIdsByProject.get(project.id) ?? []);
        const previousReviews = Array.isArray(project.reviews)
          ? project.reviews
          : [];
        const normalizedReviews = previousReviews.map((review) => ({
          ...review,
          workItemIds: review.workItemIds.filter((id) => imageIds.includes(id)),
        }));
        const normalizedProject = {
          ...project,
          status: project.status ?? "active",
          imageIds,
          workItemIds: project.workItemIds.filter((id) => imageIds.includes(id)),
          boardIds,
          reviews: normalizedReviews,
        };
        if (
          normalizedProject.status !== project.status ||
          normalizedProject.imageIds.length !== project.imageIds.length ||
          normalizedProject.workItemIds.length !== project.workItemIds.length ||
          normalizedProject.boardIds.length !== project.boardIds.length ||
          previousReviews !== project.reviews ||
          normalizedProject.reviews.some(
            (review, index) =>
              review.workItemIds.length !== previousReviews[index]?.workItemIds.length,
          )
        ) {
          changed = true;
        }
        return normalizedProject;
      }),
    );

    return changed;
  }

  private currentData(): FolioData {
    return {
      version: SCHEMA_VERSION,
      items: this.archiveManager.getItems(),
      tags: this.tags,
      canvases: this.canvases,
      projects: this.projects,
    };
  }

  private async ensureDefaultProject(): Promise<Project> {
    const existingProject = this.projects[0];
    if (existingProject) {
      await this.ensureProjectDirectories(existingProject);
      return existingProject;
    }

    const now = new Date().toISOString();
    const defaultProject: Project = {
      id: "project_default",
      title: "Studio Archive",
      description: "Default project for imported studio files.",
      status: "active",
      createdAt: now,
      updatedAt: now,
      folderPath: "projects/studio-archive",
      imageIds: [],
      workItemIds: [],
      boardIds: [],
      reviews: [],
    };

    this.projects = [defaultProject];
    await this.ensureProjectDirectories(defaultProject);
    await this.storageManager.saveProjects(
      this.projectsPath,
      this.projects,
      this.version,
    );
    return defaultProject;
  }

  private async createProjectFolderPath(
    title: string,
    projectId: string,
  ): Promise<string> {
    const baseSlug = sanitizeFileBaseName(title);
    const projectsRoot = path.join(this.folioRoot, "projects");
    let folderName = baseSlug;
    let folderPath = path.join(projectsRoot, folderName);
    let counter = 2;

    while (await this.fileExists(folderPath)) {
      folderName = `${baseSlug}-${counter}`;
      folderPath = path.join(projectsRoot, folderName);
      counter += 1;
    }

    if (!folderName) {
      folderName = `project-${projectId.slice(0, 8)}`;
    }

    return path.join("projects", folderName);
  }

  private async ensureProjectDirectories(project: Project): Promise<void> {
    const projectRoot = path.join(this.folioRoot, project.folderPath);
    await Promise.all([
      fs.mkdir(path.join(projectRoot, IMAGES_DIR_NAME), { recursive: true }),
      fs.mkdir(path.join(projectRoot, WORKS_DIR_NAME), { recursive: true }),
      fs.mkdir(path.join(projectRoot, REFERENCES_DIR_NAME), { recursive: true }),
      fs.mkdir(path.join(projectRoot, "boards"), { recursive: true }),
      fs.mkdir(path.join(projectRoot, "reviews"), { recursive: true }),
      ...project.boardIds.map((boardId) =>
        fs.mkdir(path.join(projectRoot, "boards", boardId), { recursive: true }),
      ),
    ]);
  }

  private repairLegacyOutputStages(): boolean {
    let changed = false;

    for (const item of this.archiveManager.getItems()) {
      if ((item.stage as string | undefined) !== "output") continue;
      item.stage = "final";
      changed = true;
    }

    return changed;
  }

  private async syncProjectReviewFiles(project: Project): Promise<void> {
    const reviewsDir = path.join(this.folioRoot, project.folderPath, "reviews");
    await fs.mkdir(reviewsDir, { recursive: true });

    await Promise.all(
      (project.reviews ?? []).map((review) =>
        fs.writeFile(path.join(reviewsDir, `review-${review.id}.md`), review.markdown),
      ),
    );
  }

  private async syncProjectWorksFolder(project: Project): Promise<void> {
    const worksDir = path.join(this.folioRoot, project.folderPath, WORKS_DIR_NAME);
    await fs.mkdir(worksDir, { recursive: true });

    const desiredIds = new Set(project.workItemIds);
    const projectImageIds = new Set(project.imageIds);
    const itemById = new Map(
      this.archiveManager.getItems().map((item) => [item.id, item]),
    );

    const entries = await fs.readdir(worksDir, { withFileTypes: true });
    await Promise.all(
      entries.map(async (entry) => {
        if (!entry.isFile() && !entry.isSymbolicLink()) return;
        const representedItemId = Array.from(projectImageIds).find((itemId) =>
          entry.name.includes(`-${itemId}`),
        );
        if (!representedItemId || desiredIds.has(representedItemId)) {
          return;
        }
        await fs.rm(path.join(worksDir, entry.name), { force: true });
      }),
    );

    for (const itemId of project.workItemIds) {
      const item = itemById.get(itemId);
      if (!item || item.missing) continue;

      const sourcePath = this.archiveManager.getAbsolutePath(item.path);
      if (!(await this.fileExists(sourcePath))) continue;

      const extension = path.extname(item.path);
      const baseName = sanitizeFileBaseName(
        item.title || path.basename(item.path, extension) || item.id,
      );
      const destPath = path.join(worksDir, `${baseName}-${item.id}${extension}`);
      if (await this.fileExists(destPath)) continue;

      try {
        await fs.rm(destPath, { force: true });
        await fs.symlink(sourcePath, destPath);
      } catch {
        await fs.rm(destPath, { force: true });
        await fs.copyFile(sourcePath, destPath);
      }
    }
  }

  private async runPhotosPickerHelper(
    exportDir: string,
  ): Promise<"exported" | "cancelled"> {
    const helperPath = this.getPhotosPickerHelperPath();
    if (!(await this.fileExists(helperPath))) {
      throw new Error(
        "Photos picker helper is not available. Run npm run build:native and restart Folio.",
      );
    }

    const { stdout } = await execFileAsync(
      helperPath,
      [exportDir],
      {
        timeout: 300000,
      },
    );

    return stdout.includes(PHOTOS_PICKER_CANCELLED) ? "cancelled" : "exported";
  }

  private getPhotosPickerHelperPath(): string {
    if (app.isPackaged) {
      return path.join(
        process.resourcesPath,
        "native",
        PHOTOS_PICKER_HELPER_NAME,
      );
    }

    return path.join(
      process.cwd(),
      "resources",
      "native",
      PHOTOS_PICKER_HELPER_NAME,
    );
  }

  private async listFilesRecursive(directory: string): Promise<string[]> {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const filePaths = await Promise.all(
      entries.map(async (entry) => {
        if (entry.name.startsWith(".")) return [];

        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) return this.listFilesRecursive(entryPath);
        if (entry.isFile()) return [entryPath];
        return [];
      }),
    );

    return filePaths.flat().sort((a, b) => a.localeCompare(b));
  }

  private async removeTemporaryDirectory(directory: string): Promise<void> {
    try {
      await fs.rm(directory, { recursive: true, force: true });
    } catch (error) {
      console.error("Unable to clean Photos import directory", directory, error);
    }
  }

  private errorMessage(error: unknown): string {
    const structuredError = error as { stderr?: unknown };
    const stderr =
      typeof structuredError?.stderr === "string"
        ? structuredError.stderr.trim()
        : "";
    const message = stderr || (error instanceof Error ? error.message : String(error));
    const executionError = message.match(/execution error: (.*?)(?: \(-?\d+\))?$/);

    return executionError?.[1]?.trim() ?? message.trim();
  }

  private isSafeFolioPath(absolutePath: string): boolean {
    const resolved = path.resolve(absolutePath);
    const root = path.resolve(this.folioRoot);
    return resolved === root || resolved.startsWith(`${root}${path.sep}`);
  }

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === ".svg") return "image/svg+xml";
    if (ext === ".png") return "image/png";
    if (ext === ".webp") return "image/webp";
    if (ext === ".gif") return "image/gif";
    if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
    return "application/octet-stream";
  }
}
