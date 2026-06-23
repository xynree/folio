import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type { Canvas, FolioData, FolioItem, Project, Tag } from "../../types";
import { SCHEMA_VERSION } from "../../constants";
import { SCHEMA_SQL } from "./schema";
import type { CanvasRow, ItemRow, ProjectRow, TagRow } from "./rows";
import {
  canvasToRow,
  itemToRow,
  projectToRow,
  rowToCanvas,
  rowToItem,
  rowToProject,
  rowToTag,
} from "./converters";

/**
 * FolioDB — the single SQLite connection for the Folio main process.
 *
 * All methods are synchronous (better-sqlite3 design), which is safe on the
 * Electron main thread. Passing `':memory:'` creates a transient in-memory
 * database useful in tests.
 */
export class FolioDB {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    if (dbPath !== ":memory:") {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.exec(SCHEMA_SQL);
  }

  close(): void {
    this.db.close();
  }

  // -------------------------------------------------------------------------
  // Items
  // -------------------------------------------------------------------------

  getItems(): FolioItem[] {
    return (this.db.prepare("SELECT * FROM items").all() as ItemRow[]).map(
      rowToItem,
    );
  }

  upsertItem(item: FolioItem): void {
    this.db
      .prepare(
        `INSERT INTO items
           (id, path, hash, type, date, title, description, tagIds,
            mediaWidth, mediaHeight, projectId, stage, sourceCreatedAt,
            updatedAt, missing)
         VALUES
           (@id, @path, @hash, @type, @date, @title, @description, @tagIds,
            @mediaWidth, @mediaHeight, @projectId, @stage, @sourceCreatedAt,
            @updatedAt, @missing)
         ON CONFLICT(id) DO UPDATE SET
           path=excluded.path, hash=excluded.hash, type=excluded.type,
           date=excluded.date, title=excluded.title,
           description=excluded.description, tagIds=excluded.tagIds,
           mediaWidth=excluded.mediaWidth, mediaHeight=excluded.mediaHeight,
           projectId=excluded.projectId, stage=excluded.stage,
           sourceCreatedAt=excluded.sourceCreatedAt,
           updatedAt=excluded.updatedAt, missing=excluded.missing`,
      )
      .run(itemToRow(item));
  }

  setItems(items: FolioItem[]): void {
    const upsert = this.db.prepare(
      `INSERT INTO items
         (id, path, hash, type, date, title, description, tagIds,
          mediaWidth, mediaHeight, projectId, stage, sourceCreatedAt,
          updatedAt, missing)
       VALUES
         (@id, @path, @hash, @type, @date, @title, @description, @tagIds,
          @mediaWidth, @mediaHeight, @projectId, @stage, @sourceCreatedAt,
          @updatedAt, @missing)
       ON CONFLICT(id) DO UPDATE SET
         path=excluded.path, hash=excluded.hash, type=excluded.type,
         date=excluded.date, title=excluded.title,
         description=excluded.description, tagIds=excluded.tagIds,
         mediaWidth=excluded.mediaWidth, mediaHeight=excluded.mediaHeight,
         projectId=excluded.projectId, stage=excluded.stage,
         sourceCreatedAt=excluded.sourceCreatedAt,
         updatedAt=excluded.updatedAt, missing=excluded.missing`,
    );
    const deleteRemoved = this.db.prepare(
      "DELETE FROM items WHERE id NOT IN (SELECT value FROM json_each(?))",
    );
    const deleteAll = this.db.prepare("DELETE FROM items");

    this.db.transaction(() => {
      for (const item of items) upsert.run(itemToRow(item));
      if (items.length > 0) {
        deleteRemoved.run(JSON.stringify(items.map((item) => item.id)));
      } else {
        deleteAll.run();
      }
    })();
  }

  deleteItems(ids: string[]): void {
    if (!ids.length) return;
    const placeholders = ids.map(() => "?").join(", ");
    this.db
      .prepare(`DELETE FROM items WHERE id IN (${placeholders})`)
      .run(...ids);
  }

  // -------------------------------------------------------------------------
  // Tags
  // -------------------------------------------------------------------------

  getTags(): Tag[] {
    return (this.db.prepare("SELECT * FROM tags").all() as TagRow[]).map(
      rowToTag,
    );
  }

  upsertTag(tag: Tag): void {
    this.db
      .prepare(
        `INSERT INTO tags (id, text)
         VALUES (@id, @text)
         ON CONFLICT(id) DO UPDATE SET text=excluded.text`,
      )
      .run(tag);
  }

  setTags(tags: Tag[]): void {
    const upsert = this.db.prepare(
      `INSERT INTO tags (id, text)
       VALUES (@id, @text)
       ON CONFLICT(id) DO UPDATE SET text=excluded.text`,
    );
    const deleteRemoved = this.db.prepare(
      "DELETE FROM tags WHERE id NOT IN (SELECT value FROM json_each(?))",
    );
    const deleteAll = this.db.prepare("DELETE FROM tags");

    this.db.transaction(() => {
      for (const tag of tags) upsert.run(tag);
      if (tags.length > 0) {
        deleteRemoved.run(JSON.stringify(tags.map((tag) => tag.id)));
      } else {
        deleteAll.run();
      }
    })();
  }

  // -------------------------------------------------------------------------
  // Projects
  // -------------------------------------------------------------------------

  getProjects(): Project[] {
    return (
      this.db.prepare("SELECT * FROM projects").all() as ProjectRow[]
    ).map(rowToProject);
  }

  upsertProject(project: Project): void {
    this.db
      .prepare(
        `INSERT INTO projects
           (id, title, description, status, createdAt, updatedAt,
            workUpdatedAt, folderPath, imageIds, workItemIds, boardIds, reviews)
         VALUES
           (@id, @title, @description, @status, @createdAt, @updatedAt,
            @workUpdatedAt, @folderPath, @imageIds, @workItemIds, @boardIds, @reviews)
         ON CONFLICT(id) DO UPDATE SET
           title=excluded.title, description=excluded.description,
           status=excluded.status, updatedAt=excluded.updatedAt,
           workUpdatedAt=excluded.workUpdatedAt, folderPath=excluded.folderPath,
           imageIds=excluded.imageIds, workItemIds=excluded.workItemIds,
           boardIds=excluded.boardIds, reviews=excluded.reviews`,
      )
      .run(projectToRow(project));
  }

  setProjects(projects: Project[]): void {
    const upsert = this.db.prepare(
      `INSERT INTO projects
         (id, title, description, status, createdAt, updatedAt,
          workUpdatedAt, folderPath, imageIds, workItemIds, boardIds, reviews)
       VALUES
         (@id, @title, @description, @status, @createdAt, @updatedAt,
          @workUpdatedAt, @folderPath, @imageIds, @workItemIds, @boardIds, @reviews)
       ON CONFLICT(id) DO UPDATE SET
         title=excluded.title, description=excluded.description,
         status=excluded.status, updatedAt=excluded.updatedAt,
         workUpdatedAt=excluded.workUpdatedAt, folderPath=excluded.folderPath,
         imageIds=excluded.imageIds, workItemIds=excluded.workItemIds,
         boardIds=excluded.boardIds, reviews=excluded.reviews`,
    );
    const deleteRemoved = this.db.prepare(
      "DELETE FROM projects WHERE id NOT IN (SELECT value FROM json_each(?))",
    );
    const deleteAll = this.db.prepare("DELETE FROM projects");

    this.db.transaction(() => {
      for (const project of projects) upsert.run(projectToRow(project));
      if (projects.length > 0) {
        deleteRemoved.run(
          JSON.stringify(projects.map((project) => project.id)),
        );
      } else {
        deleteAll.run();
      }
    })();
  }

  // -------------------------------------------------------------------------
  // Canvases
  // -------------------------------------------------------------------------

  getCanvases(): Canvas[] {
    return (
      this.db.prepare("SELECT * FROM canvases").all() as CanvasRow[]
    ).map(rowToCanvas);
  }

  upsertCanvas(canvas: Canvas): void {
    this.db
      .prepare(
        `INSERT INTO canvases
           (id, title, description, color, projectId, kind, status, brief,
            outcome, startedAt, targetDate, completedAt, createdAt, updatedAt,
            itemIds, positions, notes, edges, strokes, texts, sections, links,
            viewport, createdFromTemplate)
         VALUES
           (@id, @title, @description, @color, @projectId, @kind, @status, @brief,
            @outcome, @startedAt, @targetDate, @completedAt, @createdAt, @updatedAt,
            @itemIds, @positions, @notes, @edges, @strokes, @texts, @sections, @links,
            @viewport, @createdFromTemplate)
         ON CONFLICT(id) DO UPDATE SET
           title=excluded.title, description=excluded.description,
           color=excluded.color, projectId=excluded.projectId,
           kind=excluded.kind, status=excluded.status, brief=excluded.brief,
           outcome=excluded.outcome, startedAt=excluded.startedAt,
           targetDate=excluded.targetDate, completedAt=excluded.completedAt,
           createdAt=excluded.createdAt, updatedAt=excluded.updatedAt,
           itemIds=excluded.itemIds, positions=excluded.positions,
           notes=excluded.notes, edges=excluded.edges, strokes=excluded.strokes,
           texts=excluded.texts, sections=excluded.sections, links=excluded.links,
           viewport=excluded.viewport,
           createdFromTemplate=excluded.createdFromTemplate`,
      )
      .run(canvasToRow(canvas));
  }

  setCanvases(canvases: Canvas[]): void {
    const upsert = this.db.prepare(
      `INSERT INTO canvases
         (id, title, description, color, projectId, kind, status, brief,
          outcome, startedAt, targetDate, completedAt, createdAt, updatedAt,
          itemIds, positions, notes, edges, strokes, texts, sections, links,
          viewport, createdFromTemplate)
       VALUES
         (@id, @title, @description, @color, @projectId, @kind, @status, @brief,
          @outcome, @startedAt, @targetDate, @completedAt, @createdAt, @updatedAt,
          @itemIds, @positions, @notes, @edges, @strokes, @texts, @sections, @links,
          @viewport, @createdFromTemplate)
       ON CONFLICT(id) DO UPDATE SET
         title=excluded.title, description=excluded.description,
         color=excluded.color, projectId=excluded.projectId,
         kind=excluded.kind, status=excluded.status, brief=excluded.brief,
         outcome=excluded.outcome, startedAt=excluded.startedAt,
         targetDate=excluded.targetDate, completedAt=excluded.completedAt,
         createdAt=excluded.createdAt, updatedAt=excluded.updatedAt,
         itemIds=excluded.itemIds, positions=excluded.positions,
         notes=excluded.notes, edges=excluded.edges, strokes=excluded.strokes,
         texts=excluded.texts, sections=excluded.sections, links=excluded.links,
         viewport=excluded.viewport,
         createdFromTemplate=excluded.createdFromTemplate`,
    );
    const deleteRemoved = this.db.prepare(
      "DELETE FROM canvases WHERE id NOT IN (SELECT value FROM json_each(?))",
    );
    const deleteAll = this.db.prepare("DELETE FROM canvases");

    this.db.transaction(() => {
      for (const canvas of canvases) upsert.run(canvasToRow(canvas));
      if (canvases.length > 0) {
        deleteRemoved.run(
          JSON.stringify(canvases.map((canvas) => canvas.id)),
        );
      } else {
        deleteAll.run();
      }
    })();
  }

  // -------------------------------------------------------------------------
  // Bulk operations
  // -------------------------------------------------------------------------

  /**
   * Replaces all four collections atomically. A crash mid-write leaves the
   * previous state intact (SQLite WAL rollback).
   */
  setFolioData(data: {
    items: FolioItem[];
    tags: Tag[];
    canvases: Canvas[];
    projects: Project[];
  }): void {
    this.db.transaction(() => {
      this.setItems(data.items);
      this.setTags(data.tags);
      this.setCanvases(data.canvases);
      this.setProjects(data.projects);
    })();
  }

  getFolioData(): FolioData {
    return {
      version: SCHEMA_VERSION,
      items: this.getItems(),
      tags: this.getTags(),
      canvases: this.getCanvases(),
      projects: this.getProjects(),
    };
  }

  // -------------------------------------------------------------------------
  // Migration
  // -------------------------------------------------------------------------

  /**
   * Returns true when none of the four tables contain any rows, meaning it is
   * safe to seed the database from legacy JSON files.
   */
  isEmpty(): boolean {
    const count = (
      this.db
        .prepare(
          `SELECT
             (SELECT count(*) FROM items)    +
             (SELECT count(*) FROM tags)     +
             (SELECT count(*) FROM canvases) +
             (SELECT count(*) FROM projects) AS total`,
        )
        .get() as { total: number }
    ).total;
    return count === 0;
  }

  /** Bulk-inserts data from a legacy JSON snapshot. Skips rows that already exist. */
  importFromFolioData(data: Partial<FolioData>): void {
    this.db.transaction(() => {
      for (const item of data.items ?? []) this.upsertItem(item);
      for (const tag of data.tags ?? []) this.upsertTag(tag);
      for (const canvas of data.canvases ?? []) this.upsertCanvas(canvas);
      for (const project of data.projects ?? []) this.upsertProject(project);
    })();
  }
}

/** Filename of the SQLite database inside the .folio metadata folder. */
export const DB_FILE_NAME = "folio.db";
