import path from "node:path";
import {
  formatBackupTimestamp,
  getICloudBackupDir,
  getICloudDriveRoot,
  getRestoreTargetDir,
} from "./backup.helpers";

describe("getICloudDriveRoot", () => {
  it("points at the macOS iCloud Drive container", () => {
    expect(getICloudDriveRoot("/Users/sam")).toBe(
      path.join(
        "/Users/sam",
        "Library",
        "Mobile Documents",
        "com~apple~CloudDocs",
      ),
    );
  });
});

describe("getICloudBackupDir", () => {
  it("nests the Folio backup folder inside iCloud Drive", () => {
    expect(getICloudBackupDir("/Users/sam")).toBe(
      path.join(getICloudDriveRoot("/Users/sam"), "Folio Backup"),
    );
  });
});

describe("formatBackupTimestamp", () => {
  it("formats local date and time without filesystem-unsafe characters", () => {
    const date = new Date(2026, 5, 20, 9, 4, 7);
    expect(formatBackupTimestamp(date)).toBe("2026-06-20 09-04-07");
  });
});

describe("getRestoreTargetDir", () => {
  it("creates a timestamped restore folder next to the live Folio folder", () => {
    const date = new Date(2026, 5, 20, 14, 30, 0);
    expect(getRestoreTargetDir("/Users/sam", date)).toBe(
      path.join(
        "/Users/sam",
        "Documents",
        "Folio Restored 2026-06-20 14-30-00",
      ),
    );
  });
});
