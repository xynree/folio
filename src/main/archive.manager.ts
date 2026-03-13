import path from "node:path";
import { nanoid } from "nanoid";
import { FolioItem, ImportSource, ItemType } from "../types";
import { computeHash, createDirectoryByDate, exists } from "../helpers";
import { FolioStorage } from "./storage.manager";

/**
 * ArchiveManager handles all filesystem-level operations for the media archive,
 * including importing files, generating paths, and persisting item metadata.
 */
export class ArchiveManager {
  private items: FolioItem[] = [];
  private recentlyCopied = new Set<string>();
  private store = FolioStorage.getInstance();

  constructor(
    private folioRoot: string,
    private dbPath: string,
  ) {}

  public getItems(): FolioItem[] {
    return this.items;
  }

  public setItems(items: FolioItem[]) {
    this.items = items;
  }

  /**
   * Imports one or more files into the archive.
   */
  async importItems(sources: ImportSource[]): Promise<FolioItem[]> {
    const destDir = await createDirectoryByDate(this.folioRoot);
    const newItems: FolioItem[] = [];

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
      newItems.push(item);
      this.items.push(item);
    }

    return newItems;
  }

  /**
   * Resolves the filename and extension from any ImportSource.
   */
  public resolveSourceMeta(source: ImportSource): {
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
  public async saveToDirectory(
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

  public isRecentlyCopied(filePath: string): boolean {
    return this.recentlyCopied.has(filePath);
  }

  /**
   * Saves the current items to disk.
   */
  async save(version: number): Promise<void> {
    await this.store.saveItems(this.dbPath, this.items, version);
  }
}
