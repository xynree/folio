import type { Canvas, FolioData, FolioItem, ReconciliationResult } from "../types";

export function makeItem(
  id: string,
  overrides: Partial<FolioItem> = {},
): FolioItem {
  return {
    id,
    path: `items/2026/06_june/${id}.png`,
    hash: `hash-${id}`,
    type: "sketch",
    date: "2026-06-15T08:00:00.000Z",
    title: id,
    description: "",
    tagIds: [],
    ...overrides,
  };
}

export function makeCanvas(id: string, overrides: Partial<Canvas> = {}): Canvas {
  return {
    id,
    title: id,
    description: "",
    color: "#9f6b3d",
    itemIds: [],
    positions: {},
    notes: [],
    edges: [],
    references: [],
    strokes: [],
    texts: [],
    ...overrides,
  };
}

export function makeData(overrides: Partial<FolioData> = {}): FolioData {
  return {
    version: 1,
    items: [
      makeItem("alpha", { title: "Alpha", date: "2026-06-15T08:00:00.000Z" }),
      makeItem("bravo", { title: "Bravo", date: "2026-06-15T09:00:00.000Z" }),
      makeItem("charlie", { title: "Charlie", date: "2026-06-15T10:00:00.000Z" }),
    ],
    tags: [
      { id: "tag-sketch", text: "sketchbook" },
      { id: "tag-warmup", text: "warmup" },
    ],
    canvases: [
      makeCanvas("board-1", {
        title: "Board 1",
        itemIds: ["alpha"],
        positions: { alpha: { x: 80, y: 90 } },
      }),
    ],
    ...overrides,
  };
}

export function emptyReconciliation(): ReconciliationResult {
  return {
    scannedAt: "2026-06-15T12:00:00.000Z",
    untrackedFiles: [],
    missingItems: [],
    relocatedItems: [],
  };
}

export function cloneData(data: FolioData): FolioData {
  return JSON.parse(JSON.stringify(data)) as FolioData;
}
