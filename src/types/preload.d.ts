import type {
  BackupResult,
  BackupStatus,
  FolioData,
  FolioItem,
  ImportSource,
  LinkMetadata,
  ProjectStatus,
  ReconciliationResult,
  RestoreResult,
  StorageLocation,
  StorageSettings,
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
  copyToProject?: (
    projectId: string,
    filePaths: string[],
  ) => Promise<FolioItem[]>;
  importToProject?: (projectId: string) => Promise<FolioItem[]>;
  importSourcesToProject?: (
    projectId: string,
    sources: ImportSource[],
  ) => Promise<FolioItem[]>;
  setProjectWorkItems: (
    projectId: string,
    workItemIds: string[],
  ) => Promise<FolioData>;
  deleteItems: (itemIds: string[]) => Promise<FolioData>;
  openFileDialog: () => Promise<string[]>;
  ensureThumbnails: (itemIds: string[]) => Promise<ThumbnailUrls>;
  getFileDataUrl: (filePath: string) => Promise<string>;
  getReconciliationResult: () => Promise<ReconciliationResult>;
  openInFinder: (filePath: string) => Promise<void>;
  fetchLinkMetadata: (url: string) => Promise<LinkMetadata>;
  getBackupStatus: () => Promise<BackupStatus>;
  backupToICloud: () => Promise<BackupResult>;
  restoreFromICloud: () => Promise<RestoreResult>;
  getStorageSettings: () => Promise<StorageSettings>;
  setStorageLocation: (location: StorageLocation) => Promise<void>;
  getPathForFile: (file: File) => string;
  /** Subscribe to files-added events pushed from the main process. Returns an unsubscribe function. */
  onFilesAdded: (callback: (items: FolioItem[]) => void) => () => void;
}

declare global {
  interface Window {
    folio: FolioApi;
  }
}
