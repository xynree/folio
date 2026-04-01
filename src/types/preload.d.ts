import type { FolioData, FolioItem, Canvas, Tag, ImportSource } from "./index";

export interface FolioApi {
  getData: () => Promise<FolioData>;
  saveItems: (items: FolioItem[]) => Promise<void>;
  saveCanvases: (canvases: Canvas[]) => Promise<void>;
  saveTags: (tags: Tag[]) => Promise<void>;
  importItems: (sources: ImportSource[]) => Promise<FolioItem[]>;
  importReferences: (canvasId: string, sources: ImportSource[]) => Promise<string[]>;
  /** Subscribe to files-added events pushed from the main process. Returns an unsubscribe function. */
  onFilesAdded: (callback: (items: FolioItem[]) => void) => () => void;
}

declare global {
  interface Window {
    folio: FolioApi;
  }
}
