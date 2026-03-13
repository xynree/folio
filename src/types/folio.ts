import { Canvas } from "./canvas";

/**
 * The unified data structure for the application state in memory.
 * Persisted on disk across three separate files:
 * - folio.json (version and items)
 * - tags.json (tags array)
 * - canvases.json (canvases array)
 */
export interface FolioData {
  version: number;
  items: FolioItem[];
  canvases: Canvas[];
  tags: Tag[];
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
