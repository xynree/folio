import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { BackupStatus, StorageSettings } from "../../types";
import { SettingsMenu, formatBackupStatusLabel } from "./SettingsMenu";

const folio = window.folio as unknown as {
  getBackupStatus: ReturnType<typeof vi.fn>;
  backupToICloud: ReturnType<typeof vi.fn>;
  restoreFromICloud: ReturnType<typeof vi.fn>;
  getStorageSettings: ReturnType<typeof vi.fn>;
  setStorageLocation: ReturnType<typeof vi.fn>;
};

const ICLOUD_BACKUP_STATUS: BackupStatus = {
  available: true,
  target: "icloud",
  backupPath: "/p",
  lastBackupAt: null,
};

const DOCUMENTS_STORAGE: StorageSettings = {
  location: "documents",
  iCloudAvailable: true,
  documentsPath: "/Users/test/Documents/Folio",
  iCloudPath: "/Users/test/iCloud/Folio",
};

function setStatus(status: BackupStatus) {
  folio.getBackupStatus.mockResolvedValue(status);
}

function setStorage(settings: StorageSettings) {
  folio.getStorageSettings.mockResolvedValue(settings);
}

beforeEach(() => {
  setStatus(ICLOUD_BACKUP_STATUS);
  setStorage(DOCUMENTS_STORAGE);
});

describe("formatBackupStatusLabel", () => {
  it("describes a missing status, an unavailable target, and no backup", () => {
    expect(formatBackupStatusLabel(null)).toBe("Checking backup location…");
    expect(
      formatBackupStatusLabel({
        available: false,
        target: "icloud",
        backupPath: "/p",
        lastBackupAt: null,
      }),
    ).toBe("iCloud Drive is turned off on this Mac.");
    expect(
      formatBackupStatusLabel({
        available: false,
        target: "documents",
        backupPath: "/p",
        lastBackupAt: null,
      }),
    ).toBe("The Documents backup location isn't available.");
    expect(
      formatBackupStatusLabel({
        available: true,
        target: "icloud",
        backupPath: "/p",
        lastBackupAt: null,
      }),
    ).toBe("No backup in iCloud Drive yet.");
  });

  it("formats a relative time for the last backup", () => {
    const now = new Date("2026-06-20T12:00:00.000Z");
    const status: BackupStatus = {
      available: true,
      target: "icloud",
      backupPath: "/p",
      lastBackupAt: "2026-06-20T11:30:00.000Z",
    };
    expect(formatBackupStatusLabel(status, now)).toBe(
      "Last backed up 30 minutes ago.",
    );
  });
});

describe("SettingsMenu", () => {
  it("loads backup and storage status when opened", async () => {
    render(<SettingsMenu onToast={vi.fn()} />);

    fireEvent.click(screen.getByLabelText("Settings"));

    expect(
      await screen.findByText("No backup in iCloud Drive yet."),
    ).toBeTruthy();
    expect(folio.getBackupStatus).toHaveBeenCalled();
    expect(folio.getStorageSettings).toHaveBeenCalled();
    expect(screen.getByText("Folio files live in Documents.")).toBeTruthy();
  });

  it("disables restore until a backup exists", async () => {
    render(<SettingsMenu onToast={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("Settings"));
    await screen.findByText("No backup in iCloud Drive yet.");

    expect(
      screen.getByRole("button", { name: /Restore from backup/ }),
    ).toHaveProperty("disabled", true);
  });

  it("runs a backup and reports success", async () => {
    folio.backupToICloud.mockResolvedValue({
      backupPath: "/p",
      createdAt: new Date().toISOString(),
    });
    const onToast = vi.fn();
    render(<SettingsMenu onToast={onToast} />);
    fireEvent.click(screen.getByLabelText("Settings"));
    await screen.findByText("No backup in iCloud Drive yet.");

    fireEvent.click(screen.getByRole("button", { name: /Back up to iCloud/ }));

    await waitFor(() => expect(onToast).toHaveBeenCalledWith("Backup created"));
    expect(folio.backupToICloud).toHaveBeenCalled();
  });

  it("surfaces a backup failure message", async () => {
    folio.backupToICloud.mockRejectedValue(
      new Error("iCloud Drive isn't available"),
    );
    const onToast = vi.fn();
    render(<SettingsMenu onToast={onToast} />);
    fireEvent.click(screen.getByLabelText("Settings"));
    await screen.findByText("No backup in iCloud Drive yet.");

    fireEvent.click(screen.getByRole("button", { name: /Back up to iCloud/ }));

    await waitFor(() =>
      expect(onToast).toHaveBeenCalledWith("iCloud Drive isn't available"),
    );
  });

  it("restores after confirmation", async () => {
    setStatus({
      available: true,
      target: "icloud",
      backupPath: "/p",
      lastBackupAt: "2026-06-20T11:30:00.000Z",
    });
    folio.restoreFromICloud.mockResolvedValue({
      restoredPath: "/restored",
      restoredAt: new Date().toISOString(),
    });
    const onToast = vi.fn();
    render(<SettingsMenu onToast={onToast} />);
    fireEvent.click(screen.getByLabelText("Settings"));
    await screen.findByRole("button", { name: /Restore from backup/ });

    fireEvent.click(
      screen.getByRole("button", { name: /Restore from backup/ }),
    );

    await waitFor(() =>
      expect(onToast).toHaveBeenCalledWith(
        "Backup restored to a new folder in Documents",
      ),
    );
    expect(window.confirm).toHaveBeenCalled();
    expect(folio.restoreFromICloud).toHaveBeenCalled();
  });

  it("switches the storage location after confirmation", async () => {
    folio.setStorageLocation.mockResolvedValue(undefined);
    const onToast = vi.fn();
    render(<SettingsMenu onToast={onToast} />);
    fireEvent.click(screen.getByLabelText("Settings"));
    await screen.findByText("Folio files live in Documents.");

    fireEvent.click(screen.getByRole("radio", { name: /iCloud Drive/ }));

    await waitFor(() =>
      expect(folio.setStorageLocation).toHaveBeenCalledWith("icloud"),
    );
    expect(window.confirm).toHaveBeenCalled();
  });

  it("does not switch when the current location is selected again", async () => {
    const onToast = vi.fn();
    render(<SettingsMenu onToast={onToast} />);
    fireEvent.click(screen.getByLabelText("Settings"));
    await screen.findByText("Folio files live in Documents.");

    fireEvent.click(screen.getByRole("radio", { name: /Documents/ }));

    expect(folio.setStorageLocation).not.toHaveBeenCalled();
  });

  it("disables the iCloud option when iCloud is unavailable", async () => {
    setStorage({ ...DOCUMENTS_STORAGE, iCloudAvailable: false });
    render(<SettingsMenu onToast={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("Settings"));
    await screen.findByText("Folio files live in Documents.");

    expect(
      screen.getByRole("radio", { name: /iCloud Drive/ }),
    ).toHaveProperty("disabled", true);
  });
});
