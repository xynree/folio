import type { Canvas, CanvasEdge, FolioItem, Project } from "../../types";
import { dateKeyFromDate, formatDateLabel } from "../folio/model";

export type ProjectTimelineKind =
  | "image"
  | "work"
  | "reference"
  | "note"
  | "output"
  | "relationship";

export type ProjectTimelineEntry = {
  id: string;
  kind: ProjectTimelineKind;
  title: string;
  detail: string;
  timestamp: string;
  boardId?: string;
  itemId?: string;
};

export type ProjectTimelineGroup = {
  key: string;
  label: string;
  entries: ProjectTimelineEntry[];
};

export type ProjectRecap = {
  imageCount: number;
  workCount: number;
  boardCount: number;
  referenceCount: number;
  outputCount: number;
  activeDays: number;
  firstImageDate: string | null;
  latestSavedDate: string | null;
};

export type ProjectReview = {
  recap: ProjectRecap;
  timelineGroups: ProjectTimelineGroup[];
};

function validTimestamp(value?: string): string | null {
  if (!value) return null;
  return Number.isNaN(Date.parse(value)) ? null : value;
}

function fallbackTimestamp(...values: Array<string | undefined>): string {
  return values.map(validTimestamp).find(Boolean) ?? new Date(0).toISOString();
}

function itemTitle(item: FolioItem): string {
  return item.title || item.path.split(/[\\/]/).pop() || "Untitled item";
}

function boardTitle(board: Canvas): string {
  return board.title || "Untitled board";
}

function edgeTitle(edge: CanvasEdge): string {
  if (edge.relationshipType === "version-of") return "Version relationship";
  if (edge.label) return edge.label;
  return "Board relationship";
}

function edgeDetail(edge: CanvasEdge, board: Canvas): string {
  const type = edge.relationshipType === "version-of" ? "version-of" : "linked";
  return `${type} on ${boardTitle(board)}`;
}

function weekKey(timestamp: string): string {
  const date = new Date(timestamp);
  const day = date.getDay();
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - day);
  return dateKeyFromDate(weekStart);
}

function groupTimeline(entries: ProjectTimelineEntry[]): ProjectTimelineGroup[] {
  const sorted = [...entries].sort(
    (a, b) =>
      b.timestamp.localeCompare(a.timestamp) ||
      a.kind.localeCompare(b.kind) ||
      a.title.localeCompare(b.title),
  );
  const useWeeks = sorted.length > 18;
  const groups = new Map<string, ProjectTimelineEntry[]>();

  sorted.forEach((entry) => {
    const key = useWeeks ? weekKey(entry.timestamp) : entry.timestamp.slice(0, 10);
    const group = groups.get(key) ?? [];
    group.push(entry);
    groups.set(key, group);
  });

  return Array.from(groups.entries()).map(([key, groupEntries]) => ({
    key,
    label: useWeeks ? `Week of ${formatDateLabel(key)}` : formatDateLabel(key),
    entries: groupEntries,
  }));
}

export function buildProjectReview(
  project: Project,
  items: FolioItem[],
  canvases: Canvas[],
): ProjectReview {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const projectImageIds = new Set(project.imageIds);
  const projectWorkIds = new Set(project.workItemIds);
  const projectItems = project.imageIds
    .map((itemId) => itemById.get(itemId))
    .filter(Boolean) as FolioItem[];
  const projectCanvases = canvases.filter(
    (canvas) =>
      canvas.projectId === project.id || project.boardIds.includes(canvas.id),
  );
  const entries: ProjectTimelineEntry[] = [];
  const outputItems = projectItems.filter(
    (item) => item.stage === "final" || item.stage === "output",
  );

  projectItems.forEach((item) => {
    const timestamp = fallbackTimestamp(item.date, item.updatedAt);
    entries.push({
      id: `image-${item.id}`,
      kind: "image",
      title: itemTitle(item),
      detail: "Project image",
      timestamp,
      boardId: projectCanvases.find((canvas) => canvas.itemIds.includes(item.id))?.id,
      itemId: item.id,
    });
  });

  project.workItemIds.forEach((itemId) => {
    const item = itemById.get(itemId);
    if (!item || !projectImageIds.has(item.id)) return;
    entries.push({
      id: `work-${item.id}`,
      kind: "work",
      title: itemTitle(item),
      detail: "Marked as Work",
      timestamp: fallbackTimestamp(item.updatedAt, item.date),
      boardId: projectCanvases.find((canvas) => canvas.itemIds.includes(item.id))?.id,
      itemId: item.id,
    });
  });

  outputItems.forEach((item) => {
    entries.push({
      id: `output-${item.id}`,
      kind: "output",
      title: itemTitle(item),
      detail: item.stage === "final" ? "Final output" : "Output",
      timestamp: fallbackTimestamp(item.updatedAt, item.date),
      boardId: projectCanvases.find((canvas) => canvas.itemIds.includes(item.id))?.id,
      itemId: item.id,
    });
  });

  projectCanvases.forEach((canvas) => {
    canvas.references.forEach((reference) => {
      entries.push({
        id: `reference-${canvas.id}-${reference.id}`,
        kind: "reference",
        title: reference.filename,
        detail: `Reference on ${boardTitle(canvas)}`,
        timestamp: fallbackTimestamp(
          reference.updatedAt,
          reference.capturedAt,
          canvas.updatedAt,
          canvas.createdAt,
        ),
        boardId: canvas.id,
      });
    });

    canvas.notes.forEach((note) => {
      entries.push({
        id: `note-${canvas.id}-${note.id}`,
        kind: "note",
        title: note.text.trim() || "Board note",
        detail: `Note on ${boardTitle(canvas)}`,
        timestamp: fallbackTimestamp(note.updatedAt, note.createdAt, canvas.updatedAt),
        boardId: canvas.id,
      });
    });

    canvas.edges.forEach((edge) => {
      const timestamp = validTimestamp(edge.updatedAt) ?? validTimestamp(edge.createdAt);
      if (!timestamp) return;
      entries.push({
        id: `relationship-${canvas.id}-${edge.id}`,
        kind: "relationship",
        title: edgeTitle(edge),
        detail: edgeDetail(edge, canvas),
        timestamp,
        boardId: canvas.id,
      });
    });
  });

  const dateKeys = new Set(entries.map((entry) => entry.timestamp.slice(0, 10)));
  const itemDates = projectItems
    .map((item) => validTimestamp(item.date))
    .filter(Boolean) as string[];
  const latestCandidates = [
    project.updatedAt,
    ...projectItems.flatMap((item) => [item.updatedAt, item.date]),
    ...projectCanvases.map((canvas) => canvas.updatedAt ?? canvas.createdAt),
    ...entries.map((entry) => entry.timestamp),
  ].filter(Boolean) as string[];

  return {
    recap: {
      imageCount: projectItems.length,
      workCount: project.workItemIds.filter(
        (itemId) => projectWorkIds.has(itemId) && projectImageIds.has(itemId),
      ).length,
      boardCount: projectCanvases.length,
      referenceCount: projectCanvases.reduce(
        (count, canvas) => count + canvas.references.length,
        0,
      ),
      outputCount: outputItems.length,
      activeDays: dateKeys.size,
      firstImageDate: itemDates.length
        ? itemDates.reduce((earliest, date) => (date < earliest ? date : earliest))
        : null,
      latestSavedDate: latestCandidates.length
        ? latestCandidates.reduce((latest, date) => (date > latest ? date : latest))
        : null,
    },
    timelineGroups: groupTimeline(entries),
  };
}
