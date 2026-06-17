import type {
  CanvasReference,
  FolioData,
  FolioItem,
  ImportSource,
  ProjectStatus,
  ReconciliationResult,
  ThumbnailUrls,
} from "./index";

export interface FolioApi {
  getFolioData: () => Promise<FolioData>;
  saveFolioData: (data: FolioData) => Promise<void>;
  createProject: (input: {
    title: string;
    description?: string;
    status?: ProjectStatus;
  }) => Promise<FolioData>;
  copyToFolio: (filePaths: string[]) => Promise<FolioItem[]>;
  importToFolio?: () => Promise<FolioItem[]>;
  copyToProject?: (projectId: string, filePaths: string[]) => Promise<FolioItem[]>;
  importToProject?: (projectId: string) => Promise<FolioItem[]>;
  importSourcesToProject?: (
    projectId: string,
    sources: ImportSource[],
  ) => Promise<FolioItem[]>;
  setProjectWorkItems: (
    projectId: string,
    workItemIds: string[],
  ) => Promise<FolioData>;
  copyReference: (
    canvasId: string,
    filePaths: string[],
  ) => Promise<CanvasReference[]>;
  deleteItems: (itemIds: string[]) => Promise<FolioData>;
  openFileDialog: () => Promise<string[]>;
  ensureThumbnails: (itemIds: string[]) => Promise<ThumbnailUrls>;
  ensureReferenceThumbnail: (referenceId: string, filePath: string) => Promise<string>;
  getFileDataUrl: (filePath: string) => Promise<string>;
  getReconciliationResult: () => Promise<ReconciliationResult>;
  openInFinder: (filePath: string) => Promise<void>;
  getPathForFile: (file: File) => string;
  /** Subscribe to files-added events pushed from the main process. Returns an unsubscribe function. */
  onFilesAdded: (callback: (items: FolioItem[]) => void) => () => void;
}

declare global {
  interface Window {
    folio: FolioApi;
  }
}
