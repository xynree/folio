# Folio — MVP Project Plan

## Stack

- **Electron** + **Electron Forge** — desktop shell and build/packaging pipeline
- **React + Vite** — UI (renderer process), via `@electron-forge/plugin-vite`
- **Node.js** — file watching, filesystem ops, thumbnail generation (main process)
- **`.folio/*.json`** — split flat JSON in `~/Documents/Folio/.folio/` (`folio.json`, `tags.json`, `canvases.json`), single source of truth (no database)
- **`nativeImage`** — thumbnail generation (built into Electron, no native module needed)
- **`chokidar`** — file watching

---

## Phase 1 — Archive: drop images in, see them over time

### 1.1 Scaffold the app

- [x] Run `npm init electron-app@latest folio -- --template=vite-typescript`
- [x] Add React: install `react`, `react-dom`, `@vitejs/plugin-react`, update `vite.renderer.config.ts`
- [x] Configure `BrowserWindow`: minimum 900×600, `titleBarStyle: 'hiddenInset'`
- [x] Add React Router for strip / grid / canvas view switching

### 1.2 Define folder structure and JSON schema

- [x] Create `~/Documents/Folio/items/` and year/month folder structure on first import (e.g. `~/Documents/Folio/items/2026/02-february/`)
- [x] Create `~/Documents/Folio/references/`, `~/Documents/Folio/.folio/thumbs/` on first launch if they don't exist
- [x] Define and document the split JSON schema (folio.json, tags.json, canvases.json)
- [x] Write TypeScript types for the full schema (`src/shared/types.ts`, imported by both main and renderer)

```
~/Documents/Folio/
  items/
    2025/
      09_september/
        loose-warm-up.jpg
        gesture-study.jpg
      10_october/
        seated-figure.jpg
    2026/
      01_january/
        new-year-figure.jpg
      02_february/
        figure-study-5.jpg
        hand-gestures.png
  references/
    <canvas-id>/        ← canvas reference images, separate from archive
  .folio/               ← hidden app state (analogous to .git/)
    folio.json          ← items metadata and schema version
    tags.json           ← global tags list
    canvases.json       ← canvas structures and positions
    thumbs/             ← generated thumbnails (400px JPEGs, regenerable)
```

Folder names: year as `YYYY`, month as `MM_monthname` (e.g. `02_february`) inside the `items/` directory. Images sit loose in the month folder — no day subfolders. Folder path always determined by **import date**, never file creation date.

### 1.3 IPC bridge (preload layer)

- [x] Set `contextIsolation: true`, `nodeIntegration: false` on `BrowserWindow`
- [ ] Write `preload/index.ts` — expose `window.folio.*` API via `contextBridge`
- [x] Wire each method to an `ipcMain.handle()` in `main/index.ts`
- [ ] Add TypeScript declaration file so the renderer gets full type checking on `window.folio`

```typescript
// Invocations (renderer → main)
window.folio.getFolioData();
window.folio.saveFolioData(data);
window.folio.copyToFolio(filePaths);
window.folio.copyReference(canvasId, filePaths);
window.folio.openFileDialog();
window.folio.ensureThumbnails(itemIds);
window.folio.getReconciliationResult(); // called once on launch by renderer
window.folio.openInFinder(filename);

// Events (main → renderer)
window.folio.onFilesAdded(callback);
```

### 1.4 File watcher

- [ ] Install `chokidar`, start watching `~/Documents/Folio/` recursively (excluding `.folio/` and `references/`) from main process on app launch
- [ ] On new file detected: check hash against all known `item.hash` values — if it matches an existing item, update `item.path` and clear any `missing` flag rather than creating a duplicate entry
- [ ] On new file with no matching hash: date is always the current import date (`new Date()`), infer type from extension (`jpg/png/webp/heic` → sketch, `mp3/wav/aiff` → music, `mp4/mov/gif` → animation), generate ID with `nanoid`, append to `folio.json`, emit `files-added` IPC event
- [ ] Debounce watcher at 300ms to batch rapid drops
- [ ] On file deleted: mark item `missing: true` in `folio.json` rather than removing the entry — metadata, tags, and canvas membership are preserved

### 1.5 Filesystem operations (`main/fs.ts`)

- [x] `saveFolioData()`: atomic writes — split data and write to respective `.json.tmp` files, then rename over target files; the OS-level rename is the crash guard
- [ ] `copyToFolio()`: resolve destination as `~/Documents/Folio/items/<YYYY>/<MM-monthname>/<sanitized-name>.<ext>`, create year/month folders if needed, handle name collisions with `_2`, `_3` suffix
- [ ] `computeHash(filePath)`: read first 64KB of file, return 8-char hex hash using Node's built-in `crypto.createHash('sha256')` — fast enough for large files, unique enough for a personal archive
- [ ] `copyReference()`: copy files to `~/Documents/Folio/references/<canvas-id>/`
- [x] `loadFolioData()`: read all three `.json` files in parallel on startup; if missing, create fresh empty schemas via `initialize()`
- [ ] File sanitization helper: lowercase, spaces → hyphens, strip special characters (shared utility used by both `copyToFolio` and `copyReference`)

### 1.6 Launch reconciliation

Run once on every app launch, after `loadFolioData()`, before the UI renders. Diffs `folio.json` against what's actually on disk and surfaces any drift.

- [ ] **Scan the archive**: walk all files under `~/Documents/Folio/items/` (excluding `.folio/` and `references/`) and build a set of `{path, hash}` for every file found on disk
- [ ] **Find missing files**: items in `folio.json` whose `item.path` no longer exists on disk — mark as `missing: true`
- [ ] **Re-locate moved/renamed files**: for each missing item, check if any on-disk file has a matching `item.hash` — if found, update `item.path` to the new location, clear `missing` flag, save silently. This handles manual renames and moves in Finder with no user interaction required
- [ ] **Find untracked files**: files on disk with no matching entry in `folio.json` (no path match, no hash match) — these were added manually in Finder
- [ ] **Show reconciliation UI if needed**: if there are untracked files or genuinely missing files (missing and no hash match), show a non-blocking notice at the top of the app: `"2 new files found in your Folio folder — add to archive?"` and `"1 file is missing and couldn't be located"` — user can dismiss or resolve
- [ ] **Reconciliation is always non-destructive**: never delete metadata, never move files automatically, never block app launch — the UI is fully usable while the notice is present

### 1.7 Thumbnail generation

- [ ] Use `nativeImage.createThumbnailFromPath(path, { width: 400, height: 400 })` — built into Electron, no extra dependency
- [ ] Write generated thumbnail to `~/Folio/.folio/thumbs/<id>.jpg` via `thumb.toJPEG(80)`
- [ ] `ensureThumbnails(ids[])`: skip already-cached items, process missing ones sequentially
- [ ] For audio files: copy a static SVG waveform placeholder into the thumbs cache under that item's ID
- [ ] Renderer loads thumbnails as `<img src="file:///Users/x/Folio/.folio/thumbs/<id>.jpg" />`

### 1.8 Drop files into the app

- [ ] Renderer: `onDragOver` + `onDrop` on the root div
- [ ] Extract file paths with `webUtils.getPathForFile(file)` (Electron 28+)
- [ ] Call `window.folio.copyToFolio(paths)`, update React state with returned item objects
- [ ] Show toast: "N items added to today"
- [ ] File watcher deduplication: when `copyToFolio()` copies a file, it adds the destination path to a short-lived `recentlyCopied` Set that clears each entry after 2 seconds; when the watcher fires on that same path it checks this set first and skips without hashing — fast path for the common case

### 1.9 Import button

- [ ] Header button calls `window.folio.openFileDialog()` → main calls `dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] })`
- [ ] Same `copyToFolio` path as drag-and-drop

### 1.10 Daily strip view

- [ ] Render all dates from earliest item to today, most recent at top
- [ ] Empty date rows: faint dash line (gaps are part of the record, not hidden)
- [ ] Thumbnails lazy-loaded with `IntersectionObserver`
- [ ] Scroll position persisted in `sessionStorage`

### 1.11 Grid view

- [ ] CSS grid: `auto-fill, minmax(148px, 1fr)`
- [ ] Type filter pills in header: all / sketch / ref / music / anim
- [ ] Same lazy thumbnail loading as strip

### 1.12 Status bar

- [ ] Display: N items · N canvases · N tags · N gaps · `~/Documents/Folio/`

---

## Phase 2 — Organize: tags and canvases

### 2.1 Detail drawer

- [ ] Single click on any item opens drawer (slides up from bottom)
- [ ] Show: thumbnail preview, title (editable inline), date, file type, canvas membership
- [ ] Inline title edit: update React state immediately, debounce `saveFolioData` 500ms
- [ ] "Show in Finder" button: `window.folio.openInFinder(filename)`
- [ ] Click outside or press Escape to close

### 2.2 Tags

- [ ] Tag input in drawer: type name + Enter to add, × to remove
- [ ] Store as strings in `item.tags[]`, deduplicate in `folio.json.tags`
- [ ] Show tag chips on grid cards and in detail drawer
- [ ] Sidebar TAGS section: list all tags with item count, expand to see thumbnail strip
- [ ] Clicking a tag in sidebar filters the active view to items with that tag

### 2.3 Multi-select

- [ ] ⌘+click (macOS) / Ctrl+click to toggle selection
- [ ] Shift+click for range select in grid view
- [ ] Amber border on selected items
- [ ] Selection hint bar: "N selected — drag onto a canvas or open on new canvas →"
- [ ] Escape or click background to clear selection

### 2.4 Open items on a canvas

- [ ] With items selected in strip/grid, user can drag them directly onto an open canvas, or use "open on new canvas" to create a blank canvas pre-populated with the selection
- [ ] New canvas: prompt for name + optional opening note, auto-assign color from warm palette, save to `folio.json`
- [ ] Items can appear on multiple canvases simultaneously — canvas membership reflects what's been dragged onto each canvas

### 2.5 Canvas sidebar list

- [ ] Each canvas row: colored dot, name, item count, ◎N ref badge, ✎N note badge, ✦N edge badge
- [ ] Expand canvas: italic opening note, member thumbnail grid (max 8), "open canvas" button
- [ ] "Open canvas" navigates to the canvas view with that canvas loaded
- [ ] Canvas dots shown under strip thumbnails (one colored dot per canvas membership)
- [ ] Canvas chips shown in detail drawer

---

## Phase 3 — Canvas: the thinking surface

### 3.1 Canvas view entry

- [ ] Canvas tab shows list of existing canvases + "new canvas" button when no canvas is open
- [ ] Opening a canvas from the sidebar loads its items, positions, notes, edges, and strokes exactly as left
- [ ] Toolbar shows: colored dot + canvas name (editable) + "N items · N notes · N connections"
- [ ] Switching canvas: auto-save current state to `folio.json` before loading the next

### 3.2 Draggable item cards and drag-in from strip/grid

- [ ] Items positioned absolutely on a large scrollable canvas surface (2400×1800px to give room to spread)
- [ ] Drag: mousedown → track mousemove delta → mouseup saves position to `folio.json`
- [ ] Positions stored per canvas in `folio.json` under `canvas.positions`
- [ ] Items can be dragged directly from the strip or grid view onto an open canvas — they appear at the drop position
- [ ] First-time layout: auto-arrange in a loose grid if no saved positions
- [ ] Dotted grid background: 24px radial-gradient pattern

### 3.3 Canvas notes

- [ ] "+ note" in toolbar: create note card centered in current scroll viewport
- [ ] Note card: amber drag-handle strip, auto-resizing textarea, delete link in footer
- [ ] Click note body to enter edit mode, blur to save and exit
- [ ] Empty note on blur: auto-delete
- [ ] Escape exits edit mode without deleting
- [ ] Delete link visible only while editing
- [ ] Notes saved to `canvas.notes[]` in `folio.json`

### 3.4 References on the canvas

Reference images belong to a canvas, not to items. They are first-class positionable objects on the canvas surface — drag them around alongside items and notes.

- [ ] Drop image files directly onto the canvas to add a reference at the drop position
- [ ] Browse button in toolbar: `window.folio.openFileDialog()` → `copyReference(canvasId, paths)` — drops new reference at a default position near the centre of the current viewport
- [ ] References file to `~/Folio/references/<canvasId>/` on disk, never into the main archive
- [ ] Reference card on canvas: thumbnail, drag handle, × remove button (deletes file from disk + removes from `folio.json`)
- [ ] Reference cards can be moved freely like item cards — position saved to `canvas.references[].x/y`
- [ ] Edges can connect reference cards to item cards (same `CanvasEdge` mechanism — `fromId`/`toId` can point to either)

### 3.5 Edges (connections between items)

- [ ] Hold Shift and drag from one item card to another to draw a connection edge
- [ ] Edge renders as a curved line between the two cards, with an optional label
- [ ] Click an edge to select it; double-click to edit the label inline
- [ ] Delete selected edge with Backspace/Delete
- [ ] Edges stored as `{ id, fromId, toId, label? }` in `canvas.edges[]`
- [ ] Edges update position dynamically as cards are dragged

### 3.6 Freehand strokes

- [ ] Pen tool in canvas toolbar toggles freehand drawing mode
- [ ] Draw directly on the canvas surface — to circle items, annotate, sketch quick marks
- [ ] Strokes render as SVG paths overlaid on the canvas
- [ ] Stroke color inherits canvas color by default, picker available in toolbar
- [ ] Strokes stored as `{ id, path, color }` in `canvas.strokes[]`
- [ ] Undo (⌘Z) removes last stroke

---

## Cross-cutting concerns

### Data integrity

- [ ] All `folio.json` writes atomic: write `.folio/folio.json.tmp` → rename over `.folio/folio.json` (OS rename is crash-safe; no `.bak` file)
- [ ] Schema validation on load: check `version` field and required keys; surface a clear error to the user if invalid (no `.bak` fallback)
- [ ] React state is live working copy; debounced save (500ms) on every meaningful change
- [ ] Every item carries a `hash` (first-64KB SHA-256, truncated to 8 hex chars) used to re-locate files that were renamed or moved outside the app
- [ ] Every item carries a `missing` boolean — set when a file can't be found and no hash match exists; cleared automatically if the file reappears
- [ ] Canvas membership is derived from `canvas.itemIds[]` — no separate denormalized list on items
- [ ] Reconciliation runs at every launch: silent auto-fix for moved files, non-blocking notice for untracked or genuinely missing files

### IPC security

- [ ] `contextIsolation: true`, `nodeIntegration: false` on all windows
- [ ] Validate and sanitize all IPC arguments in main process before acting

### Performance

- [ ] Thumbnails generated in a sequential async queue, never blocking the main process event loop
- [ ] Strip and grid use `IntersectionObserver` for lazy loading
- [ ] `folio.json` read once at startup, kept in memory, written only on change
- [ ] `recentlyCopied` is an in-memory `Set<string>` on the main process; entries are added by `copyToFolio()` and auto-deleted after 2 seconds via `setTimeout`
- [ ] File watcher debounced at 300ms

### File naming and paths

- [ ] Destination resolved from import date: `~/Documents/Folio/items/YYYY/MM_monthname/` (e.g. `~/Documents/Folio/items/2026/02_february/`)
- [ ] Month folder format: zero-padded number + full lowercase name — `01_january` through `12_december`
- [ ] Filename: original name, sanitized — lowercase, spaces → hyphens, special characters stripped
- [ ] Name collision within the same month folder: append `_2`, `_3`, etc. before the extension
- [ ] `item.title` defaults to sanitized filename without extension; user can rename at any time
- [ ] `item.path` stores relative path from `~/Documents/Folio/` (e.g. `items/2026/02_february/figure-study.jpg`) — used to locate files and rebuild thumbnails if the cache is deleted

### Accepted file types

- [ ] Images: `jpg`, `jpeg`, `png`, `gif`, `webp`, `heic`, `avif`
- [ ] Audio: `mp3`, `wav`, `aiff`, `m4a`
- [ ] Video: `mp4`, `mov`
- [ ] Reject anything else with a toast message, copy nothing

### Packaging

- [ ] `forge.config.ts`: add `@electron-forge/maker-dmg` for macOS `.dmg`
- [ ] Confirm all three Vite targets (main, preload, renderer) build cleanly
- [ ] Code-sign with Apple Developer certificate for Gatekeeper
- [ ] Windows later: add `@electron-forge/maker-squirrel`, no other changes needed

---

## Out of scope for MVP

- Social / sharing / circle
- Velocity heatmap
- Juxtapose view
- Rediscovery nudge
- Cloud sync
- Mobile
- Windows (macOS first)

---

## Schedule

| Phase     | Milestone                                   | Est. effort         |
| --------- | ------------------------------------------- | ------------------- |
| 1.1–1.3   | Scaffold + IPC bridge + schema              | 3–4 days            |
| 1.4–1.5   | File watcher + filesystem ops               | 3–4 days            |
| 1.6–1.7   | Reconciliation + thumbnails                 | 3–4 days            |
| 1.8–1.9   | File drop + import button                   | 2–3 days            |
| 1.10–1.12 | Strip + grid + status bar                   | 4–5 days            |
| 2.1–2.3   | Detail drawer + tags + multi-select         | 4–5 days            |
| 2.4–2.5   | Canvases: create, open, sidebar list        | 3–4 days            |
| 3.1–3.3   | Canvas view + drag-in + notes               | 5–6 days            |
| 3.4–3.6   | References panel + edges + strokes          | 3–4 days            |
| Polish    | Empty states, errors, edge cases, packaging | 4–5 days            |
| **Total** |                                             | **~7–8 weeks solo** |
