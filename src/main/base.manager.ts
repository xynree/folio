import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { FolioData, FolioItem, ImportSource, Canvas, Tag } from "../types";
import { SCHEMA_VERSION } from "../constants";
import { FolioStorage } from "./storage.manager";
import { ArchiveManager } from "./archive.manager";
import chokidar from "chokidar";


/**
 * The core engine of the main process.
 * Manages the in-memory data state, file operations, and IPC registration.
 */
export interface FolioManagerInterface {
  registerHandlers(): void;
  loadData(): Promise<FolioData>;
  saveItems(items: FolioItem[]): Promise<void>;
  saveCanvases(canvases: Canvas[]): Promise<void>;
  saveTags(tags: Tag[]): Promise<void>;
  importItems(sources: ImportSource[]): Promise<FolioItem[]>;
  importReferences(
    canvasId: string,
    sources: ImportSource[],
  ): Promise<string[]>;
  startWatcher(mainWindow: BrowserWindow): void;
}

export class FolioManager implements FolioManagerInterface {
  private canvases: Canvas[] = [];
  private tags: Tag[] = [];
  private version: number = SCHEMA_VERSION;

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
      (_: unknown, sources: ImportSource[]) => this.importItems(sources),
    );

    ipcMain.handle(
      "folio:import-references",
      (_: unknown, canvasId: string, sources: ImportSource[]) =>
        this.importReferences(canvasId, sources),
    );
  }

  public startWatcher(mainWindow: BrowserWindow) {
    const watcher = chokidar.watch(path.join(this.folioRoot, "items"), {
      ignored: /(\.folio|references)/,
      ignoreInitial: true,  // don't fire for files already on disk at startup
      awaitWriteFinish: { stabilityThreshold: 300 }, // debounce
    });
    watcher.on("add", async (filePath) => {
      // skip files we just copied ourselves
      if (this.archiveManager.isRecentlyCopied(filePath)) return;
      // file appeared in Finder — process it
      const items = await this.archiveManager.importItems([{ kind: "path", filePath }]);
      await this.archiveManager.save(this.version);
      // push to renderer
      mainWindow.webContents.send("folio:files-added", items);
    });
    watcher.on("unlink", (filePath) => {
      // mark item missing rather than deleting metadata
      const item = this.archiveManager.getItems().find(i =>
        path.join(this.folioRoot, i.path) === filePath
      );
      if (item) {
        item.missing = true;
        this.archiveManager.save(this.version);
      }
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

    this.version = SCHEMA_VERSION;
    this.archiveManager.setItems(folioBase.items);
    this.tags = tagsBase.tags;
    this.canvases = canvasesBase.canvases;

    return {
      version: SCHEMA_VERSION,
      items: this.archiveManager.getItems(),
      tags: this.tags,
      canvases: this.canvases,
    };
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

  async importItems(sources: ImportSource[]): Promise<FolioItem[]> {
    return this.archiveManager.importItems(sources);
  }

  async importReferences(
    canvasId: string,
    sources: ImportSource[],
  ): Promise<string[]> {
    const destDir = path.join(this.folioRoot, "references", canvasId);
    await fs.mkdir(destDir, { recursive: true });

    const paths: string[] = [];

    for (const source of sources) {
      const { filename, ext } = this.archiveManager.resolveSourceMeta(source);
      const destPath = await this.archiveManager.saveToDirectory(
        source,
        filename,
        ext,
        destDir,
      );
      paths.push(path.relative(this.folioRoot, destPath));
    }

    return paths;
  }
}
