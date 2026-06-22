import fs from "node:fs/promises";
import path from "node:path";
import type { BackupResult, RestoreResult } from "../types";
import {
  BACKUP_MANIFEST_NAME,
  type BackupManifest,
  getRestoreTargetDir,
} from "./backup.helpers";

const DEFAULT_UNAVAILABLE_MESSAGE =
  "The backup location isn't available right now.";
const NO_BACKUP_MESSAGE =
  "No Folio backup was found yet. Create a backup first.";

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export interface BackupManagerStatus {
  available: boolean;
  backupPath: string;
  lastBackupAt: string | null;
}

/**
 * Mirrors the live Folio folder into a backup folder and restores backups into fresh local folders.
 *
 * The backup is a single overwriting copy at `backupDir`. The regenerable thumbnail cache is skipped
 * to keep backups lean. Writes go through a temporary folder and an atomic rename so an interrupted
 * backup never clobbers the previous good copy. Restores are non-destructive: the backup is copied
 * into a new timestamped folder under ~/Documents for the user to review.
 *
 * The backup target is reachable only when its parent folder exists; for an iCloud target the parent
 * is the iCloud Drive container, so a Mac with iCloud Drive off reports the target as unavailable.
 */
export class BackupManager {
  private readonly sourceRoot: string;
  private readonly backupDir: string;
  private readonly homeDir: string;
  private readonly unavailableMessage: string;
  private readonly thumbsDir: string;

  constructor(
    sourceRoot: string,
    backupDir: string,
    homeDir: string,
    unavailableMessage: string = DEFAULT_UNAVAILABLE_MESSAGE,
  ) {
    this.sourceRoot = sourceRoot;
    this.backupDir = backupDir;
    this.homeDir = homeDir;
    this.unavailableMessage = unavailableMessage;
    this.thumbsDir = path.join(sourceRoot, ".folio", "thumbs");
  }

  async getStatus(): Promise<BackupManagerStatus> {
    return {
      available: await this.isTargetAvailable(),
      backupPath: this.backupDir,
      lastBackupAt: await this.readLastBackupAt(),
    };
  }

  async backup(): Promise<BackupResult> {
    if (!(await this.isTargetAvailable())) {
      throw new Error(this.unavailableMessage);
    }

    const createdAt = new Date().toISOString();
    const stagingDir = `${this.backupDir}.tmp`;

    await fs.rm(stagingDir, { recursive: true, force: true });
    await fs.cp(this.sourceRoot, stagingDir, {
      recursive: true,
      filter: (source) => !this.isExcludedFromBackup(source),
    });

    const manifest: BackupManifest = {
      app: "Folio",
      createdAt,
      source: this.sourceRoot,
    };
    await fs.writeFile(
      path.join(stagingDir, BACKUP_MANIFEST_NAME),
      JSON.stringify(manifest, null, 2),
    );

    await fs.rm(this.backupDir, { recursive: true, force: true });
    await fs.rename(stagingDir, this.backupDir);

    return { backupPath: this.backupDir, createdAt };
  }

  async restore(): Promise<RestoreResult> {
    if (!(await pathExists(this.backupDir))) {
      throw new Error(NO_BACKUP_MESSAGE);
    }

    const restoredAt = new Date().toISOString();
    const restoredPath = await this.resolveUniqueRestorePath(new Date());

    await fs.cp(this.backupDir, restoredPath, {
      recursive: true,
      filter: (source) => path.basename(source) !== BACKUP_MANIFEST_NAME,
    });

    return { restoredPath, restoredAt };
  }

  private isTargetAvailable(): Promise<boolean> {
    return pathExists(path.dirname(this.backupDir));
  }

  private isExcludedFromBackup(source: string): boolean {
    const resolved = path.resolve(source);
    if (resolved === this.thumbsDir) return true;
    if (resolved.startsWith(`${this.thumbsDir}${path.sep}`)) return true;
    return path.basename(resolved).endsWith(".tmp");
  }

  private async resolveUniqueRestorePath(date: Date): Promise<string> {
    const basePath = getRestoreTargetDir(this.homeDir, date);
    if (!(await pathExists(basePath))) return basePath;

    for (let suffix = 2; suffix < 1000; suffix += 1) {
      const candidate = `${basePath} (${suffix})`;
      if (!(await pathExists(candidate))) return candidate;
    }
    throw new Error("Could not find an available restore folder name.");
  }

  private async readLastBackupAt(): Promise<string | null> {
    try {
      const raw = await fs.readFile(
        path.join(this.backupDir, BACKUP_MANIFEST_NAME),
        "utf-8",
      );
      const manifest = JSON.parse(raw) as Partial<BackupManifest>;
      return typeof manifest.createdAt === "string" ? manifest.createdAt : null;
    } catch {
      return null;
    }
  }
}
