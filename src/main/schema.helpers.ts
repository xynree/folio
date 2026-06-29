import type { Canvas, FolioItem, Project } from "../types";

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

/**
 * Scans all cross-entity references and removes any that point to IDs that no
 * longer exist in the dataset. Returns a new consistent copy of all three
 * collections plus a `changed` flag. Does not mutate the inputs.
 *
 * Repairs:
 * - item.projectId pointing to a non-existent project (cleared)
 * - project.imageIds containing non-existent item IDs
 * - project.workItemIds containing IDs not present in project.imageIds
 * - project.boardIds containing non-existent canvas IDs
 * - canvas.itemIds containing non-existent item IDs
 * - canvas.positions keys with no corresponding itemId after the itemIds repair
 * - canvas.edges where fromId or toId does not resolve to any canvas object
 *   (items, notes, texts, sections, or links)
 */
export function repairBrokenLinks({
  items,
  projects,
  canvases,
}: {
  items: FolioItem[];
  projects: Project[];
  canvases: Canvas[];
}): {
  items: FolioItem[];
  projects: Project[];
  canvases: Canvas[];
  changed: boolean;
} {
  let changed = false;

  const itemIds = new Set(items.map((item) => item.id));
  const projectIds = new Set(projects.map((project) => project.id));
  const canvasIds = new Set(canvases.map((canvas) => canvas.id));

  // Clear projectId on items whose referenced project no longer exists.
  const repairedItems = items.map((item) => {
    if (item.projectId !== undefined && !projectIds.has(item.projectId)) {
      changed = true;
      const rest = { ...item };
      delete rest.projectId;
      return rest;
    }
    return item;
  });

  // Remove dangling imageIds, workItemIds, and boardIds from projects.
  const repairedProjects = projects.map((project) => {
    const imageIds = project.imageIds.filter((id) => itemIds.has(id));
    const imageIdSet = new Set(imageIds);
    const workItemIds = project.workItemIds.filter((id) => imageIdSet.has(id));
    const boardIds = project.boardIds.filter((id) => canvasIds.has(id));

    if (
      imageIds.length === project.imageIds.length &&
      workItemIds.length === project.workItemIds.length &&
      boardIds.length === project.boardIds.length
    ) {
      return project;
    }

    changed = true;
    return { ...project, imageIds, workItemIds, boardIds };
  });

  // Remove dangling itemIds, orphaned position keys, and broken edge endpoints.
  const repairedCanvases = canvases.map((canvas) => {
    const nextItemIds = canvas.itemIds.filter((id) => itemIds.has(id));
    const nextItemIdSet = new Set(nextItemIds);

    // Build the full set of valid edge-endpoint IDs for this canvas: items plus
    // all inline object types that can serve as edge nodes.
    const validNodeIds = new Set<string>([
      ...nextItemIds,
      ...(canvas.notes ?? []).map((note) => note.id),
      ...(canvas.texts ?? []).map((text) => text.id),
      ...(canvas.sections ?? []).map((section) => section.id),
      ...(canvas.links ?? []).map((link) => link.id),
    ]);

    // Positions are keyed by item ID only; clean against the repaired itemIds.
    const nextPositions: typeof canvas.positions = {};
    let positionsChanged = false;
    for (const [key, geometry] of Object.entries(canvas.positions)) {
      if (nextItemIdSet.has(key)) {
        nextPositions[key] = geometry;
      } else {
        positionsChanged = true;
      }
    }

    const nextEdges = canvas.edges.filter(
      (edge) => validNodeIds.has(edge.fromId) && validNodeIds.has(edge.toId),
    );

    if (
      nextItemIds.length === canvas.itemIds.length &&
      !positionsChanged &&
      nextEdges.length === canvas.edges.length
    ) {
      return canvas;
    }

    changed = true;
    return {
      ...canvas,
      itemIds: nextItemIds,
      positions: nextPositions,
      edges: nextEdges,
    };
  });

  return {
    items: repairedItems,
    projects: repairedProjects,
    canvases: repairedCanvases,
    changed,
  };
}
