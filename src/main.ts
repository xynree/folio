import { app, BrowserWindow } from "electron";
import path from "node:path";
import started from "electron-squirrel-startup";
import { FolioData } from "./types";
import fs from "node:fs/promises";
import { SCHEMA_VERSION } from "./constants";

// CONSTANTS
export const FOLIO_ROOT = path.join(app.getPath("home"), "Documents", "Folio");
const DOT_FOLIO = path.join(FOLIO_ROOT, ".folio");
const DATABASE_PATH = path.join(DOT_FOLIO, "folio.json");

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", async () => {
  // Ensure folder structure and database are ready before creating the window
  await initialize();
  createWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

/**
 * Initializes the local filesystem structure and standard schema.
 * This runs on every boot to ensure the environment is correct.
 */
export async function initialize() {
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
