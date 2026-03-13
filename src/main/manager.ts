import { app, ipcMain } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { nanoid } from "nanoid";
import {
  FolioData,
  FolioItem,
  ImportSource,
  ItemType,
  Canvas,
  Tag,
} from "../types";
import { computeHash, createDirectoryByDate, exists } from "../helpers";
import { SCHEMA_VERSION } from "../constants";
import { FolioStorage } from "./store";

/**
 * The core engine of the main process.
 * Manages the in-memory data state, file operations, and IPC registration.
 */
export interface FolioManagerInterface {
  /** Registers all window.folio IPC handlers. Call this during app "ready". */
  registerHandlers(): void;

  /** Loads folio.json from disk into memory. */
  loadData(): Promise<FolioData>;

  /** Atomically writes items to folio.json. */
  saveItems(items: FolioItem[]): Promise<void>;

  /** Atomically writes canvases to canvases.json. */
  saveCanvases(canvases: Canvas[]): Promise<void>;

  /** Atomically writes tags to tags.json. */
  saveTags(tags: Tag[]): Promise<void>;

  /**
   * Imports one or more files into the archive.
   * Accepts either file paths (drag & drop) or raw buffers (clipboard paste).
   */
  importItems(sources: ImportSource[]): Promise<FolioItem[]>;

  /**
   * Imports one or more files as references for a specific canvas.
   * Returns relative paths for the newly saved reference files.
   */
  importReferences(
    canvasId: string,
    sources: ImportSource[],
  ): Promise<string[]>;
}

export class FolioManager implements FolioManagerInterface {
  private items: FolioItem[] = [];
  private canvases: Canvas[] = [];
  private tags: Tag[] = [];
  private version: number = SCHEMA_VERSION;

  private readonly folioRoot: string;
  private readonly dotFolio: string;
  private readonly dbPath: string;
  private readonly tagsPath: string;
  private readonly canvasesPath: string;
  private recentlyCopied = new Set<string>();
  private store = FolioStorage.getInstance();

  constructor() {
    this.folioRoot = path.join(app.getPath("home"), "Documents", "Folio");
    this.dotFolio = path.join(this.folioRoot, ".folio");
    this.dbPath = path.join(this.dotFolio, "folio.json");
    this.tagsPath = path.join(this.dotFolio, "tags.json");
    this.canvasesPath = path.join(this.dotFolio, "canvases.json");
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

    // Single unified import handler for archive items
    ipcMain.handle(
      "folio:import-items",
      (_: unknown, sources: ImportSource[]) => this.importItems(sources),
    );

    // Single unified import handler for canvas references
    ipcMain.handle(
      "folio:import-references",
      (_: unknown, canvasId: string, sources: ImportSource[]) =>
        this.importReferences(canvasId, sources),
    );
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
    this.items = folioBase.items;
    this.tags = tagsBase.tags;
    this.canvases = canvasesBase.canvases;

    return {
      version: SCHEMA_VERSION,
      items: this.items,
      tags: this.tags,
      canvases: this.canvases,
    };
  }

  async saveItems(items: FolioItem[]): Promise<void> {
    this.items = items;
    await this.store.saveItems(this.dbPath, this.items, this.version);
  }

  async saveCanvases(canvases: Canvas[]): Promise<void> {
    this.canvases = canvases;
    await this.store.saveCanvases(
      this.canvasesPath,
      this.canvases,
      this.version,
    );
  }

  async saveTags(tags: Tag[]): Promise<void> {
    this.tags = tags;
    await this.store.saveTags(this.tagsPath, this.tags, this.version);
  }

  async importItems(sources: ImportSource[]): Promise<FolioItem[]> {
    const destDir = await createDirectoryByDate(this.folioRoot);
    const items: FolioItem[] = [];

    for (const source of sources) {
      const { filename, ext } = this.resolveSourceMeta(source);
      const destPath = await this.saveToDirectory(
        source,
        filename,
        ext,
        destDir,
      );
      const hash = await computeHash(destPath);
      const item = this.buildItem(destPath, filename, ext, hash);

      this.trackRecentlyCopied(destPath);
      items.push(item);
    }

    return items;
  }

  async importReferences(
    canvasId: string,
    sources: ImportSource[],
  ): Promise<string[]> {
    const destDir = path.join(this.folioRoot, "references", canvasId);
    await fs.mkdir(destDir, { recursive: true });

    const paths: string[] = [];

    for (const source of sources) {
      const { filename, ext } = this.resolveSourceMeta(source);
      const destPath = await this.saveToDirectory(
        source,
        filename,
        ext,
        destDir,
      );
      paths.push(path.relative(this.folioRoot, destPath));
    }

    return paths;
  }

  /**
   * Resolves the filename and extension from any ImportSource.
   */
  private resolveSourceMeta(source: ImportSource): {
    filename: string;
    ext: string;
  } {
    if (source.kind === "path") {
      const ext = path.extname(source.filePath);
      const filename = path.basename(source.filePath, ext);
      return { filename, ext };
    }
    return {
      filename: source.filename ?? "pasted-image",
      ext: source.ext,
    };
  }

  /**
   * Saves a file or buffer to a directory with sanitization and collision handling.
   * Returns the absolute destination path.
   */
  private async saveToDirectory(
    source: ImportSource,
    filename: string,
    ext: string,
    destDir: string,
  ): Promise<string> {
    const sanitizedName = filename.toLowerCase().replace(/[^a-z0-9]/g, "-");
    let destFilename = `${sanitizedName}${ext}`;
    let destPath = path.join(destDir, destFilename);

    // Collision handling: append _2, _3, etc.
    let counter = 2;
    while (await exists(destPath)) {
      destFilename = `${sanitizedName}_${counter}${ext}`;
      destPath = path.join(destDir, destFilename);
      counter++;
    }

    if (source.kind === "path") {
      await this.store.saveFile(destPath, {
        kind: "path",
        source: source.filePath,
      });
    } else {
      await this.store.saveFile(destPath, {
        kind: "buffer",
        source: source.data,
      });
    }

    return destPath;
  }

  /**
   * Constructs a FolioItem from a finalized destination path and metadata.
   */
  private buildItem(
    destPath: string,
    filename: string,
    ext: string,
    hash: string,
  ): FolioItem {
    return {
      id: nanoid(),
      path: path.relative(this.folioRoot, destPath),
      hash,
      type: this.inferType(ext),
      date: new Date().toISOString(),
      title: filename,
      tagIds: [],
      description: "",
    };
  }

  /**
   * Adds a path to the recently-copied set and auto-removes it after 2s.
   * Prevents the file watcher from double-counting freshly imported files.
   */
  private trackRecentlyCopied(destPath: string) {
    this.recentlyCopied.add(destPath);
    setTimeout(() => this.recentlyCopied.delete(destPath), 2000);
  }

  /**
   * Infers item type from file extension.
   */
  private inferType(ext: string): ItemType {
    const e = ext.toLowerCase();
    if ([".jpg", ".jpeg", ".png", ".webp", ".heic"].includes(e)) return "image";
    if ([".mp3", ".wav", ".aiff", ".m4a"].includes(e)) return "audio";
    if ([".mp4", ".mov", ".gif"].includes(e)) return "video";
    if ([".md", ".docx", ".txt"].includes(e)) return "text";
    return "other";
  }
}
