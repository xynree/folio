import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BackupManager } from "./backup.manager";
import { getICloudBackupDir } from "./backup.helpers";

const ICLOUD_UNAVAILABLE_MESSAGE =
  "iCloud Drive isn't available right now. Turn on iCloud Drive to back up there.";

function makeManager(folioRoot: string, homeDir: string): BackupManager {
  return new BackupManager(
    folioRoot,
    getICloudBackupDir(homeDir),
    homeDir,
    ICLOUD_UNAVAILABLE_MESSAGE,
  );
}

async function readFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, "utf-8");
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

describe("BackupManager", () => {
  let homeDir: string;
  let folioRoot: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "folio-backup-home-"));
    folioRoot = path.join(homeDir, "Documents", "Folio");

    // Seed a realistic Folio folder: metadata, media, and a regenerable thumb cache.
    await fs.mkdir(path.join(folioRoot, ".folio", "thumbs"), {
      recursive: true,
    });
    await fs.mkdir(path.join(folioRoot, "projects", "demo", "images"), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(folioRoot, ".folio", "folio.json"),
      JSON.stringify({ version: 1, items: [] }),
    );
    await fs.writeFile(
      path.join(folioRoot, ".folio", "thumbs", "cached.png"),
      "thumb",
    );
    await fs.writeFile(
      path.join(folioRoot, "projects", "demo", "images", "art.png"),
      "art",
    );

    // iCloud Drive container present by default.
    await fs.mkdir(
      path.join(homeDir, "Library", "Mobile Documents", "com~apple~CloudDocs"),
      { recursive: true },
    );
  });

  afterEach(async () => {
    await fs.rm(homeDir, { recursive: true, force: true });
  });

  it("reports availability and no prior backup before the first backup", async () => {
    const manager = makeManager(folioRoot, homeDir);
    const status = await manager.getStatus();

    expect(status.available).toBe(true);
    expect(status.backupPath).toBe(getICloudBackupDir(homeDir));
    expect(status.lastBackupAt).toBeNull();
  });

  it("reports the target as unavailable when the container is missing", async () => {
    await fs.rm(
      path.join(homeDir, "Library", "Mobile Documents", "com~apple~CloudDocs"),
      { recursive: true, force: true },
    );
    const manager = makeManager(folioRoot, homeDir);

    expect((await manager.getStatus()).available).toBe(false);
  });

  it("copies media and metadata into iCloud but skips the thumbnail cache", async () => {
    const manager = makeManager(folioRoot, homeDir);
    const result = await manager.backup();

    const backupDir = getICloudBackupDir(homeDir);
    expect(result.backupPath).toBe(backupDir);
    expect(
      await readFile(path.join(backupDir, ".folio", "folio.json")),
    ).toContain("version");
    expect(
      await readFile(
        path.join(backupDir, "projects", "demo", "images", "art.png"),
      ),
    ).toBe("art");
    expect(
      await pathExists(path.join(backupDir, ".folio", "thumbs", "cached.png")),
    ).toBe(false);

    const status = await manager.getStatus();
    expect(status.lastBackupAt).toBe(result.createdAt);
    expect(await pathExists(`${backupDir}.tmp`)).toBe(false);
  });

  it("overwrites a previous backup so stale files do not linger", async () => {
    const manager = makeManager(folioRoot, homeDir);
    const backupDir = getICloudBackupDir(homeDir);

    await manager.backup();
    await fs.rm(path.join(folioRoot, "projects", "demo", "images", "art.png"));
    await fs.writeFile(
      path.join(folioRoot, "projects", "demo", "images", "fresh.png"),
      "fresh",
    );
    await manager.backup();

    expect(
      await pathExists(
        path.join(backupDir, "projects", "demo", "images", "art.png"),
      ),
    ).toBe(false);
    expect(
      await readFile(
        path.join(backupDir, "projects", "demo", "images", "fresh.png"),
      ),
    ).toBe("fresh");
  });

  it("throws a clear error when iCloud Drive is unavailable during backup", async () => {
    await fs.rm(
      path.join(homeDir, "Library", "Mobile Documents", "com~apple~CloudDocs"),
      { recursive: true, force: true },
    );
    const manager = makeManager(folioRoot, homeDir);

    await expect(manager.backup()).rejects.toThrow(/iCloud Drive/);
  });

  it("restores a backup into a fresh local folder without the manifest", async () => {
    const manager = makeManager(folioRoot, homeDir);
    await manager.backup();

    const result = await manager.restore();

    expect(
      result.restoredPath.startsWith(path.join(homeDir, "Documents")),
    ).toBe(true);
    expect(
      await readFile(
        path.join(result.restoredPath, "projects", "demo", "images", "art.png"),
      ),
    ).toBe("art");
    expect(
      await pathExists(path.join(result.restoredPath, "backup-info.json")),
    ).toBe(false);
    // The live folder is left untouched by a restore.
    expect(await pathExists(folioRoot)).toBe(true);
  });

  it("throws when restoring before any backup exists", async () => {
    const manager = makeManager(folioRoot, homeDir);
    await expect(manager.restore()).rejects.toThrow(/No Folio backup/);
  });
});
