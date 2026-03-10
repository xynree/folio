import path from "node:path";
import { FolioData } from "../types";
import fs from "node:fs/promises";
import { SCHEMA_VERSION } from "../constants";

/**
 * Initializes the local filesystem structure and standard schema.
 * This runs on every boot to ensure the environment is correct.
 */
export async function initialize(app: Electron.App) {
  const FOLIO_ROOT = path.join(app.getPath("home"), "Documents", "Folio");
  const DOT_FOLIO = path.join(FOLIO_ROOT, ".folio");
  const DATABASE_PATH = path.join(DOT_FOLIO, "folio.json");

  // 1. Create the base Folio folder and all required subdirectories.
  // Using { recursive: true } makes this idempotent (safe to run multiple times).
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

  // 2. Check for folio.json. If it's missing, seed it with the default empty schema.
  try {
    await fs.access(DATABASE_PATH);
  } catch {
    const defaultData: FolioData = {
      version: SCHEMA_VERSION,
      items: [],
      canvases: [],
      tags: [],
    };
    await fs.writeFile(DATABASE_PATH, JSON.stringify(defaultData, null, 2));
  }
}
