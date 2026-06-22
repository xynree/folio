import path from "node:path";

/** Folder name used for the single overwriting backup inside iCloud Drive. */
export const ICLOUD_BACKUP_FOLDER_NAME = "Folio Backup";

/** File written at the root of a backup describing when and how it was created. */
export const BACKUP_MANIFEST_NAME = "backup-info.json";

export interface BackupManifest {
  app: "Folio";
  createdAt: string;
  source: string;
}

/**
 * Absolute path to the user's iCloud Drive container on macOS. The folder only exists when iCloud
 * Drive is enabled, so callers must verify availability before relying on it.
 */
export function getICloudDriveRoot(homeDir: string): string {
  return path.join(
    homeDir,
    "Library",
    "Mobile Documents",
    "com~apple~CloudDocs",
  );
}

/** Absolute path of the Folio backup folder inside iCloud Drive. */
export function getICloudBackupDir(homeDir: string): string {
  return path.join(getICloudDriveRoot(homeDir), ICLOUD_BACKUP_FOLDER_NAME);
}

/** Absolute path of the Folio backup folder inside the local Documents folder. */
export function getDocumentsBackupDir(homeDir: string): string {
  return path.join(homeDir, "Documents", ICLOUD_BACKUP_FOLDER_NAME);
}

/**
 * Formats a date as "YYYY-MM-DD HH-MM-SS" in local time. Used for restore folder names and other
 * filesystem-safe timestamps (no colons, which are reserved on some platforms).
 */
export function formatBackupTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const datePart = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}`;
  const timePart = `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(
    date.getSeconds(),
  )}`;
  return `${datePart} ${timePart}`;
}

/**
 * Builds the destination folder for a non-destructive restore, placed next to the live Folio folder
 * in ~/Documents so the user can review it in Finder before replacing anything.
 */
export function getRestoreTargetDir(homeDir: string, date: Date): string {
  return path.join(
    homeDir,
    "Documents",
    `Folio Restored ${formatBackupTimestamp(date)}`,
  );
}
