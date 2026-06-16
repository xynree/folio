import { contextBridge, ipcRenderer, webUtils } from "electron";
import type {
  CanvasReference,
  FolioData,
  FolioItem,
  ReconciliationResult,
  ThumbnailUrls,
} from "./types";

const folioApi = {
  getFolioData: (): Promise<FolioData> =>
    ipcRenderer.invoke("folio:get-folio-data"),

  saveFolioData: (data: FolioData): Promise<void> =>
    ipcRenderer.invoke("folio:save-folio-data", data),

  copyToFolio: (filePaths: string[]): Promise<FolioItem[]> =>
    ipcRenderer.invoke("folio:copy-to-folio", filePaths),

  importToFolio: (): Promise<FolioItem[]> =>
    ipcRenderer.invoke("folio:import-to-folio"),

  copyReference: (
    canvasId: string,
    filePaths: string[],
  ): Promise<CanvasReference[]> =>
    ipcRenderer.invoke("folio:copy-reference", canvasId, filePaths),

  deleteItems: (itemIds: string[]): Promise<FolioData> =>
    ipcRenderer.invoke("folio:delete-items", itemIds),

  openFileDialog: (): Promise<string[]> =>
    ipcRenderer.invoke("folio:open-file-dialog"),

  ensureThumbnails: (itemIds: string[]): Promise<ThumbnailUrls> =>
    ipcRenderer.invoke("folio:ensure-thumbnails", itemIds),

  ensureReferenceThumbnail: (
    referenceId: string,
    filePath: string,
  ): Promise<string> =>
    ipcRenderer.invoke("folio:ensure-reference-thumbnail", referenceId, filePath),

  getFileDataUrl: (filePath: string): Promise<string> =>
    ipcRenderer.invoke("folio:get-file-data-url", filePath),

  getReconciliationResult: (): Promise<ReconciliationResult> =>
    ipcRenderer.invoke("folio:get-reconciliation-result"),

  openInFinder: (filePath: string): Promise<void> =>
    ipcRenderer.invoke("folio:open-in-finder", filePath),

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
