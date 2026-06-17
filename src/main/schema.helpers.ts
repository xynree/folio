import type { Canvas, FolioItem } from "../types";

/**
 * Throws when a persisted Folio JSON file does not match the expected schema
 * version or is missing its primary collection array.
 */
export function validateFolioSchema(
  filename: string,
  data: unknown,
  arrayKey: "items" | "tags" | "canvases" | "projects",
  schemaVersion: number,
): void {
  if (
    !data ||
    typeof data !== "object" ||
    (data as { version?: unknown }).version !== schemaVersion ||
    !Array.isArray((data as Record<string, unknown>)[arrayKey])
  ) {
    throw new Error(
      `${filename} is not a valid Folio v${schemaVersion} data file.`,
    );
  }
}

/** Returns a copy of the canvas with the obsolete `references` field removed. */
export function stripLegacyCanvasReferences(canvas: Canvas): Canvas {
  const nextCanvas = { ...canvas } as Canvas & { references?: unknown };
  delete nextCanvas.references;
  return nextCanvas;
}

/**
 * Drops the obsolete `references` field from any canvas that still carries it.
 * Returns the (possibly rebuilt) list along with whether anything changed.
 */
export function removeLegacyCanvasReferences(canvases: Canvas[]): {
  canvases: Canvas[];
  changed: boolean;
} {
  let changed = false;
  const nextCanvases = canvases.map((canvas) => {
    const legacyCanvas = canvas as Canvas & { references?: unknown };
    if (!Object.prototype.hasOwnProperty.call(legacyCanvas, "references")) {
      return canvas;
    }
    changed = true;
    return stripLegacyCanvasReferences(canvas);
  });

  return { canvases: nextCanvases, changed };
}

/**
 * Rewrites the legacy "output" stage to "final" in place. Returns whether any
 * item was changed.
 */
export function repairLegacyOutputStages(items: FolioItem[]): boolean {
  let changed = false;

  for (const item of items) {
    if ((item.stage as string | undefined) !== "output") continue;
    item.stage = "final";
    changed = true;
  }

  return changed;
}
