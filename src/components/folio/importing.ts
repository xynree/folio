import type { FolioItem } from "../../types";

function messageForError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function canFallBackToLegacyImport(error: unknown) {
  const message = messageForError(error).toLowerCase();
  return (
    message.includes("no handler registered") &&
    message.includes("folio:import-to-folio")
  );
}

async function importWithLegacyFileDialog() {
  const filePaths = await window.folio.openFileDialog();
  const uniquePaths = Array.from(new Set(filePaths.filter(Boolean)));
  if (!uniquePaths.length) return [];
  return window.folio.copyToFolio(uniquePaths);
}

export async function chooseAndImportItems(): Promise<FolioItem[]> {
  if (typeof window.folio.importToFolio !== "function") {
    return importWithLegacyFileDialog();
  }

  try {
    return await window.folio.importToFolio();
  } catch (error) {
    if (canFallBackToLegacyImport(error)) {
      return importWithLegacyFileDialog();
    }
    throw error;
  }
}

export function getImportFailureMessage(error: unknown, fallback: string) {
  const message = messageForError(error).trim();
  if (!message || message === "[object Object]") return fallback;
  return `${fallback}: ${message}`;
}
