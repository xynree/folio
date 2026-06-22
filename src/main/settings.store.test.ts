import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SettingsStore } from "./settings.store";

describe("SettingsStore", () => {
  let dir: string;
  let filePath: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "folio-settings-"));
    filePath = path.join(dir, "folio-settings.json");
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("defaults to documents when no file exists", async () => {
    const store = new SettingsStore(filePath);
    expect(await store.readLocation()).toBe("documents");
  });

  it("defaults to documents when the file is corrupt", async () => {
    await fs.writeFile(filePath, "not json");
    const store = new SettingsStore(filePath);
    expect(await store.readLocation()).toBe("documents");
  });

  it("writes and reads back a location", async () => {
    const store = new SettingsStore(filePath);
    await store.writeLocation("icloud");

    expect(await store.readLocation()).toBe("icloud");
    const onDisk = JSON.parse(await fs.readFile(filePath, "utf-8"));
    expect(onDisk).toEqual({ storageLocation: "icloud" });
  });

  it("normalizes an unexpected persisted value", async () => {
    await fs.writeFile(filePath, JSON.stringify({ storageLocation: "weird" }));
    const store = new SettingsStore(filePath);
    expect(await store.readLocation()).toBe("documents");
  });

  it("does not leave a temp file behind", async () => {
    const store = new SettingsStore(filePath);
    await store.writeLocation("documents");

    const entries = await fs.readdir(dir);
    expect(entries).toEqual(["folio-settings.json"]);
  });
});
