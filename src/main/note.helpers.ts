/**
 * Pure helpers for Markdown notes, isolated from filesystem and Electron so
 * they can be unit-tested directly.
 */

const MARKDOWN_HEADING_PATTERN = /^#{1,6}\s+(.+?)\s*#*\s*$/;
const MAX_TITLE_LENGTH = 120;

/**
 * Derives a human-readable title from Markdown content. Prefers the first
 * Markdown heading, then the first non-empty line, and falls back to the
 * provided default when the content has no usable text.
 */
export function deriveNoteTitle(content: string, fallbackTitle: string): string {
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const headingMatch = MARKDOWN_HEADING_PATTERN.exec(trimmed);
    const candidate = headingMatch ? headingMatch[1].trim() : trimmed;
    if (candidate) {
      return candidate.slice(0, MAX_TITLE_LENGTH);
    }
  }

  return fallbackTitle.trim() || "Untitled note";
}
