import { Canvas } from "./canvas";

/**
 * The root data structure for the entire application.
 * Persisted as folio.json.
 */
export interface FolioData {
  version: number; // Schema version for migrations
  items: FolioItem[]; // All items in the archive
  canvases: Canvas[]; // Spatial canvases
  tags: Tag[]; // Globally defined tags
}

/** Supported media types in the archive */
export type ItemType = "image" | "audio" | "video" | "text" | "other";

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
  missing?: boolean; // True if file is missing from disk
}

/** User-defined label for filtering and organization */
export interface Tag {
  id: string;
  text: string;
}
