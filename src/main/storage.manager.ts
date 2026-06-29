import fs from "node:fs/promises";

// ---------------------------------------------------------------------------
// File save strategies — used by ArchiveManager for copying media files
// ---------------------------------------------------------------------------

/**
 * Strategy interface for saving a value to a destination path.
 */
export interface SaveStrategy<T> {
  save(filePath: string, data: T): Promise<void>;
}

/**
 * Writes any value as pretty-printed JSON through a temporary file so that a
 * crash mid-write never leaves the destination in a partially written state.
 * Kept here for use in backup/export paths (not for live app data, which now
 * lives in SQLite).
 */
export class JsonSaveStrategy<T> implements SaveStrategy<T> {
  async save(filePath: string, data: T): Promise<void> {
    const tmpPath = `${filePath}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(data, null, 2));
    await fs.rename(tmpPath, filePath);
  }
}

/**
 * Source descriptor for the {@link FileSaveStrategy}.
 */
export interface FileSaveSource {
  kind: "path" | "buffer";
  source: string | Buffer | Uint8Array | ArrayBuffer;
}

/**
 * Copies a file from an existing path or writes a raw buffer to disk.
 */
export class FileSaveStrategy implements SaveStrategy<FileSaveSource> {
  async save(destPath: string, data: FileSaveSource): Promise<void> {
    if (data.kind === "path") {
      await fs.copyFile(data.source as string, destPath);
    } else {
      const source = data.source as Buffer | Uint8Array | ArrayBuffer;
      await fs.writeFile(
        destPath,
        source instanceof ArrayBuffer ? Buffer.from(source) : source,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// FolioStorage — thin singleton used by ArchiveManager for file operations
// ---------------------------------------------------------------------------

/**
 * Handles filesystem-level file copy and buffer write operations.
 * Metadata persistence (items, tags, canvases, projects) is now owned by
 * {@link FolioDB} in `database.ts`.
 */
export class FolioStorage {
  private static instance: FolioStorage;
  private readonly fileStrategy = new FileSaveStrategy();

  private constructor() {
    // Enforces singleton construction through getInstance.
  }

  public static getInstance(): FolioStorage {
    if (!FolioStorage.instance) {
      FolioStorage.instance = new FolioStorage();
    }
    return FolioStorage.instance;
  }

  async saveFile(destPath: string, source: FileSaveSource): Promise<void> {
    await this.fileStrategy.save(destPath, source);
  }
}
