import { app, BrowserWindow, dialog, ipcMain, protocol, shell } from "electron";
import { watch } from "chokidar";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { computeHash } from "../helpers";
import { SCHEMA_VERSION } from "../constants";
import {
  Canvas,
  CanvasReference,
  FolioData,
  FolioItem,
  ImportSource,
  ReconciliationFile,
  ReconciliationResult,
  Tag,
  ThumbnailUrls,
} from "../types";
import { ArchiveManager } from "./archive.manager";
import { FolioStorage } from "./storage.manager";

const execFileAsync = promisify(execFile);
const PHOTOS_PICKER_CANCELLED = "__FOLIO_PHOTOS_PICKER_CANCELLED__";
const PHOTOS_PICKER_HELPER_NAME = "FolioPhotosPicker";

interface ImportFileSelection {
  filePaths: string[];
  cleanupDir?: string;
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
  copyToFolio(filePaths: string[]): Promise<FolioItem[]>;
  importToFolio(): Promise<FolioItem[]>;
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
  private version: number = SCHEMA_VERSION;
  private reconciliationResult: ReconciliationResult = emptyReconciliationResult();
  private pendingWatcherAdds = new Set<string>();
  private watcherFlushTimer?: ReturnType<typeof setTimeout>;

  private readonly folioRoot: string;
  private readonly dotFolio: string;
  private readonly dbPath: string;
  private readonly tagsPath: string;
  private readonly canvasesPath: string;

  private archiveManager: ArchiveManager;
  private storageManager = FolioStorage.getInstance();

  constructor() {
    this.folioRoot = path.join(app.getPath("home"), "Documents", "Folio");
    this.dotFolio = path.join(this.folioRoot, ".folio");
    this.dbPath = path.join(this.dotFolio, "folio.json");
    this.tagsPath = path.join(this.dotFolio, "tags.json");
    this.canvasesPath = path.join(this.dotFolio, "canvases.json");

    this.archiveManager = new ArchiveManager(this.folioRoot, this.dbPath);
  }

  registerHandlers() {
    ipcMain.handle("folio:get-folio-data", () => this.loadData());
    ipcMain.handle("folio:save-folio-data", (_: unknown, data: FolioData) =>
      this.saveFolioData(data),
    );
    ipcMain.handle("folio:copy-to-folio", (_: unknown, filePaths: string[]) =>
      this.copyToFolio(filePaths),
    );
    ipcMain.handle("folio:import-to-folio", () => this.importToFolio());
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
        const items = await this.archiveManager.importItems(sources);
        await this.archiveManager.save(this.version);
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
    const archiveRoot = path.join(this.folioRoot, "items");
    const watcher = watch(archiveRoot, {
      ignored: (filePath) => {
        const relative = path.relative(this.folioRoot, filePath);
        return (
          relative.startsWith(".folio") ||
          relative.startsWith("references") ||
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
      if (this.archiveManager.isRecentlyCopied(filePath)) return;
      this.pendingWatcherAdds.add(filePath);
      this.scheduleWatcherFlush(mainWindow);
    });

    watcher.on("unlink", async (filePath) => {
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
    const [rawFolio, rawTags, rawCanvases] = await Promise.all([
      fs.readFile(this.dbPath, "utf-8"),
      fs.readFile(this.tagsPath, "utf-8"),
      fs.readFile(this.canvasesPath, "utf-8"),
    ]);

    const folioBase = JSON.parse(rawFolio);
    const tagsBase = JSON.parse(rawTags);
    const canvasesBase = JSON.parse(rawCanvases);

    this.validateSchema("folio.json", folioBase, "items");
    this.validateSchema("tags.json", tagsBase, "tags");
    this.validateSchema("canvases.json", canvasesBase, "canvases");

    this.version = SCHEMA_VERSION;
    this.archiveManager.setItems(folioBase.items);
    this.tags = tagsBase.tags;
    this.canvases = canvasesBase.canvases;

    if (await this.repairMissingFlagsForExistingFiles()) {
      await this.archiveManager.save(this.version);
    }

    return {
      version: SCHEMA_VERSION,
      items: this.archiveManager.getItems(),
      tags: this.tags,
      canvases: this.canvases,
    };
  }

  async saveFolioData(data: FolioData): Promise<void> {
    this.version = SCHEMA_VERSION;
    this.archiveManager.setItems(data.items);
    this.tags = data.tags;
    this.canvases = data.canvases;

    await Promise.all([
      this.archiveManager.save(this.version),
      this.storageManager.saveTags(this.tagsPath, this.tags, this.version),
      this.storageManager.saveCanvases(
        this.canvasesPath,
        this.canvases,
        this.version,
      ),
    ]);
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
    const items = await this.archiveManager.copyToFolio(filePaths);
    await this.archiveManager.save(this.version);

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

  async copyReference(
    canvasId: string,
    filePaths: string[],
  ): Promise<CanvasReference[]> {
    return this.archiveManager.copyReferences(canvasId, filePaths);
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

    const updatedCanvases = this.canvases.map((canvas) => {
      const positions = { ...canvas.positions };
      ids.forEach((id) => delete positions[id]);

      return {
        ...canvas,
        itemIds: canvas.itemIds.filter((id) => !ids.has(id)),
        positions,
        edges: canvas.edges.filter(
          (edge) => !ids.has(edge.fromId) && !ids.has(edge.toId),
        ),
      };
    });

    const nextData = {
      version: SCHEMA_VERSION,
      items: remainingItems,
      tags: this.tags,
      canvases: updatedCanvases,
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

    const result = await this.archiveManager.trackExistingFiles(filePaths);
    if (result.changed) {
      await this.archiveManager.save(this.version);
    }

    if (result.items.length) {
      mainWindow.webContents.send("folio:files-added", result.items);
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
    const archiveRoot = path.join(folioRoot, "items");
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

    await walk(archiveRoot);
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

  private validateSchema(
    filename: string,
    data: unknown,
    arrayKey: "items" | "tags" | "canvases",
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
