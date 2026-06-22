import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SettingsStore } from "./settings.store";
import { StorageLocationManager } from "./storageLocation.manager";
import {
  getDocumentsFolioDir,
  getICloudFolioDir,
} from "./storageLocation.helpers";
import { getICloudDriveRoot } from "./backup.helpers";

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function seedFolio(root: string): Promise<void> {
  await fs.mkdir(path.join(root, ".folio", "thumbs"), { recursive: true });
  await fs.mkdir(path.join(root, "projects", "demo"), { recursive: true });
  await fs.writeFile(
    path.join(root, ".folio", "folio.json"),
    JSON.stringify({ version: 1, items: [] }),
  );
  await fs.writeFile(path.join(root, "projects", "demo", "art.png"), "art");
}

describe("StorageLocationManager", () => {
  let homeDir: string;
  let settingsStore: SettingsStore;
  let manager: StorageLocationManager;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "folio-switch-home-"));
    settingsStore = new SettingsStore(
      path.join(homeDir, "folio-settings.json"),
    );
    manager = new StorageLocationManager(homeDir, settingsStore);
    await fs.mkdir(getICloudDriveRoot(homeDir), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(homeDir, { recursive: true, force: true });
  });

  describe("getSettings", () => {
    it("reports iCloud availability and resolved paths", async () => {
      const settings = await manager.getSettings("documents");
      expect(settings).toEqual({
        location: "documents",
        iCloudAvailable: true,
        documentsPath: getDocumentsFolioDir(homeDir),
        iCloudPath: getICloudFolioDir(homeDir),
      });
    });

    it("reports iCloud as unavailable when the container is missing", async () => {
      await fs.rm(getICloudDriveRoot(homeDir), {
        recursive: true,
        force: true,
      });
      expect((await manager.getSettings("documents")).iCloudAvailable).toBe(
        false,
      );
    });
  });

  describe("switchTo", () => {
    it("is a no-op when the target matches the current location", async () => {
      const documentsRoot = getDocumentsFolioDir(homeDir);
      const result = await manager.switchTo(
        documentsRoot,
        "documents",
        "documents",
      );
      expect(result).toEqual({ targetRoot: documentsRoot, copied: false });
    });

    it("copies data into a fresh target and saves the choice", async () => {
      const documentsRoot = getDocumentsFolioDir(homeDir);
      await seedFolio(documentsRoot);

      const result = await manager.switchTo(
        documentsRoot,
        "documents",
        "icloud",
      );

      const iCloudRoot = getICloudFolioDir(homeDir);
      expect(result).toEqual({ targetRoot: iCloudRoot, copied: true });
      expect(
        await pathExists(path.join(iCloudRoot, "projects", "demo", "art.png")),
      ).toBe(true);
      // Original folder is left in place as a safety copy.
      expect(await pathExists(documentsRoot)).toBe(true);
      expect(await settingsStore.readLocation()).toBe("icloud");
    });

    it("adopts an existing target without overwriting its data", async () => {
      const documentsRoot = getDocumentsFolioDir(homeDir);
      const iCloudRoot = getICloudFolioDir(homeDir);
      await seedFolio(documentsRoot);
      await seedFolio(iCloudRoot);
      await fs.writeFile(
        path.join(iCloudRoot, "projects", "demo", "art.png"),
        "icloud-art",
      );

      const result = await manager.switchTo(
        documentsRoot,
        "documents",
        "icloud",
      );

      expect(result).toEqual({ targetRoot: iCloudRoot, copied: false });
      expect(
        await fs.readFile(
          path.join(iCloudRoot, "projects", "demo", "art.png"),
          "utf-8",
        ),
      ).toBe("icloud-art");
      expect(await settingsStore.readLocation()).toBe("icloud");
    });

    it("throws when switching to iCloud while it is unavailable", async () => {
      await fs.rm(getICloudDriveRoot(homeDir), {
        recursive: true,
        force: true,
      });
      const documentsRoot = getDocumentsFolioDir(homeDir);
      await seedFolio(documentsRoot);

      await expect(
        manager.switchTo(documentsRoot, "documents", "icloud"),
      ).rejects.toThrow(/iCloud Drive/);
      expect(await settingsStore.readLocation()).toBe("documents");
    });
  });
});
