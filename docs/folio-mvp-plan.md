# Folio — MVP Project Plan

## Stack

- **Electron** + **Electron Forge** — desktop shell and build/packaging pipeline
- **React + Vite** — UI (renderer process), via `@electron-forge/plugin-vite`
- **Node.js** — file watching, filesystem ops, thumbnail generation (main process)
- **`.folio/folio.json`** — flat JSON sidecar in `~/Folio/.folio/`, single source of truth (no database)
- **`nativeImage`** — thumbnail generation (built into Electron, no native module needed)
- **`chokidar`** — file watching

---

## Phase 1 — Archive: drop images in, see them over time

### 1.1 Scaffold the app

- [x] Run `npm init electron-app@latest folio -- --template=vite-typescript`
- [x] Add React: install `react`, `react-dom`, `@vitejs/plugin-react`, update `vite.renderer.config.ts`
- [ ] Configure `BrowserWindow`: minimum 900×600, `titleBarStyle: 'hiddenInset'`
- [ ] Add React Router for strip / grid / arrange view switching

### 1.2 Define folder structure and JSON schema

- [ ] Create year/month folder structure on first import if it doesn't exist (e.g. `~/Folio/2026/02-february/`)
- [ ] Create `~/Folio/references/`, `~/Folio/.folio/thumbs/` on first launch if they don't exist
- [ ] Define and document the `folio.json` schema (items, piles, tags, canvas state)
- [ ] Write TypeScript types for the full schema (`src/shared/types.ts`, imported by both main and renderer)

```
~/Folio/
  2025/
    09-september/
      loose-warm-up.jpg
      gesture-study.jpg
    10-october/
      seated-figure.jpg
  2026/
    01-january/
      new-year-figure.jpg
    02-february/
      figure-study-5.jpg
      hand-gestures.png
  references/
    <pile-id>/          ← pile reference images, separate from archive
  .folio/
    folio.json          ← hidden from Finder by default; all app state lives here
    thumbs/             ← generated thumbnails (400px JPEGs)
```

Folder names: year as `YYYY`, month as `MM-monthname` (e.g. `02-february`). Images sit loose in the month folder — no day subfolders. Folder path always determined by **import date**, never file creation date.

### 1.3 IPC bridge (preload layer)

- [ ] Set `contextIsolation: true`, `nodeIntegration: false` on `BrowserWindow`
- [ ] Write `preload/index.ts` — expose `window.folio.*` API via `contextBridge`
- [ ] Wire each method to an `ipcMain.handle()` in `main/index.ts`
- [ ] Add TypeScript declaration file so the renderer gets full type checking on `window.folio`

```typescript
// Invocations (renderer → main)
window.folio.getFolioData();
window.folio.saveFolioData(data);
window.folio.copyToFolio(filePaths);
window.folio.copyReference(pileId, filePaths);
window.folio.openFileDialog();
window.folio.ensureThumbnails(itemIds);
window.folio.getReconciliationResult(); // called once on launch by renderer
window.folio.openInFinder(filename);

// Events (main → renderer)
window.folio.onFilesAdded(callback);
```

### 1.4 File watcher

- [ ] Install `chokidar`, start watching `~/Folio/` recursively (excluding `.folio/` and `references/`) from main process on app launch
- [ ] On new file detected: check if destination path is in `recentlyCopied` Set — if so, skip (it was just added by `copyToFolio`, no hash lookup needed). Clear entries from the Set after a 2s TTL
- [ ] On new file with no matching hash: date is always the current import date (`new Date()`), infer type from extension (`jpg/png/webp/heic` → sketch, `mp3/wav/aiff` → music, `mp4/mov/gif` → animation), generate ID with `nanoid`, append to `folio.json`, emit `files-added` IPC event
- [ ] Debounce watcher at 300ms to batch rapid drops
- [ ] On file deleted: mark item `missing: true` in `folio.json` rather than removing the entry — metadata, tags, and pile membership are preserved

### 1.5 Filesystem operations (`main/fs.ts`)

- [ ] `saveFolioData()`: atomic write — write to `.folio/folio.json.tmp`, then rename over `.folio/folio.json` (OS-level rename; no `.bak` needed)
- [ ] `copyToFolio()`: resolve destination as `~/Folio/<YYYY>/<MM-monthname>/<sanitized-name>.<ext>`, create year/month folders if needed, handle name collisions with `_2`, `_3` suffix; add destination path to `recentlyCopied` Set immediately after copy
- [ ] `computeHash(filePath)`: read first 64KB of file, return 8-char hex hash using Node's built-in `crypto.createHash('sha256')` — fast enough for large files, unique enough for a personal archive
- [ ] `copyReference()`: copy files to `~/Folio/references/<pile-id>/`
- [ ] `loadFolioData()`: read `.folio/folio.json` on startup, validate schema
- [ ] File sanitization helper: lowercase, spaces → hyphens, strip special characters (shared utility used by both `copyToFolio` and `copyReference`)

### 1.6 Launch reconciliation

Run once on every app launch, after `loadFolioData()`, before the UI renders. Diffs `folio.json` against what's actually on disk and surfaces any drift.

- [ ] **Scan the archive**: walk all files under `~/Folio/` (excluding `.folio/` and `references/`) and build a set of `{path, hash}` for every file found on disk
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
- [ ] File watcher also fires on drop but is idempotent — deduplicate by checking `recentlyCopied` Set before doing any hash work

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

- [ ] Display: N items · N piles · N tags · N gaps · `~/Folio/`

---

## Phase 2 — Organize: tags and piles

### 2.1 Detail drawer

- [ ] Single click on any item opens drawer (slides up from bottom)
- [ ] Show: thumbnail preview, title (editable inline), date, file type, pile membership
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
- [ ] Selection hint bar: "N selected — name and pull into a pile →"
- [ ] Escape or click background to clear selection

### 2.4 Create a pile

- [ ] With items selected, sidebar shows inline form: pile name + optional observation note
- [ ] Submit: create pile in `folio.json`, clear selection, auto-assign color from warm palette
- [ ] Items can belong to multiple piles

### 2.5 Pile sidebar list

- [ ] Each pile row: colored dot, name, item count, ◎N ref badge, ✎N note badge
- [ ] Expand pile: italic observation note, member thumbnail grid (max 8), "arrange this pile" button
- [ ] "Arrange this pile" only visible when Arrange tab is active
- [ ] Pile dots shown under strip thumbnails (one dot per pile membership)
- [ ] Pile chips shown in detail drawer

---

## Phase 3 — Arrange: spatial canvas with notes

### 3.1 Arrange view entry

- [ ] Arrange tab shows empty dotted canvas with instruction text until a context is selected
- [ ] Sidebar: "arrange this pile" or "arrange this tag" loads items onto canvas
- [ ] Toolbar shows active context: colored dot + name + "N items · N notes"
- [ ] Switching context: save current positions to `folio.json` before loading new context

### 3.2 Draggable item cards

- [ ] Items positioned absolutely on a 1400×1100px scrollable canvas
- [ ] Drag: mousedown → track mousemove delta → mouseup saves position to `folio.json`
- [ ] Positions stored per context key (`pile-{id}` or `tag-{name}`) in `folio.json`
- [ ] First-time layout: auto-arrange in a loose grid if no saved positions
- [ ] Dotted grid background: 24px radial-gradient pattern

### 3.3 Canvas notes

- [ ] "+ note" in toolbar: create note card centered in current scroll viewport
- [ ] Note card: amber drag-handle strip, auto-resizing textarea, delete link in footer
- [ ] Click note body to enter edit mode, blur to save and exit
- [ ] Empty note on blur: auto-delete
- [ ] Escape exits edit mode without deleting
- [ ] Delete link visible only while editing
- [ ] Notes saved to context's `canvasNotes[]` in `folio.json`

### 3.4 References panel

- [ ] 200px panel on right edge of arrange view, shown only for pile contexts
- [ ] Drop zone: drag image files onto panel to add references
- [ ] Browse button: `window.folio.openFileDialog()` → `copyReference(pileId, paths)`
- [ ] Each reference card: thumbnail, filename, date added, × remove (deletes file + updates `folio.json`)
- [ ] Panel footer: `~/Folio/references/<pile-name>/`

### 3.5 Tag canvas

- [ ] Same canvas and notes as pile canvas
- [ ] No references panel — show quiet note: "references belong to piles, not tags"

---

## Cross-cutting concerns

### Data integrity

- [ ] All `.folio/folio.json` writes atomic: `.tmp` write → rename (OS-level atomic; no `.bak` needed)
- [ ] Schema validation on load: check `version` field and required keys
- [ ] React state is live working copy; debounced save (500ms) on every meaningful change
- [ ] Every item carries a `hash` (first-64KB SHA-256, truncated to 8 hex chars) used to re-locate files that were renamed or moved outside the app
- [ ] Every item carries a `missing` boolean — set when a file can't be found and no hash match exists; cleared automatically if the file reappears
- [ ] Reconciliation runs at every launch: silent auto-fix for moved files, non-blocking notice for untracked or genuinely missing files

### IPC security

- [ ] `contextIsolation: true`, `nodeIntegration: false` on all windows
- [ ] Validate and sanitize all IPC arguments in main process before acting

### Performance

- [ ] Thumbnails generated in a sequential async queue, never blocking the main process event loop
- [ ] Strip and grid use `IntersectionObserver` for lazy loading
- [ ] `folio.json` read once at startup, kept in memory, written only on change
- [ ] File watcher debounced at 300ms

### File naming and paths

- [ ] Destination resolved from import date: `~/Folio/YYYY/MM-monthname/` (e.g. `~/Folio/2026/02-february/`)
- [ ] Month folder format: zero-padded number + full lowercase name — `01-january` through `12-december`
- [ ] Filename: original name, sanitized — lowercase, spaces → hyphens, special characters stripped
- [ ] Name collision within the same month folder: append `_2`, `_3`, etc. before the extension
- [ ] `item.title` defaults to sanitized filename without extension; user can rename at any time
- [ ] `item.path` stores relative path from `~/Folio/` (e.g. `2026/02-february/figure-study.jpg`) — used to locate files and rebuild thumbnails if the cache is deleted

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
| 2.4–2.5   | Piles: create, list, membership             | 3–4 days            |
| 3.1–3.3   | Arrange canvas + drag + notes               | 5–6 days            |
| 3.4–3.5   | References panel + tag canvas               | 2–3 days            |
| Polish    | Empty states, errors, edge cases, packaging | 4–5 days            |
| **Total** |                                             | **~7–8 weeks solo** |
