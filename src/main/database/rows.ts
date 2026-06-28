/**
 * Row types — the shapes returned by better-sqlite3 for each table.
 * JSON array/object columns are stored as strings and parsed by the
 * converters in converters.ts.
 */

export interface ItemRow {
  id: string;
  path: string;
  hash: string;
  type: string;
  date: string;
  title: string;
  description: string;
  tagIds: string;
  mediaWidth: number | null;
  mediaHeight: number | null;
  projectId: string | null;
  stage: string | null;
  sourceCreatedAt: string | null;
  updatedAt: string | null;
  missing: number;
}

export interface TagRow {
  id: string;
  text: string;
}

export interface ProjectRow {
  id: string;
  title: string;
  description: string;
  status: string | null;
  createdAt: string;
  updatedAt: string;
  workUpdatedAt: string | null;
  folderPath: string;
  imageIds: string;
  workItemIds: string;
  boardIds: string;
  reviews: string;
}

export interface CanvasRow {
  id: string;
  title: string;
  description: string | null;
  color: string | null;
  projectId: string | null;
  kind: string | null;
  status: string | null;
  brief: string | null;
  outcome: string | null;
  startedAt: string | null;
  targetDate: string | null;
  completedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  itemIds: string;
  noteIds: string;
  positions: string;
  notes: string;
  edges: string;
  strokes: string | null;
  texts: string | null;
  sections: string | null;
  links: string | null;
  viewport: string | null;
  createdFromTemplate: string | null;
}

export interface NoteRow {
  id: string;
  title: string;
  path: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}
