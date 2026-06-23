import path from "node:path";
import fs from "node:fs/promises";
import type { Canvas, FolioItem, Project, Tag } from "../types";
import { DB_FILE_NAME, FolioDB } from "./database";

/**
 * Initializes the local filesystem structure and SQLite database.
 * On first run after the JSON-to-SQLite migration, any existing JSON metadata
 * files are imported into the new database and left in place as read-only
 * archives (not deleted, in case the user needs them for recovery).
 *
 * @param folioRoot Absolute path of the active Folio folder (Documents or iCloud Drive).
 */
export async function initialize(app: Electron.App, folioRoot?: string) {
  const FOLIO_ROOT =
    folioRoot ?? path.join(app.getPath("home"), "Documents", "Folio");
  const DOT_FOLIO = path.join(FOLIO_ROOT, ".folio");

  // 1. Create the base Folio folder and all required subdirectories.
  const dirs = [
    FOLIO_ROOT,
    path.join(FOLIO_ROOT, "projects"),
    DOT_FOLIO,
    path.join(DOT_FOLIO, "thumbs"),
  ];
  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }

  // 2. Open (or create) the SQLite database. The FolioDB constructor creates
  //    all tables via CREATE TABLE IF NOT EXISTS, so this is safe on every boot.
  const db = new FolioDB(path.join(DOT_FOLIO, DB_FILE_NAME));

  // 3. One-time migration: if the DB is empty and legacy JSON files exist,
  //    read them and seed the database. The JSON files are left in place.
  if (db.isEmpty()) {
    const legacyData = await readLegacyJsonData(DOT_FOLIO);
    if (legacyData !== null) {
      db.importFromFolioData(legacyData);
    }
  }

  db.close();
}

// ---------------------------------------------------------------------------
// Legacy JSON reader — used only during the one-time migration
// ---------------------------------------------------------------------------

interface LegacyFolioJson {
  items?: FolioItem[];
}
interface LegacyTagsJson {
  tags?: Tag[];
}
interface LegacyCanvasesJson {
  canvases?: Canvas[];
}
interface LegacyProjectsJson {
  projects?: Project[];
}

async function tryReadJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf-8")) as T;
  } catch {
    return null;
  }
}

async function readLegacyJsonData(dotFolio: string): Promise<{
  items: FolioItem[];
  tags: Tag[];
  canvases: Canvas[];
  projects: Project[];
} | null> {
  const [folioJson, tagsJson, canvasesJson, projectsJson] = await Promise.all([
    tryReadJson<LegacyFolioJson>(path.join(dotFolio, "folio.json")),
    tryReadJson<LegacyTagsJson>(path.join(dotFolio, "tags.json")),
    tryReadJson<LegacyCanvasesJson>(path.join(dotFolio, "canvases.json")),
    tryReadJson<LegacyProjectsJson>(path.join(dotFolio, "projects.json")),
  ]);

  // If none of the JSON files exist, there is nothing to migrate.
  if (!folioJson && !tagsJson && !canvasesJson && !projectsJson) return null;

  return {
    items: folioJson?.items ?? [],
    tags: tagsJson?.tags ?? [],
    canvases: canvasesJson?.canvases ?? [],
    projects: projectsJson?.projects ?? [],
  };
}

