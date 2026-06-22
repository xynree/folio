import path from "node:path";
import type { StorageLocation } from "../types";
import {
  getDocumentsBackupDir,
  getICloudBackupDir,
  getICloudDriveRoot,
} from "./backup.helpers";

/** File (in Electron's userData dir) that records the chosen storage location. */
export const STORAGE_SETTINGS_FILE_NAME = "folio-settings.json";

/** All valid storage locations, in display order. */
export const STORAGE_LOCATIONS: readonly StorageLocation[] = [
  "documents",
  "icloud",
];

/** The location used when no preference has been saved yet. */
export const DEFAULT_STORAGE_LOCATION: StorageLocation = "documents";

/** Coerces an unknown persisted value into a valid storage location. */
export function normalizeStorageLocation(value: unknown): StorageLocation {
  return value === "icloud" ? "icloud" : DEFAULT_STORAGE_LOCATION;
}

/** Absolute path of the Folio folder when stored in the local Documents folder. */
export function getDocumentsFolioDir(homeDir: string): string {
  return path.join(homeDir, "Documents", "Folio");
}

/** Absolute path of the Folio folder when stored in iCloud Drive. */
export function getICloudFolioDir(homeDir: string): string {
  return path.join(getICloudDriveRoot(homeDir), "Folio");
}

/** Resolves the live Folio root for a storage location. */
export function getStorageRootForLocation(
  location: StorageLocation,
  homeDir: string,
): string {
  return location === "icloud"
    ? getICloudFolioDir(homeDir)
    : getDocumentsFolioDir(homeDir);
}

/**
 * Resolves the backup folder for a storage location. Backups are written to the opposite location so
 * a copy always lives off the live volume: a Documents source backs up to iCloud Drive, and an
 * iCloud source backs up to Documents.
 */
export function getBackupDirForLocation(
  location: StorageLocation,
  homeDir: string,
): string {
  return location === "icloud"
    ? getDocumentsBackupDir(homeDir)
    : getICloudBackupDir(homeDir);
}

/** Human-readable label for a storage location, used in UI copy. */
export function describeStorageLocation(location: StorageLocation): string {
  return location === "icloud" ? "iCloud Drive" : "Documents";
}
