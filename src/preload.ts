import { contextBridge, ipcRenderer } from "electron";
import type { FolioData, FolioItem, Canvas, Tag, ImportSource } from "./types";

const folioApi = {
  // Load the full data state from disk (called once on mount)
  getData: (): Promise<FolioData> => ipcRenderer.invoke("folio:get-data"),

  // Granular save methods — each writes only its own file
  saveItems: (items: FolioItem[]): Promise<void> =>
    ipcRenderer.invoke("folio:save-items", items),

  saveCanvases: (canvases: Canvas[]): Promise<void> =>
    ipcRenderer.invoke("folio:save-canvases", canvases),

  saveTags: (tags: Tag[]): Promise<void> =>
    ipcRenderer.invoke("folio:save-tags", tags),

  // Import files into the archive (returns created FolioItems)
  importItems: (sources: ImportSource[]): Promise<FolioItem[]> =>
    ipcRenderer.invoke("folio:import-items", sources),

  // Copy reference images into a specific canvas's reference folder
  importReferences: (canvasId: string, sources: ImportSource[]): Promise<string[]> =>
    ipcRenderer.invoke("folio:import-references", canvasId, sources),

  // Events: main → renderer
  onFilesAdded: (callback: (items: FolioItem[]) => void) => {
    const listener = (_: Electron.IpcRendererEvent, items: FolioItem[]) =>
      callback(items);
    ipcRenderer.on("folio:files-added", listener);
    // Return a cleanup function so callers can unsubscribe
    return () => ipcRenderer.removeListener("folio:files-added", listener);
  },
};

contextBridge.exposeInMainWorld("folio", folioApi);
