import { app, ipcMain } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { nanoid } from "nanoid";
import { FolioData, FolioItem, ImportSource, ItemType } from "../types";
import { computeHash, createDirectoryByDate, exists } from "../helpers";
import { SCHEMA_VERSION } from "../constants";

/**
 * The core engine of the main process.
 * Manages the in-memory data state, file operations, and IPC registration.
 */
export interface FolioManagerInterface {
  /** Registers all window.folio IPC handlers. Call this during app "ready". */
  registerHandlers(): void;

  /** Loads folio.json from disk into memory. */
  loadData(): Promise<FolioData>;

  /** Atomically writes data to folio.json. */
  saveData(newData: FolioData): Promise<void>;

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
  private data: FolioData | null = null;
  private readonly folioRoot: string;
  private readonly dotFolio: string;
  private readonly dbPath: string;
  private recentlyCopied = new Set<string>();

  constructor() {
    this.folioRoot = path.join(app.getPath("home"), "Documents", "Folio");
    this.dotFolio = path.join(this.folioRoot, ".folio");
    this.dbPath = path.join(this.dotFolio, "folio.json");
  }

  registerHandlers() {
    ipcMain.handle("folio:get-data", () => this.loadData());
    ipcMain.handle("folio:save-data", (_, data: FolioData) =>
      this.saveData(data),
    );

    // Single unified import handler for archive items
    ipcMain.handle("folio:import-items", (_, sources: ImportSource[]) =>
      this.importItems(sources),
    );

    // Single unified import handler for canvas references
    ipcMain.handle(
      "folio:import-references",
      (_, canvasId: string, sources: ImportSource[]) =>
        this.importReferences(canvasId, sources),
    );
  }

  async loadData(): Promise<FolioData> {
    const raw = await fs.readFile(this.dbPath, "utf-8");
    const data = JSON.parse(raw) as FolioData;

    if (data.version !== SCHEMA_VERSION) {
      throw new Error(`Unsupported schema version: ${data.version}`);
    }

    this.data = data;
    return data;
  }

  async saveData(newData: FolioData): Promise<void> {
    this.data = newData;
    const tmpPath = `${this.dbPath}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(this.data, null, 2));
    await fs.rename(tmpPath, this.dbPath);
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
      await fs.copyFile(source.filePath, destPath);
    } else {
      await fs.writeFile(destPath, source.data);
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
