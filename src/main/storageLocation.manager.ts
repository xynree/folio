import fs from "node:fs/promises";
import path from "node:path";
import type { StorageLocation, StorageSettings } from "../types";
import { getICloudDriveRoot } from "./backup.helpers";
import { SettingsStore } from "./settings.store";
import {
  getDocumentsFolioDir,
  getICloudFolioDir,
  getStorageRootForLocation,
} from "./storageLocation.helpers";

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export interface SwitchResult {
  /** The folder now acting as the source of truth. */
  targetRoot: string;
  /** True when existing data was copied into a fresh target folder. */
  copied: boolean;
}

/**
 * Moves the Folio source of truth between Documents and iCloud Drive.
 *
 * Switching is non-destructive: when the destination has no Folio data yet, the current folder is
 * copied there; when the destination already holds Folio data, it is adopted as-is. The previous
 * folder is always left in place as a safety copy. Callers are responsible for relaunching the app
 * so every manager re-resolves against the new root.
 */
export class StorageLocationManager {
  private readonly homeDir: string;
  private readonly settingsStore: SettingsStore;

  constructor(homeDir: string, settingsStore: SettingsStore) {
    this.homeDir = homeDir;
    this.settingsStore = settingsStore;
  }

  async getSettings(
    currentLocation: StorageLocation,
  ): Promise<StorageSettings> {
    return {
      location: currentLocation,
      iCloudAvailable: await pathExists(getICloudDriveRoot(this.homeDir)),
      documentsPath: getDocumentsFolioDir(this.homeDir),
      iCloudPath: getICloudFolioDir(this.homeDir),
    };
  }

  async switchTo(
    currentRoot: string,
    currentLocation: StorageLocation,
    targetLocation: StorageLocation,
  ): Promise<SwitchResult> {
    const targetRoot = getStorageRootForLocation(targetLocation, this.homeDir);

    if (targetLocation === currentLocation) {
      return { targetRoot, copied: false };
    }

    if (
      targetLocation === "icloud" &&
      !(await pathExists(getICloudDriveRoot(this.homeDir)))
    ) {
      throw new Error(
        "iCloud Drive isn't available on this Mac. Turn on iCloud Drive in System Settings and try again.",
      );
    }

    const copied = await this.copyIntoFreshTarget(currentRoot, targetRoot);
    await this.settingsStore.writeLocation(targetLocation);
    return { targetRoot, copied };
  }

  /**
   * Copies the live folder into the destination only when the destination has no Folio data yet.
   * Returns true when a copy happened, false when an existing destination was adopted untouched.
   */
  private async copyIntoFreshTarget(
    currentRoot: string,
    targetRoot: string,
  ): Promise<boolean> {
    const targetHasData = await pathExists(
      path.join(targetRoot, ".folio", "folio.json"),
    );
    if (targetHasData) return false;

    if (!(await pathExists(currentRoot))) return false;

    await fs.mkdir(path.dirname(targetRoot), { recursive: true });
    await fs.cp(currentRoot, targetRoot, {
      recursive: true,
      filter: (source) => !path.basename(source).endsWith(".tmp"),
    });
    return true;
  }
}
