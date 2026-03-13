import path from "node:path";
import fs from "node:fs/promises";
import { SCHEMA_VERSION } from "../constants";
import { FolioItem, Tag, Canvas } from "../types";

/**
 * Initializes the local filesystem structure and standard schema.
 * This runs on every boot to ensure the environment is correct.
 */
export async function initialize(app: Electron.App) {
  const FOLIO_ROOT = path.join(app.getPath("home"), "Documents", "Folio");
  const DOT_FOLIO = path.join(FOLIO_ROOT, ".folio");

  // 1. Create the base Folio folder and all required subdirectories.
  const currentYear = new Date().getFullYear().toString();
  const dirs = [
    FOLIO_ROOT,
    path.join(FOLIO_ROOT, "references"),
    path.join(FOLIO_ROOT, "items"),
    path.join(FOLIO_ROOT, "items", currentYear),
    DOT_FOLIO,
    path.join(DOT_FOLIO, "thumbs"),
  ];

  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }

  // 2. Check for data files. Seed them with default empty schemas if missing.
  const files = [
    {
      path: path.join(DOT_FOLIO, "folio.json"),
      default: { version: SCHEMA_VERSION, items: [] as FolioItem[] },
    },
    {
      path: path.join(DOT_FOLIO, "tags.json"),
      default: { version: SCHEMA_VERSION, tags: [] as Tag[] },
    },
    {
      path: path.join(DOT_FOLIO, "canvases.json"),
      default: { version: SCHEMA_VERSION, canvases: [] as Canvas[] },
    },
  ];

  for (const file of files) {
    try {
      await fs.access(file.path);
    } catch {
      await fs.writeFile(file.path, JSON.stringify(file.default, null, 2));
    }
  }
}
