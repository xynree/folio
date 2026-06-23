/**
 * Row ↔ domain converters — translate between the flat SQLite row shapes
 * (from rows.ts) and the richer TypeScript domain types used by the app.
 * JSON columns are serialised to/from strings here so the rest of the app
 * never deals with raw JSON strings.
 */

import type { Canvas, FolioItem, Project, Tag } from "../../types";
import type { CanvasRow, ItemRow, ProjectRow, TagRow } from "./rows";

export function rowToItem(row: ItemRow): FolioItem {
  const item: FolioItem = {
    id: row.id,
    path: row.path,
    hash: row.hash,
    type: row.type as FolioItem["type"],
    date: row.date,
    title: row.title,
    description: row.description,
    tagIds: JSON.parse(row.tagIds) as string[],
  };
  if (row.mediaWidth !== null) item.mediaWidth = row.mediaWidth;
  if (row.mediaHeight !== null) item.mediaHeight = row.mediaHeight;
  if (row.projectId !== null) item.projectId = row.projectId;
  if (row.stage !== null) item.stage = row.stage as FolioItem["stage"];
  if (row.sourceCreatedAt !== null) item.sourceCreatedAt = row.sourceCreatedAt;
  if (row.updatedAt !== null) item.updatedAt = row.updatedAt;
  if (row.missing !== 0) item.missing = true;
  return item;
}

export function itemToRow(item: FolioItem): Record<string, unknown> {
  return {
    id: item.id,
    path: item.path,
    hash: item.hash,
    type: item.type,
    date: item.date,
    title: item.title,
    description: item.description ?? "",
    tagIds: JSON.stringify(item.tagIds ?? []),
    mediaWidth: item.mediaWidth ?? null,
    mediaHeight: item.mediaHeight ?? null,
    projectId: item.projectId ?? null,
    stage: item.stage ?? null,
    sourceCreatedAt: item.sourceCreatedAt ?? null,
    updatedAt: item.updatedAt ?? null,
    missing: item.missing ? 1 : 0,
  };
}

export function rowToTag(row: TagRow): Tag {
  return { id: row.id, text: row.text };
}

export function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status as Project["status"] | undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    workUpdatedAt: row.workUpdatedAt ?? undefined,
    folderPath: row.folderPath,
    imageIds: JSON.parse(row.imageIds) as string[],
    workItemIds: JSON.parse(row.workItemIds) as string[],
    boardIds: JSON.parse(row.boardIds) as string[],
    reviews: JSON.parse(row.reviews) as Project["reviews"],
  };
}

export function projectToRow(project: Project): Record<string, unknown> {
  return {
    id: project.id,
    title: project.title,
    description: project.description ?? "",
    status: project.status ?? null,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    workUpdatedAt: project.workUpdatedAt ?? null,
    folderPath: project.folderPath,
    imageIds: JSON.stringify(project.imageIds ?? []),
    workItemIds: JSON.stringify(project.workItemIds ?? []),
    boardIds: JSON.stringify(project.boardIds ?? []),
    reviews: JSON.stringify(project.reviews ?? []),
  };
}

export function rowToCanvas(row: CanvasRow): Canvas {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    color: row.color ?? undefined,
    projectId: row.projectId ?? undefined,
    kind: row.kind as Canvas["kind"] | undefined,
    status: row.status as Canvas["status"] | undefined,
    brief: row.brief ?? undefined,
    outcome: row.outcome ?? undefined,
    startedAt: row.startedAt ?? undefined,
    targetDate: row.targetDate ?? undefined,
    completedAt: row.completedAt ?? undefined,
    createdAt: row.createdAt ?? undefined,
    updatedAt: row.updatedAt ?? undefined,
    itemIds: JSON.parse(row.itemIds) as string[],
    positions: JSON.parse(row.positions) as Canvas["positions"],
    notes: JSON.parse(row.notes) as Canvas["notes"],
    edges: JSON.parse(row.edges) as Canvas["edges"],
    strokes: row.strokes ? (JSON.parse(row.strokes) as Canvas["strokes"]) : undefined,
    texts: row.texts ? (JSON.parse(row.texts) as Canvas["texts"]) : undefined,
    sections: row.sections ? (JSON.parse(row.sections) as Canvas["sections"]) : undefined,
    links: row.links ? (JSON.parse(row.links) as Canvas["links"]) : undefined,
    viewport: row.viewport ? (JSON.parse(row.viewport) as Canvas["viewport"]) : undefined,
    createdFromTemplate: row.createdFromTemplate ?? undefined,
  };
}

export function canvasToRow(canvas: Canvas): Record<string, unknown> {
  return {
    id: canvas.id,
    title: canvas.title,
    description: canvas.description ?? null,
    color: canvas.color ?? null,
    projectId: canvas.projectId ?? null,
    kind: canvas.kind ?? null,
    status: canvas.status ?? null,
    brief: canvas.brief ?? null,
    outcome: canvas.outcome ?? null,
    startedAt: canvas.startedAt ?? null,
    targetDate: canvas.targetDate ?? null,
    completedAt: canvas.completedAt ?? null,
    createdAt: canvas.createdAt ?? null,
    updatedAt: canvas.updatedAt ?? null,
    itemIds: JSON.stringify(canvas.itemIds ?? []),
    positions: JSON.stringify(canvas.positions ?? {}),
    notes: JSON.stringify(canvas.notes ?? []),
    edges: JSON.stringify(canvas.edges ?? []),
    strokes: canvas.strokes ? JSON.stringify(canvas.strokes) : null,
    texts: canvas.texts ? JSON.stringify(canvas.texts) : null,
    sections: canvas.sections ? JSON.stringify(canvas.sections) : null,
    links: canvas.links ? JSON.stringify(canvas.links) : null,
    viewport: canvas.viewport ? JSON.stringify(canvas.viewport) : null,
    createdFromTemplate: canvas.createdFromTemplate ?? null,
  };
}
