import type {
  Canvas,
  CanvasPosition,
  FolioData,
  FolioItem,
  Project,
  Tag,
} from "../../types";
import { CANVAS_COLORS, IMAGE_FILE_PATTERN } from "./constants";

export function createId(prefix: string) {
  if ("randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/** Fills in any missing top-level collections so the rest of the app can assume they exist. */
export function normalizeFolioData(data: FolioData): FolioData {
  return {
    ...data,
    items: data.items ?? [],
    canvases: data.canvases ?? [],
    tags: data.tags ?? [],
    projects: data.projects ?? [],
  };
}

/** Moves a board to the front of a project's board list, recording the change time. */
export function assignBoardToProject(
  projects: Project[],
  projectId: string | null,
  boardId: string,
  savedAt: string,
): Project[] {
  if (!projectId) return projects;

  return projects.map((project) =>
    project.id === projectId
      ? {
          ...project,
          boardIds: [
            boardId,
            ...project.boardIds.filter((id) => id !== boardId),
          ],
          updatedAt: savedAt,
        }
      : project,
  );
}

export function mergeItems(
  current: FolioItem[],
  incoming: FolioItem[],
): FolioItem[] {
  const byId = new Map(current.map((item) => [item.id, item]));
  incoming.forEach((item) => byId.set(item.id, item));
  return Array.from(byId.values());
}

export function mergeImportedItemsIntoProject(
  current: FolioData,
  imported: FolioItem[],
  projectId?: string | null,
  savedAt = new Date().toISOString(),
): FolioData {
  const items = mergeItems(current.items, imported);
  if (!projectId || !imported.length) {
    return { ...current, items };
  }

  const importedIds = imported.map((item) => item.id);
  const importedIdSet = new Set(importedIds);

  return {
    ...current,
    items: items.map((item) =>
      importedIdSet.has(item.id) && !item.projectId
        ? { ...item, projectId }
        : item,
    ),
    projects: current.projects.map((project) =>
      project.id === projectId
        ? {
            ...project,
            imageIds: Array.from(
              new Set([...project.imageIds, ...importedIds]),
            ),
            updatedAt: savedAt,
          }
        : project,
    ),
  };
}

export function dateKeyFromDate(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function dateKeyFromItem(item: FolioItem): string {
  const date = new Date(item.date);
  if (Number.isNaN(date.getTime())) {
    return dateKeyFromDate(new Date());
  }
  return dateKeyFromDate(date);
}

export function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function dateFromKey(key: string): Date {
  return new Date(`${key}T12:00:00`);
}

export function formatDateLabel(key: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(dateFromKey(key));
}

export function buildDateRange(items: FolioItem[]): string[] {
  const today = dateKeyFromDate(new Date());
  const itemKeys = items.map(dateKeyFromItem);
  const earliestKey = itemKeys.length
    ? itemKeys.reduce((earliest, key) => (key < earliest ? key : earliest))
    : today;
  const latestKey = itemKeys.length
    ? itemKeys.reduce((latest, key) => (key > latest ? key : latest), today)
    : today;

  const dates: string[] = [];
  const cursor = dateFromKey(latestKey > today ? latestKey : today);
  const earliest = dateFromKey(earliestKey);

  while (cursor >= earliest) {
    dates.push(dateKeyFromDate(cursor));
    cursor.setDate(cursor.getDate() - 1);
  }

  return dates;
}

export function groupItemsByDate(items: FolioItem[]): Map<string, FolioItem[]> {
  const groups = new Map<string, FolioItem[]>();
  items.forEach((item) => {
    const key = dateKeyFromItem(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  });

  groups.forEach((group) =>
    group.sort(
      (a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title),
    ),
  );

  return groups;
}

export function getGaps(items: FolioItem[]): number {
  if (!items.length) return 0;
  const groups = groupItemsByDate(items);
  return buildDateRange(items).filter((date) => !groups.has(date)).length;
}

export {
  basename,
  fileExtension,
  formatCount,
  itemDisplayTitle,
} from "./strings";

export function createCanvas(
  index: number,
  title?: string,
  description?: string,
): Canvas {
  const createdAt = new Date().toISOString();

  return {
    id: createId("canvas"),
    title: title?.trim() || `Board ${index + 1}`,
    description: description?.trim() ?? "",
    color: CANVAS_COLORS[index % CANVAS_COLORS.length],
    createdAt,
    updatedAt: createdAt,
    itemIds: [],
    positions: {},
    notes: [],
    edges: [],
    strokes: [],
    texts: [],
  };
}

export function markCanvasSaved(
  canvas: Canvas,
  savedAt = new Date().toISOString(),
): Canvas {
  return {
    ...canvas,
    createdAt: canvas.createdAt ?? canvas.updatedAt ?? savedAt,
    updatedAt: savedAt,
  };
}

export function addItemToCanvas(canvas: Canvas, itemId: string): Canvas {
  return addItemsToCanvas(canvas, [itemId]);
}

export function addItemsToCanvas(
  canvas: Canvas,
  itemIds: string[],
  origin?: CanvasPosition,
): Canvas {
  const nextItemIds = [...canvas.itemIds];
  const positions = { ...canvas.positions };
  let placedCount = 0;

  Array.from(new Set(itemIds)).forEach((itemId) => {
    if (nextItemIds.includes(itemId)) return;

    const gridIndex = nextItemIds.length;
    positions[itemId] = origin
      ? {
          x: origin.x + (placedCount % 4) * 184,
          y: origin.y + Math.floor(placedCount / 4) * 228,
        }
      : {
          x: 80 + (gridIndex % 4) * 190,
          y: 90 + Math.floor(gridIndex / 4) * 230,
        };

    nextItemIds.push(itemId);
    placedCount += 1;
  });

  return {
    ...canvas,
    itemIds: nextItemIds,
    positions,
  };
}

export function tagTextsForItem(item: FolioItem, tags: Tag[]) {
  const byId = new Map(tags.map((tag) => [tag.id, tag.text]));
  return item.tagIds
    .map((tagId) => byId.get(tagId))
    .filter(Boolean) as string[];
}

export function canvasColorsForItem(
  itemId: string,
  canvases: Canvas[],
): string[] {
  return canvases
    .filter((canvas) => canvas.itemIds.includes(itemId))
    .map(
      (canvas, index) =>
        canvas.color ?? CANVAS_COLORS[index % CANVAS_COLORS.length],
    );
}

export function itemCanUseDirectPreview(item: FolioItem): boolean {
  return (
    !item.missing &&
    ["sketch", "anim"].includes(item.type) &&
    IMAGE_FILE_PATTERN.test(item.path)
  );
}
