import type { FolioItem } from "../../types";
import { IMAGE_FILE_PATTERN } from "./constants";

/** Picks a file extension for a pasted clipboard image, falling back to its MIME type. */
export function clipboardImageExtension(file: File): string {
  const filenameExt = file.name.match(/\.[a-z0-9]+$/i)?.[0];
  if (filenameExt) return filenameExt.toLowerCase();
  if (file.type === "image/jpeg") return ".jpg";
  if (file.type === "image/png") return ".png";
  if (file.type === "image/webp") return ".webp";
  if (file.type === "image/gif") return ".gif";
  return ".png";
}

function clipboardFileKey(file: File): string {
  return [file.name, file.type, file.size, file.lastModified].join("\0");
}

export function getClipboardImageFiles(
  clipboardData: DataTransfer,
  getPathForFile: (file: File) => string,
): File[] {
  const candidates = [
    ...Array.from(clipboardData.files ?? []),
    ...Array.from(clipboardData.items ?? [])
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file)),
  ];
  const seen = new Set<string>();

  return candidates.filter((file) => {
    const filePath = getPathForFile(file);
    const isImage =
      IMAGE_FILE_PATTERN.test(filePath || file.name) ||
      file.type.startsWith("image/");
    const key = clipboardFileKey(file);
    if (!isImage || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function messageForError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function canFallBackToLegacyImport(error: unknown, handlerName: string) {
  const message = messageForError(error).toLowerCase();
  return (
    message.includes("no handler registered") && message.includes(handlerName)
  );
}

async function importWithLegacyFileDialog(projectId?: string | null) {
  const filePaths = await window.folio.openFileDialog();
  const uniquePaths = Array.from(new Set(filePaths.filter(Boolean)));
  if (!uniquePaths.length) return [];
  if (projectId && typeof window.folio.copyToProject === "function") {
    return window.folio.copyToProject(projectId, uniquePaths);
  }
  return window.folio.copyToFolio(uniquePaths);
}

export async function chooseAndImportItems(
  projectId?: string | null,
): Promise<FolioItem[]> {
  if (projectId && typeof window.folio.importToProject === "function") {
    try {
      return await window.folio.importToProject(projectId);
    } catch (error) {
      if (canFallBackToLegacyImport(error, "folio:import-to-project")) {
        return importWithLegacyFileDialog(projectId);
      }
      throw error;
    }
  }

  if (typeof window.folio.importToFolio !== "function") {
    return importWithLegacyFileDialog(projectId);
  }

  try {
    return await window.folio.importToFolio();
  } catch (error) {
    if (canFallBackToLegacyImport(error, "folio:import-to-folio")) {
      return importWithLegacyFileDialog(projectId);
    }
    throw error;
  }
}

export function getImportFailureMessage(error: unknown, fallback: string) {
  const message = messageForError(error).trim();
  if (!message || message === "[object Object]") return fallback;
  return `${fallback}: ${message}`;
}
