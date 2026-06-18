import type { FolioItem } from "../../types";

/** Returns the final path segment of a file path, ignoring slash style. */
export function basename(filePath: string): string {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}

/** Uppercased file extension without the dot, or "FILE" when none is present. */
export function fileExtension(filePath: string): string {
  const filename = basename(filePath);
  const index = filename.lastIndexOf(".");
  return index >= 0 ? filename.slice(index + 1).toUpperCase() : "FILE";
}

/** Human-facing label for an item: its title, or the file name as a fallback. */
export function itemDisplayTitle(item: FolioItem): string {
  return item.title || basename(item.path);
}

/** Formats a count with a singular/plural unit label (e.g. "1 item", "3 items"). */
export function formatCount(
  count: number,
  singular: string,
  plural = `${singular}s`,
) {
  return `${count} ${count === 1 ? singular : plural}`;
}
