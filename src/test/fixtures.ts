import type {
  Canvas,
  FolioData,
  FolioItem,
  Project,
  ReconciliationResult,
} from "../types";

export function makeItem(
  id: string,
  overrides: Partial<FolioItem> = {},
): FolioItem {
  return {
    id,
    path: `projects/studio-archive/images/${id}.png`,
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
    projectId: "project-1",
    createdAt: "2026-06-15T08:00:00.000Z",
    updatedAt: "2026-06-15T09:00:00.000Z",
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

export function makeProject(
  id: string,
  overrides: Partial<Project> = {},
): Project {
  return {
    id,
    title: "Studio Archive",
    description: "",
    status: "active",
    createdAt: "2026-06-15T08:00:00.000Z",
    updatedAt: "2026-06-15T09:00:00.000Z",
    folderPath: "projects/studio-archive",
    imageIds: ["alpha", "bravo", "charlie"],
    workItemIds: [],
    boardIds: ["board-1"],
    reviews: [],
    ...overrides,
  };
}

export function makeData(overrides: Partial<FolioData> = {}): FolioData {
  const baseData: FolioData = {
    version: 1,
    items: [
      makeItem("alpha", {
        title: "Alpha",
        date: "2026-06-15T08:00:00.000Z",
        projectId: "project-1",
      }),
      makeItem("bravo", {
        title: "Bravo",
        date: "2026-06-15T09:00:00.000Z",
        projectId: "project-1",
      }),
      makeItem("charlie", {
        title: "Charlie",
        date: "2026-06-15T10:00:00.000Z",
        projectId: "project-1",
      }),
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
    projects: [makeProject("project-1")],
  };

  const data = {
    ...baseData,
    ...overrides,
  };

  if (!overrides.projects) {
    data.projects = [
      makeProject("project-1", {
        imageIds: data.items.map((item) => item.id),
        boardIds: data.canvases.map((canvas) => canvas.id),
      }),
    ];
  }

  return data;
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
