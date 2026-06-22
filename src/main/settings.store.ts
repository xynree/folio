import fs from "node:fs/promises";
import type { StorageLocation } from "../types";
import { normalizeStorageLocation } from "./storageLocation.helpers";

interface PersistedSettings {
  storageLocation: StorageLocation;
}

/**
 * Persists the small amount of app configuration that must live outside the Folio folder, since the
 * Folio folder's own location is one of the things being configured. Backed by a single JSON file in
 * Electron's userData directory and written atomically.
 */
export class SettingsStore {
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async readLocation(): Promise<StorageLocation> {
    try {
      const raw = await fs.readFile(this.filePath, "utf-8");
      const parsed = JSON.parse(raw) as Partial<PersistedSettings>;
      return normalizeStorageLocation(parsed.storageLocation);
    } catch {
      return normalizeStorageLocation(undefined);
    }
  }

  async writeLocation(location: StorageLocation): Promise<void> {
    const payload: PersistedSettings = { storageLocation: location };
    const tmpPath = `${this.filePath}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(payload, null, 2));
    await fs.rename(tmpPath, this.filePath);
  }
}
