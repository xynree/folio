import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_STORAGE_LOCATION,
  describeStorageLocation,
  getBackupDirForLocation,
  getDocumentsFolioDir,
  getICloudFolioDir,
  getStorageRootForLocation,
  normalizeStorageLocation,
} from "./storageLocation.helpers";

const HOME = "/Users/test";

describe("normalizeStorageLocation", () => {
  it("keeps a valid icloud value", () => {
    expect(normalizeStorageLocation("icloud")).toBe("icloud");
  });

  it("falls back to the default for anything else", () => {
    expect(normalizeStorageLocation("documents")).toBe(
      DEFAULT_STORAGE_LOCATION,
    );
    expect(normalizeStorageLocation(undefined)).toBe(DEFAULT_STORAGE_LOCATION);
    expect(normalizeStorageLocation("nonsense")).toBe(DEFAULT_STORAGE_LOCATION);
    expect(normalizeStorageLocation(42)).toBe(DEFAULT_STORAGE_LOCATION);
  });
});

describe("storage root resolution", () => {
  it("resolves the Documents folio folder", () => {
    expect(getDocumentsFolioDir(HOME)).toBe(
      path.join(HOME, "Documents", "Folio"),
    );
    expect(getStorageRootForLocation("documents", HOME)).toBe(
      getDocumentsFolioDir(HOME),
    );
  });

  it("resolves the iCloud folio folder", () => {
    const expected = path.join(
      HOME,
      "Library",
      "Mobile Documents",
      "com~apple~CloudDocs",
      "Folio",
    );
    expect(getICloudFolioDir(HOME)).toBe(expected);
    expect(getStorageRootForLocation("icloud", HOME)).toBe(expected);
  });
});

describe("getBackupDirForLocation", () => {
  it("backs a Documents source up to iCloud Drive", () => {
    expect(getBackupDirForLocation("documents", HOME)).toBe(
      path.join(
        HOME,
        "Library",
        "Mobile Documents",
        "com~apple~CloudDocs",
        "Folio Backup",
      ),
    );
  });

  it("backs an iCloud source up to Documents", () => {
    expect(getBackupDirForLocation("icloud", HOME)).toBe(
      path.join(HOME, "Documents", "Folio Backup"),
    );
  });
});

describe("describeStorageLocation", () => {
  it("labels each location", () => {
    expect(describeStorageLocation("documents")).toBe("Documents");
    expect(describeStorageLocation("icloud")).toBe("iCloud Drive");
  });
});
