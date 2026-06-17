import { contextBridge, ipcRenderer, webUtils } from "electron";
import type {
  FolioData,
  FolioItem,
  ImportSource,
  LinkMetadata,
  ProjectStatus,
  ReconciliationResult,
  ThumbnailUrls,
} from "./types";

const folioApi = {
  getFolioData: (): Promise<FolioData> =>
    ipcRenderer.invoke("folio:get-folio-data"),

  saveFolioData: (data: FolioData): Promise<void> =>
    ipcRenderer.invoke("folio:save-folio-data", data),

  createProject: (input: {
    title: string;
    description?: string;
    status?: ProjectStatus;
  }): Promise<FolioData> => ipcRenderer.invoke("folio:create-project", input),

  copyToFolio: (filePaths: string[]): Promise<FolioItem[]> =>
    ipcRenderer.invoke("folio:copy-to-folio", filePaths),

  importToFolio: (): Promise<FolioItem[]> =>
    ipcRenderer.invoke("folio:import-to-folio"),

  copyToProject: (
    projectId: string,
    filePaths: string[],
  ): Promise<FolioItem[]> =>
    ipcRenderer.invoke("folio:copy-to-project", projectId, filePaths),

  importToProject: (projectId: string): Promise<FolioItem[]> =>
    ipcRenderer.invoke("folio:import-to-project", projectId),

  importSourcesToProject: (
    projectId: string,
    sources: ImportSource[],
  ): Promise<FolioItem[]> =>
    ipcRenderer.invoke("folio:import-sources-to-project", projectId, sources),

  setProjectWorkItems: (
    projectId: string,
    workItemIds: string[],
  ): Promise<FolioData> =>
    ipcRenderer.invoke("folio:set-project-work-items", projectId, workItemIds),

  deleteItems: (itemIds: string[]): Promise<FolioData> =>
    ipcRenderer.invoke("folio:delete-items", itemIds),

  openFileDialog: (): Promise<string[]> =>
    ipcRenderer.invoke("folio:open-file-dialog"),

  ensureThumbnails: (itemIds: string[]): Promise<ThumbnailUrls> =>
    ipcRenderer.invoke("folio:ensure-thumbnails", itemIds),

  getFileDataUrl: (filePath: string): Promise<string> =>
    ipcRenderer.invoke("folio:get-file-data-url", filePath),

  getReconciliationResult: (): Promise<ReconciliationResult> =>
    ipcRenderer.invoke("folio:get-reconciliation-result"),

  openInFinder: (filePath: string): Promise<void> =>
    ipcRenderer.invoke("folio:open-in-finder", filePath),

  fetchLinkMetadata: (url: string): Promise<LinkMetadata> =>
    ipcRenderer.invoke("folio:fetch-link-metadata", url),

  getPathForFile: (file: File): string => webUtils.getPathForFile(file),

  onFilesAdded: (callback: (items: FolioItem[]) => void) => {
    const listener = (_: Electron.IpcRendererEvent, items: FolioItem[]) => {
      callback(items);
    };
    ipcRenderer.on("folio:files-added", listener);
    return () => ipcRenderer.removeListener("folio:files-added", listener);
  },
};

contextBridge.exposeInMainWorld("folio", folioApi);
