import path from "node:path";

/**
 * True when filePath lives inside directory. The directory itself does not count, and paths that
 * escape via "../" or resolve to an absolute location are rejected.
 */
export function isPathInsideDirectory(
  filePath: string,
  directory: string,
): boolean {
  const relative = path.relative(directory, filePath);
  return (
    Boolean(relative) &&
    !relative.startsWith("..") &&
    !path.isAbsolute(relative)
  );
}

/**
 * True when absolutePath is the root folder or nested anywhere inside it. Used to gate access
 * through the folio:// protocol so the renderer can only read files within the Folio root.
 */
export function isPathWithinRoot(absolutePath: string, root: string): boolean {
  const resolved = path.resolve(absolutePath);
  const resolvedRoot = path.resolve(root);
  return (
    resolved === resolvedRoot ||
    resolved.startsWith(`${resolvedRoot}${path.sep}`)
  );
}

/** Maps a file extension to the MIME type served over the folio:// protocol. */
export function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return "application/octet-stream";
}

/**
 * Extracts a human-readable message from a thrown command/exec error. It prefers any captured
 * stderr and unwraps the "execution error: <message> (-1234)" wrapper that AppleScript helpers add.
 */
export function extractCommandErrorMessage(error: unknown): string {
  const structuredError = error as { stderr?: unknown };
  const stderr =
    typeof structuredError?.stderr === "string"
      ? structuredError.stderr.trim()
      : "";
  const message =
    stderr || (error instanceof Error ? error.message : String(error));
  const executionError = message.match(/execution error: (.*?)(?: \(-?\d+\))?$/);

  return executionError?.[1]?.trim() ?? message.trim();
}
