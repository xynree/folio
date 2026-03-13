import fs from "node:fs/promises";
import { FolioItem, Tag, Canvas } from "../types";

/**
 * Strategy interface for saving different types of data.
 */
export interface SaveStrategy<T> {
  save(filePath: string, data: T): Promise<void>;
}

/**
 * Standard strategy for saving JSON data atomically.
 */
export class JsonSaveStrategy<T> implements SaveStrategy<T> {
  async save(filePath: string, data: T): Promise<void> {
    const tmpPath = `${filePath}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(data, null, 2));
    await fs.rename(tmpPath, filePath);
  }
}

/**
 * Strategy for saving raw files or copying from existing paths.
 */
export interface FileSaveSource {
  kind: "path" | "buffer";
  source: string | Buffer;
}

export class FileSaveStrategy implements SaveStrategy<FileSaveSource> {
  async save(destPath: string, data: FileSaveSource): Promise<void> {
    if (data.kind === "path") {
      await fs.copyFile(data.source as string, destPath);
    } else {
      await fs.writeFile(destPath, data.source as Buffer);
    }
  }
}

/**
 * FolioStorage handles the low-level persistence of all application data,
 * using different strategies for JSON metadata and binary file content.
 */
export class FolioStorage {
  private static instance: FolioStorage;
  private jsonStrategy = new JsonSaveStrategy<Record<string, unknown>>();
  private fileStrategy = new FileSaveStrategy();

  private constructor() {
    // Private constructor for singleton pattern
  }

  public static getInstance(): FolioStorage {
    if (!FolioStorage.instance) {
      FolioStorage.instance = new FolioStorage();
    }
    return FolioStorage.instance;
  }

  /**
   * Saves items with the version header.
   */
  async saveItems(
    filePath: string,
    items: FolioItem[],
    version: number,
  ): Promise<void> {
    await this.jsonStrategy.save(filePath, { version, items });
  }

  /**
   * Saves tags with the version header.
   */
  async saveTags(
    filePath: string,
    tags: Tag[],
    version: number,
  ): Promise<void> {
    await this.jsonStrategy.save(filePath, { version, tags });
  }

  /**
   * Saves canvases with the version header.
   */
  async saveCanvases(
    filePath: string,
    canvases: Canvas[],
    version: number,
  ): Promise<void> {
    await this.jsonStrategy.save(filePath, { version, canvases });
  }

  /**
   * Saves or copies a file.
   */
  async saveFile(destPath: string, source: FileSaveSource): Promise<void> {
    await this.fileStrategy.save(destPath, source);
  }

  /**
   * Saves arbitrary content (generic strategy usage).
   */
  async saveCustom<T>(
    filePath: string,
    data: T,
    strategy: SaveStrategy<T>,
  ): Promise<void> {
    await strategy.save(filePath, data);
  }
}
