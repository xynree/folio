import { Canvas } from "./canvas";

/**
 * The unified data structure for the application state in memory.
 * Persisted on disk across four separate files:
 * - folio.json (version and items)
 * - tags.json (tags array)
 * - canvases.json (canvases array)
 * - projects.json (projects array)
 */
export interface FolioData {
  version: number;
  items: FolioItem[];
  canvases: Canvas[];
  tags: Tag[];
  projects: Project[];
  notes: Note[];
}

/** Supported media types in the archive */
export type ItemType = "sketch" | "music" | "anim" | "text" | "other";

export type ItemStage =
  | "sketch"
  | "wip"
  | "process"
  | "final"
  | "note"
  | "other";

export type ProjectStatus = "active" | "paused" | "done" | "archived";

export interface Project {
  id: string;
  title: string;
  description?: string;
  status?: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  workUpdatedAt?: string;
  folderPath: string;
  imageIds: string[];
  workItemIds: string[];
  boardIds: string[];
  reviews: ProjectReviewDocument[];
}

/** A standalone Markdown note attached to a project. Content lives at `path` on disk. */
export interface Note {
  id: string;
  title: string;
  /** Path relative to the Folio root, e.g. "projects/my-project/notes/note_abc.md" */
  path: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectReviewDocument {
  id: string;
  title: string;
  markdown: string;
  workItemIds: string[];
  createdAt: string;
  updatedAt: string;
}

/** A single metadata entry for a file in the archive */
export interface FolioItem {
  id: string;
  path: string; // Path relative to ~/Folio/
  hash: string; // Fingerprint for reconciliation
  type: ItemType;
  date: string; // Import date (ISO string)
  title: string;
  description: string;
  tagIds: string[]; // References to Tag.id
  mediaWidth?: number; // Natural source image width when known
  mediaHeight?: number; // Natural source image height when known
  projectId?: string; // Owning project for project-imported or migrated items
  stage?: ItemStage; // Gentle process stage; Works membership remains project-level
  sourceCreatedAt?: string;
  updatedAt?: string;
  missing?: boolean; // True if file is missing from disk
}

/** User-defined label for filtering and organization */
export interface Tag {
  id: string;
  text: string;
}

export interface ReconciliationFile {
  path: string;
  absolutePath: string;
  hash: string;
}

export interface ReconciliationResult {
  scannedAt: string;
  untrackedFiles: ReconciliationFile[];
  missingItems: FolioItem[];
  relocatedItems: FolioItem[];
}

export type ThumbnailUrls = Record<string, string>;

/** Where the live Folio folder (the source of truth) is stored. */
export type StorageLocation = "documents" | "icloud";

/** Current storage-location configuration surfaced to the renderer. */
export interface StorageSettings {
  /** The active source of truth. */
  location: StorageLocation;
  /** True when an iCloud Drive folder is present on this Mac. */
  iCloudAvailable: boolean;
  /** Absolute path of the Folio folder when stored in Documents. */
  documentsPath: string;
  /** Absolute path of the Folio folder when stored in iCloud Drive. */
  iCloudPath: string;
}

/** Snapshot of the iCloud Drive backup state surfaced to the renderer. */
export interface BackupStatus {
  /** True when the backup target folder can be written to right now. */
  available: boolean;
  /** Where backups are written, expressed as a storage location. */
  target: StorageLocation;
  /** Absolute path of the backup folder, regardless of whether it exists yet. */
  backupPath: string;
  /** ISO timestamp of the most recent backup, or null when no backup exists. */
  lastBackupAt: string | null;
}

/** Result of writing a backup. */
export interface BackupResult {
  backupPath: string;
  createdAt: string;
}

/** Result of restoring a backup into a fresh local folder. */
export interface RestoreResult {
  restoredPath: string;
  restoredAt: string;
}
