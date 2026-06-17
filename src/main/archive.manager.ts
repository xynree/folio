import { nativeImage } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import {
  computeHash,
  exists,
  inferItemType,
  sanitizeFileBaseName,
} from "../helpers";
import { SCHEMA_VERSION } from "../constants";
import type {
  CanvasReference,
  FolioItem,
  ImportSource,
  ItemType,
  ThumbnailUrls,
} from "../types";
import {
  normalizeArchiveItemType,
  resolveImportSourceMeta,
} from "./archive.helpers";
import {
  readImageDimensionsForFile,
  type MediaDimensions,
} from "./media.helpers";
import { FolioStorage } from "./storage.manager";

interface ImportResult {
  items: FolioItem[];
  changed: boolean;
}

const PLACEHOLDER_SVG_BY_TYPE: Record<ItemType, string> = {
  sketch: "Sketch",
  ref: "Reference",
  music: "Audio",
  anim: "Motion",
  text: "Text",
  other: "File",
};
const THUMBNAIL_JPEG_QUALITY = 72;
const THUMBNAIL_SIZE = 320;
const IMAGES_DIR_NAME = "images";
const REFERENCES_DIR_NAME = "references";

/**
 * ArchiveManager handles filesystem-level operations for the media archive:
 * importing files, tracking Finder changes, deduplicating by hash, and caching thumbnails.
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
    this.items = items.map((item) => ({
      ...item,
      type: normalizeArchiveItemType(item.type),
      tagIds: item.tagIds ?? [],
      description: item.description ?? "",
    }));
  }

  /**
   * Legacy import path. Main-process callers should prefer project-scoped imports.
   */
  async copyToFolio(filePaths: string[]): Promise<FolioItem[]> {
    const result = await this.importFilePaths(filePaths, {
      mode: "copy-external",
      destination: "archive",
      destDir: this.projectImagesDirectory("projects/studio-archive"),
    });
    return result.items;
  }

  /**
   * Copy files into a project's flat images folder and tag them with that project.
   */
  async copyToProject(
    projectId: string,
    projectFolderPath: string,
    filePaths: string[],
  ): Promise<FolioItem[]> {
    const result = await this.importFilePaths(filePaths, {
      mode: "copy-external",
      destination: "project",
      projectId,
      destDir: this.projectImagesDirectory(projectFolderPath),
    });
    return result.items;
  }

  /**
   * Track files that appeared directly in a project's images folder via Finder.
   */
  async trackExistingFiles(
    filePaths: string[],
    projectId?: string,
    projectFolderPath?: string,
  ): Promise<ImportResult> {
    return this.importFilePaths(filePaths, {
      mode: "register-in-place",
      destination: projectId ? "project" : "archive",
      projectId,
      destDir: projectFolderPath
        ? this.projectImagesDirectory(projectFolderPath)
        : undefined,
    });
  }

  /**
   * Legacy source-based import support for clipboard/buffer callers.
   */
  async importItems(sources: ImportSource[]): Promise<FolioItem[]> {
    const destDir = this.projectImagesDirectory("projects/studio-archive");
    await fs.mkdir(destDir, { recursive: true });
    const imported: FolioItem[] = [];

    for (const source of sources) {
      const { filename, ext } = this.resolveSourceMeta(source);
      const destPath = await this.saveToDirectory(source, filename, ext, destDir);
      const result = await this.registerArchivedFile(destPath, filename, true);

      if (result.created) {
        imported.push(result.item);
      }
      this.trackRecentlyCopied(destPath);
    }

    return imported;
  }

  async importProjectItems(
    projectId: string,
    projectFolderPath: string,
    sources: ImportSource[],
  ): Promise<FolioItem[]> {
    const destDir = this.projectImagesDirectory(projectFolderPath);
    await fs.mkdir(destDir, { recursive: true });
    const imported: FolioItem[] = [];

    for (const source of sources) {
      const { filename, ext } = this.resolveSourceMeta(source);
      const destPath = await this.saveToDirectory(source, filename, ext, destDir);
      const result = await this.registerArchivedFile(
        destPath,
        filename,
        true,
        projectId,
      );

      if (result.created || result.changed) {
        imported.push(result.item);
      }
      this.trackRecentlyCopied(destPath);
    }

    return imported;
  }

  /**
   * Resolves the filename and extension from any ImportSource.
   */
  public resolveSourceMeta(source: ImportSource): {
    filename: string;
    ext: string;
  } {
    return resolveImportSourceMeta(source);
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
    await fs.mkdir(destDir, { recursive: true });
    const sanitizedName = sanitizeFileBaseName(filename);
    const normalizedExt = ext.toLowerCase();
    let destFilename = `${sanitizedName}${normalizedExt}`;
    let destPath = path.join(destDir, destFilename);

    let counter = 2;
    while (await exists(destPath)) {
      destFilename = `${sanitizedName}_${counter}${normalizedExt}`;
      destPath = path.join(destDir, destFilename);
      counter += 1;
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

  async copyReferences(
    projectFolderPath: string,
    filePaths: string[],
  ): Promise<CanvasReference[]> {
    const destDir = this.projectReferencesDirectory(projectFolderPath);
    await fs.mkdir(destDir, { recursive: true });

    const references: CanvasReference[] = [];
    for (const filePath of filePaths) {
      const originalExt = path.extname(filePath);
      const ext = originalExt.toLowerCase();
      const filename = path.basename(filePath, originalExt);
      const destPath = await this.saveToDirectory(
        { kind: "path", filePath },
        filename,
        ext,
        destDir,
      );

      references.push({
        id: nanoid(),
        filename: path.basename(destPath),
        path: path.relative(this.folioRoot, destPath),
        ...readImageDimensionsForFile(destPath),
        x: 0,
        y: 0,
      });
    }

    return references;
  }

  public isRecentlyCopied(filePath: string): boolean {
    return this.recentlyCopied.has(path.resolve(filePath));
  }

  public isInArchiveItems(filePath: string): boolean {
    const relative = path.relative(path.join(this.folioRoot, "items"), filePath);
    return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
  }

  public isInDirectory(filePath: string, directory: string): boolean {
    const relative = path.relative(directory, filePath);
    return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
  }

  public async ensureThumbnails(itemIds: string[]): Promise<ThumbnailUrls> {
    const urls: ThumbnailUrls = {};
    let repairedMissingFlag = false;
    const itemsById = new Map(this.items.map((item) => [item.id, item]));

    for (const itemId of itemIds) {
      const item = itemsById.get(itemId);
      if (!item) continue;

      if (item.missing && (await exists(this.getAbsolutePath(item.path)))) {
        item.missing = false;
        repairedMissingFlag = true;
      }

      let thumbPath = this.getPrimaryThumbnailPath(item);
      if (!(await exists(thumbPath))) {
        thumbPath = await this.createThumbnail(item, thumbPath);
      }
      urls[item.id] = this.getThumbnailUrl(thumbPath);
    }

    if (repairedMissingFlag) {
      await this.save(SCHEMA_VERSION);
    }

    return urls;
  }

  public async ensureReferenceThumbnail(
    referenceId: string,
    relativeOrAbsolutePath: string,
  ): Promise<string> {
    const thumbPath = this.getReferenceThumbnailPath(referenceId, "jpg");
    const placeholderPath = this.getReferenceThumbnailPath(referenceId, "svg");

    if (await exists(thumbPath)) return this.getThumbnailUrl(thumbPath);

    const sourcePath = this.getAbsolutePath(relativeOrAbsolutePath);
    if (!(await exists(sourcePath))) {
      if (!(await exists(placeholderPath))) {
        await this.writeReferencePlaceholderThumbnail(placeholderPath);
      }
      return this.getThumbnailUrl(placeholderPath);
    }

    await fs.mkdir(path.dirname(thumbPath), { recursive: true });

    try {
      const thumb = await nativeImage.createThumbnailFromPath(sourcePath, {
        width: THUMBNAIL_SIZE,
        height: THUMBNAIL_SIZE,
      });

      if (thumb.isEmpty()) {
        await this.writeReferencePlaceholderThumbnail(placeholderPath);
        return this.getThumbnailUrl(placeholderPath);
      }

      await fs.writeFile(thumbPath, thumb.toJPEG(THUMBNAIL_JPEG_QUALITY));
      return this.getThumbnailUrl(thumbPath);
    } catch {
      await this.writeReferencePlaceholderThumbnail(placeholderPath);
      return this.getThumbnailUrl(placeholderPath);
    }
  }

  public async getFileDataUrl(relativeOrAbsolutePath: string): Promise<string> {
    const absolutePath = this.getAbsolutePath(relativeOrAbsolutePath);
    const relativePath = path.relative(this.folioRoot, absolutePath);
    return `folio://file/${encodeURIComponent(relativePath)}`;
  }

  public async repairMissingMediaDimensions(): Promise<boolean> {
    let changed = false;

    for (const item of this.items) {
      if (item.mediaWidth && item.mediaHeight) continue;

      const absolutePath = this.getAbsolutePath(item.path);
      if (!(await exists(absolutePath))) continue;

      changed =
        this.applyMediaDimensions(item, readImageDimensionsForFile(absolutePath))
        || changed;
    }

    return changed;
  }

  public getAbsolutePath(relativeOrAbsolutePath: string): string {
    return path.isAbsolute(relativeOrAbsolutePath)
      ? relativeOrAbsolutePath
      : path.join(this.folioRoot, relativeOrAbsolutePath);
  }

  public async migrateItemsToProjectImages(
    projectFolderById: Map<string, string>,
    fallbackProjectId?: string,
  ): Promise<boolean> {
    let changed = false;

    for (const item of this.items) {
      const projectId = item.projectId ?? fallbackProjectId;
      const projectFolderPath = projectId
        ? projectFolderById.get(projectId)
        : undefined;
      if (!projectFolderPath) continue;

      changed =
        (await this.moveItemToDirectory(
          item,
          this.projectImagesDirectory(projectFolderPath),
        )) || changed;
    }

    return changed;
  }

  /**
   * Saves the current items to disk.
   */
  async save(version: number): Promise<void> {
    await this.store.saveItems(this.dbPath, this.items, version);
  }

  private async importFilePaths(
    filePaths: string[],
    options: {
      mode: "copy-external" | "register-in-place";
      destination: "archive" | "project";
      destDir?: string;
      projectId?: string;
    },
  ): Promise<ImportResult> {
    const imported: FolioItem[] = [];
    let changed = false;

    for (const filePath of filePaths) {
      const absoluteSource = path.resolve(filePath);
      const originalSourceExt = path.extname(absoluteSource);
      const sourceExt = originalSourceExt.toLowerCase();
      const sourceFilename = path.basename(absoluteSource, originalSourceExt);
      let archivedPath = absoluteSource;
      let copied = false;

      const sourceAlreadyInDestination =
        options.destination === "project" && options.destDir
          ? this.isInDirectory(absoluteSource, options.destDir)
          : this.isInArchiveItems(absoluteSource);

      if (options.mode === "copy-external" && !sourceAlreadyInDestination) {
        const sourceHash = await computeHash(absoluteSource);
        const duplicate = this.items.find(
          (item) =>
            item.hash === sourceHash &&
            !(
              options.projectId &&
              item.projectId &&
              item.projectId !== options.projectId
            ),
        );

        if (duplicate && !duplicate.missing) {
          if (options.destination === "project" && options.destDir) {
            changed =
              (await this.moveItemToDirectory(duplicate, options.destDir)) ||
              changed;
          }
          if (options.projectId && !duplicate.projectId) {
            duplicate.projectId = options.projectId;
            changed = true;
          }
          imported.push(duplicate);
          continue;
        }

        const destDir =
          options.destDir ??
          this.projectImagesDirectory("projects/studio-archive");
        archivedPath = await this.saveToDirectory(
          { kind: "path", filePath: absoluteSource },
          sourceFilename,
          sourceExt,
          destDir,
        );
        copied = true;
        this.trackRecentlyCopied(archivedPath);
      }

      const result = await this.registerArchivedFile(
        archivedPath,
        sourceFilename,
        copied,
        options.projectId,
      );
      if (result.created || result.changed) {
        imported.push(result.item);
      }
      changed = changed || result.changed;
    }

    return { items: imported, changed };
  }

  private async registerArchivedFile(
    filePath: string,
    fallbackTitle: string,
    recentlyCopied: boolean,
    projectId?: string,
  ): Promise<{ item: FolioItem; created: boolean; changed: boolean }> {
    const absolutePath = path.resolve(filePath);
    const relativePath = path.relative(this.folioRoot, absolutePath);
    const ext = path.extname(absolutePath).toLowerCase();
    const hash = await computeHash(absolutePath);

    const pathMatch = this.items.find(
      (item) => path.resolve(this.folioRoot, item.path) === absolutePath,
    );
    if (pathMatch) {
      let changed = this.applyMediaDimensions(
        pathMatch,
        readImageDimensionsForFile(absolutePath),
      );
      if (projectId && !pathMatch.projectId) {
        pathMatch.projectId = projectId;
        changed = true;
      }
      if (pathMatch.missing) {
        pathMatch.missing = false;
        changed = true;
      }
      return { item: pathMatch, created: false, changed };
    }

    const hashMatch = this.items.find(
      (item) =>
        item.hash === hash &&
        !(projectId && item.projectId && item.projectId !== projectId),
    );
    if (hashMatch) {
      let changed = this.applyMediaDimensions(
        hashMatch,
        readImageDimensionsForFile(absolutePath),
      );
      hashMatch.path = relativePath;
      hashMatch.missing = false;
      if (projectId && !hashMatch.projectId) {
        hashMatch.projectId = projectId;
        changed = true;
      }
      return { item: hashMatch, created: false, changed: true || changed };
    }

    const item = this.buildItem(absolutePath, fallbackTitle, ext, hash, projectId);
    this.items.push(item);

    if (recentlyCopied) {
      this.trackRecentlyCopied(absolutePath);
    }

    return { item, created: true, changed: true };
  }

  private buildItem(
    destPath: string,
    filename: string,
    ext: string,
    hash: string,
    projectId?: string,
  ): FolioItem {
    return {
      id: nanoid(),
      path: path.relative(this.folioRoot, destPath),
      hash,
      type: inferItemType(ext),
      date: new Date().toISOString(),
      title: filename,
      tagIds: [],
      description: "",
      projectId,
      updatedAt: new Date().toISOString(),
      ...readImageDimensionsForFile(destPath),
      missing: false,
    };
  }

  private applyMediaDimensions(
    item: FolioItem,
    dimensions: MediaDimensions | undefined,
  ) {
    if (!dimensions) return false;
    if (
      item.mediaWidth === dimensions.mediaWidth
      && item.mediaHeight === dimensions.mediaHeight
    ) {
      return false;
    }

    item.mediaWidth = dimensions.mediaWidth;
    item.mediaHeight = dimensions.mediaHeight;
    return true;
  }

  /**
   * Adds a path to the recently-copied set and auto-removes it after 2s.
   * Prevents the file watcher from double-counting freshly imported files.
   */
  private trackRecentlyCopied(destPath: string) {
    const resolvedPath = path.resolve(destPath);
    this.recentlyCopied.add(resolvedPath);
    setTimeout(() => this.recentlyCopied.delete(resolvedPath), 2000);
  }

  private projectImagesDirectory(projectFolderPath: string): string {
    return path.join(this.folioRoot, projectFolderPath, IMAGES_DIR_NAME);
  }

  private projectReferencesDirectory(projectFolderPath: string): string {
    return path.join(this.folioRoot, projectFolderPath, REFERENCES_DIR_NAME);
  }

  private isFlatFileInDirectory(filePath: string, directory: string): boolean {
    return path.resolve(path.dirname(filePath)) === path.resolve(directory);
  }

  private async moveItemToDirectory(
    item: FolioItem,
    destDir: string,
  ): Promise<boolean> {
    const sourcePath = this.getAbsolutePath(item.path);
    if (!(await exists(sourcePath))) return false;

    if (this.isFlatFileInDirectory(sourcePath, destDir)) return false;

    const extension = path.extname(item.path);
    const preferredBaseName = sanitizeFileBaseName(
      item.title || path.basename(item.path, extension) || item.id,
    );
    const destPath = await this.moveFileToDirectory(
      sourcePath,
      destDir,
      `${preferredBaseName}${extension.toLowerCase()}`,
    );

    item.path = path.relative(this.folioRoot, destPath);
    item.missing = false;
    return true;
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
      (await exists(destPath)) &&
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

    this.trackRecentlyCopied(destPath);
    return destPath;
  }

  private async createThumbnail(
    item: FolioItem,
    thumbPath: string,
  ): Promise<string> {
    await fs.mkdir(path.dirname(thumbPath), { recursive: true });

    const sourcePath = this.getAbsolutePath(item.path);
    const sourceExists = await exists(sourcePath);

    if (!sourceExists || !["sketch", "ref", "anim"].includes(item.type)) {
      const placeholderPath = this.getPlaceholderPath(item);
      await this.writePlaceholderThumbnail(item, placeholderPath);
      return placeholderPath;
    }

    try {
      const thumb = await nativeImage.createThumbnailFromPath(sourcePath, {
        width: THUMBNAIL_SIZE,
        height: THUMBNAIL_SIZE,
      });

      if (thumb.isEmpty()) {
        const placeholderPath = this.getPlaceholderPath(item);
        await this.writePlaceholderThumbnail(item, placeholderPath);
        return placeholderPath;
      }

      await fs.writeFile(thumbPath, thumb.toJPEG(THUMBNAIL_JPEG_QUALITY));
      return thumbPath;
    } catch {
      const placeholderPath = this.getPlaceholderPath(item);
      await this.writePlaceholderThumbnail(item, placeholderPath);
      return placeholderPath;
    }
  }

  private async writePlaceholderThumbnail(item: FolioItem, thumbPath: string) {
    const label = PLACEHOLDER_SVG_BY_TYPE[item.type] ?? "File";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <rect width="400" height="400" fill="#f3efe7"/>
  <rect x="42" y="42" width="316" height="316" rx="22" fill="#fffdf8" stroke="#d7c9b4" stroke-width="2"/>
  <path d="M96 246 C128 206, 156 270, 192 224 S258 186, 304 228" fill="none" stroke="#9f6b3d" stroke-width="12" stroke-linecap="round"/>
  <text x="200" y="316" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="32" fill="#6b5a48">${label}</text>
</svg>`;
    await fs.writeFile(thumbPath, svg, "utf-8");
  }

  private async writeReferencePlaceholderThumbnail(thumbPath: string) {
    await fs.mkdir(path.dirname(thumbPath), { recursive: true });
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <rect width="400" height="400" fill="#f3efe7"/>
  <rect x="42" y="42" width="316" height="316" rx="22" fill="#fffdf8" stroke="#d7c9b4" stroke-width="2"/>
  <path d="M112 256 L176 192 L218 232 L258 184 L304 256 Z" fill="none" stroke="#9f6b3d" stroke-width="12" stroke-linejoin="round"/>
  <circle cx="150" cy="146" r="20" fill="#385d56"/>
  <text x="200" y="316" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="32" fill="#6b5a48">Reference</text>
</svg>`;
    await fs.writeFile(thumbPath, svg, "utf-8");
  }

  private getPrimaryThumbnailPath(item: FolioItem): string {
    const thumbsDir = path.join(this.folioRoot, ".folio", "thumbs");
    if (!["sketch", "ref", "anim"].includes(item.type)) {
      return path.join(thumbsDir, `${item.id}-small.svg`);
    }
    return path.join(thumbsDir, `${item.id}-small.jpg`);
  }

  private getPlaceholderPath(item: FolioItem): string {
    return path.join(this.folioRoot, ".folio", "thumbs", `${item.id}-small.svg`);
  }

  private getReferenceThumbnailPath(
    referenceId: string,
    extension: "jpg" | "svg",
  ) {
    const safeId = sanitizeFileBaseName(referenceId);
    return path.join(
      this.folioRoot,
      ".folio",
      "thumbs",
      `reference-${safeId}-small.${extension}`,
    );
  }

  private getThumbnailUrl(thumbPath: string): string {
    const filename = path.basename(thumbPath);
    return `folio://thumb/${encodeURIComponent(filename)}`;
  }

}
