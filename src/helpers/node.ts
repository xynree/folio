import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

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
