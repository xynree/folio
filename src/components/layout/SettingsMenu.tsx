import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  CloudDownload,
  CloudUpload,
  HardDrive,
  Settings,
} from "lucide-react";
import type {
  BackupStatus,
  StorageLocation,
  StorageSettings,
} from "../../types";
import { ButtonIcon } from "../shared/ButtonIcon";

type PendingAction = "backup" | "restore" | "switch" | null;

const LOCATION_LABELS: Record<StorageLocation, string> = {
  documents: "Documents",
  icloud: "iCloud Drive",
};

/**
 * Builds the human-readable line describing the current backup state. Extracted so the formatting
 * can be unit tested without rendering the menu.
 */
export function formatBackupStatusLabel(
  status: BackupStatus | null,
  now: Date = new Date(),
): string {
  if (!status) return "Checking backup location…";

  const targetLabel = LOCATION_LABELS[status.target];
  if (!status.available) {
    return status.target === "icloud"
      ? "iCloud Drive is turned off on this Mac."
      : `The ${targetLabel} backup location isn't available.`;
  }
  if (!status.lastBackupAt) return `No backup in ${targetLabel} yet.`;

  const lastBackup = new Date(status.lastBackupAt);
  if (Number.isNaN(lastBackup.getTime())) {
    return `Backed up to ${targetLabel}.`;
  }

  return `Last backed up ${formatRelativeTime(lastBackup, now)}.`;
}

function formatRelativeTime(then: Date, now: Date): string {
  const seconds = Math.max(0, Math.round((now.getTime() - then.getTime()) / 1000));
  if (seconds < 60) return "just now";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;

  return `on ${then.toLocaleDateString()}`;
}

export function SettingsMenu({
  onToast,
}: {
  onToast: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [storage, setStorage] = useState<StorageSettings | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const [backupStatus, storageSettings] = await Promise.all([
        window.folio.getBackupStatus(),
        window.folio.getStorageSettings(),
      ]);
      setStatus(backupStatus);
      setStorage(storageSettings);
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void refreshStatus();
  }, [open, refreshStatus]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleBackup = useCallback(async () => {
    setPending("backup");
    try {
      await window.folio.backupToICloud();
      await refreshStatus();
      onToast("Backup created");
    } catch (error) {
      console.error(error);
      onToast(error instanceof Error ? error.message : "Backup failed");
    } finally {
      setPending(null);
    }
  }, [onToast, refreshStatus]);

  const handleRestore = useCallback(async () => {
    const confirmed = window.confirm(
      "Restore copies the latest backup into a new folder in Documents and reveals it in Finder. Your current Folio data is left untouched. Continue?",
    );
    if (!confirmed) return;

    setPending("restore");
    try {
      await window.folio.restoreFromICloud();
      onToast("Backup restored to a new folder in Documents");
    } catch (error) {
      console.error(error);
      onToast(error instanceof Error ? error.message : "Restore failed");
    } finally {
      setPending(null);
    }
  }, [onToast]);

  const handleSwitchLocation = useCallback(
    async (location: StorageLocation) => {
      if (storage && location === storage.location) return;

      const targetLabel = LOCATION_LABELS[location];
      const confirmed = window.confirm(
        `Move your Folio files to ${targetLabel} and use it as the source of truth?\n\nYour current files are copied to the new location and the original folder is left in place as a safety copy. Folio will relaunch to finish.`,
      );
      if (!confirmed) return;

      setPending("switch");
      try {
        await window.folio.setStorageLocation(location);
        // The main process relaunches the app, so this toast is only seen if it does not.
        onToast(`Switching to ${targetLabel}…`);
      } catch (error) {
        console.error(error);
        onToast(
          error instanceof Error ? error.message : "Could not change location",
        );
        setPending(null);
      }
    },
    [onToast, storage],
  );

  const busy = pending !== null;
  const backupAvailable = status?.available ?? true;
  const hasBackup = Boolean(status?.lastBackupAt);
  const currentLocation = storage?.location ?? "documents";
  const iCloudAvailable = storage?.iCloudAvailable ?? true;

  return (
    <div className="settings-menu" ref={containerRef}>
      <button
        className="icon-button settings-menu-trigger"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Settings"
        title="Settings"
        onClick={() => setOpen((current) => !current)}
      >
        <ButtonIcon icon={Settings} />
      </button>

      {open ? (
        <div className="settings-menu-popover" role="menu">
          <div className="settings-menu-section-title">Storage location</div>
          <p className="settings-menu-status">
            Folio files live in {LOCATION_LABELS[currentLocation]}.
          </p>
          <div
            className="settings-menu-location-options"
            role="radiogroup"
            aria-label="Folio storage location"
          >
            {(["documents", "icloud"] as StorageLocation[]).map((location) => {
              const isCurrent = currentLocation === location;
              const disabled =
                busy || (location === "icloud" && !iCloudAvailable);
              return (
                <button
                  key={location}
                  className={`settings-menu-location-option${
                    isCurrent ? " is-current" : ""
                  }`}
                  type="button"
                  role="radio"
                  aria-checked={isCurrent}
                  disabled={disabled}
                  onClick={() => handleSwitchLocation(location)}
                >
                  <ButtonIcon icon={isCurrent ? Check : HardDrive} size={15} />
                  <span>{LOCATION_LABELS[location]}</span>
                  {location === "icloud" && !iCloudAvailable ? (
                    <span className="settings-menu-location-note">
                      unavailable
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="settings-menu-divider" />

          <div className="settings-menu-section-title">Backup</div>
          <p className="settings-menu-status">
            {formatBackupStatusLabel(status)}
          </p>
          <button
            className="secondary-action settings-menu-action"
            type="button"
            disabled={busy || !backupAvailable}
            onClick={handleBackup}
          >
            <ButtonIcon icon={CloudUpload} />
            {pending === "backup"
              ? "Backing up…"
              : `Back up to ${LOCATION_LABELS[status?.target ?? "icloud"]}`}
          </button>
          <button
            className="secondary-action settings-menu-action"
            type="button"
            disabled={busy || !backupAvailable || !hasBackup}
            onClick={handleRestore}
          >
            <ButtonIcon icon={CloudDownload} />
            {pending === "restore" ? "Restoring…" : "Restore from backup…"}
          </button>
          <p className="settings-menu-hint">
            Backups overwrite a single copy stored in the other location.
            Restoring never changes your current Folio data.
          </p>
        </div>
      ) : null}
    </div>
  );
}
