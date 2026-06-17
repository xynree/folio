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
}

/** Supported media types in the archive */
export type ItemType = "sketch" | "ref" | "music" | "anim" | "text" | "other";

export type ItemStage =
  | "reference"
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
  folderPath: string;
  imageIds: string[];
  workItemIds: string[];
  boardIds: string[];
  reviews: ProjectReviewDocument[];
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
