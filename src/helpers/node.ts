import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { ItemType } from "../types";

/**
 * Helper to check if a file exists.
 */
export async function exists(p: string): Promise<boolean> {
  try {
    await fs.promises.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Computes a truncated SHA-256 hash of the first 64KB of a file.
 */
export async function computeHash(filePath: string): Promise<string> {
  const handle = await fs.promises.open(filePath, "r");
  const buffer = Buffer.allocUnsafe(64 * 1024);
  const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
  await handle.close();

  return crypto
    .createHash("sha256")
    .update(buffer.subarray(0, bytesRead))
    .digest("hex")
    .substring(0, 8);
}

export function sanitizeFileBaseName(filename: string): string {
  const sanitized = filename
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");

  return sanitized || "untitled";
}

export function inferItemType(ext: string): ItemType {
  const normalized = ext.toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".webp", ".heic"].includes(normalized)) {
    return "sketch";
  }
  if ([".mp3", ".wav", ".aiff", ".m4a"].includes(normalized)) {
    return "music";
  }
  if ([".mp4", ".mov", ".gif"].includes(normalized)) {
    return "anim";
  }
  if ([".md", ".docx", ".txt", ".rtf"].includes(normalized)) {
    return "text";
  }
  return "other";
}

export async function createDirectoryByDate(rootDir: string) {
  const now = new Date();
  const year = now.getFullYear().toString();
  const monthNames = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];
  const month = `${(now.getMonth() + 1).toString().padStart(2, "0")}_${monthNames[now.getMonth()]}`;

  // Ensure the year/month destination exists
  const destDir = path.join(rootDir, "items", year, month);
  await fs.promises.mkdir(destDir, { recursive: true });
  return destDir;
}
