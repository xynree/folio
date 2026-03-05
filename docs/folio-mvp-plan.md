# Folio — MVP Project Plan

## Stack

- **Electron** — desktop shell (Node.js main process, Chromium renderer)
- **React + Vite** — UI (renderer process)
- **Node.js** — file watching, filesystem ops, thumbnail generation (all in main process)
- **`folio.json`** — flat JSON sidecar in `~/Folio/`, single source of truth for all metadata (no database)
- **`sharp`** — thumbnail generation (fast native Node module)
- **`chokidar`** — file watching (battle-tested, cross-platform)

The key difference from Tauri: everything is JavaScript/TypeScript. The main process handles all filesystem work; the renderer handles all UI. They communicate via Electron's `ipcMain` / `ipcRenderer` bridge with a typed preload script.

---

## Phase 1 — Archive: drop images in, see them over time

The foundation. Everything else builds on this being solid.

### 1.1 Scaffold the Electron app

- Init with Electron Forge and the official Vite + TypeScript template:
  ```bash
  npm init electron-app@latest folio -- --template=vite-typescript
  ```
- Structure (Forge's default, which we keep):
  ```
  src/
    main/         ← Node.js: filesystem, IPC handlers, file watcher
    preload/      ← typed bridge between main and renderer
    renderer/     ← React app (the UI)
  ```
- Configure app window: `BrowserWindow` at minimum 900×600, `titleBarStyle: 'hiddenInset'` for macOS native feel
- Add React Router in the renderer for strip / grid / arrange view switching
- Packaging, code signing, and distribution are handled by Forge — no separate `electron-builder` needed

### 1.2 Define the folder structure and JSON schema

Establish `~/Folio/` as the canonical home. This is decided once and never changed.

```
~/Folio/
  output/           ← everything the user makes, organized by date
    2026-02-22_figure-study-5.jpg
    2026-02-22_hand-gestures.png
  references/       ← pile reference images, separated from output
    <pile-id>/
      vermeer-window.jpg
  .cache/
    thumbs/         ← generated thumbnails (400px wide JPEGs)
      <item-id>.jpg
  folio.json        ← all metadata
  folio.json.bak    ← previous good state, overwritten on each save
```

`folio.json` schema:

```json
{
  "version": 1,
  "items": [
    {
      "id": "abc123",
      "filename": "2026-02-22_figure-study-5.jpg",
      "date": "2026-02-22",
      "title": "figure study #5",
      "type": "sketch",
      "tags": ["figures", "anatomy"],
      "pileIds": [1]
    }
  ],
  "piles": [
    {
      "id": 1,
      "name": "figure studies",
      "color": "#a06830",
      "note": "something about the weight of them",
      "itemIds": ["abc123"],
      "canvasPositions": { "abc123": { "x": 60, "y": 80 } },
      "canvasNotes": [
        { "id": "n1", "x": 340, "y": 185, "text": "the torso, not the face" }
      ]
    }
  ],
  "tags": ["figures", "anatomy", "light"]
}
```

### 1.3 Main process: IPC handler layer

Set up a typed preload script (`preload/index.ts`) that exposes a clean API to the renderer via `contextBridge`. The renderer never calls Node APIs directly — everything goes through this bridge.

```typescript
// What the renderer can call:
window.folio.getFolioData()
window.folio.saveFolioData(data)
window.folio.copyToFolio(filePaths)
window.folio.copyReference(pileId, filePaths)
window.folio.getThumbnailPath(itemId)
window.folio.openInFinder(filename)
window.folio.ensureThumbnails(itemIds)

// Events the main process pushes to the renderer:
window.folio.onFilesAdded(callback)     // file watcher detected new files
window.folio.onFolioChanged(callback)   // folio.json was updated externally
```

Each of these maps to an `ipcMain.handle()` in `main/index.ts`.

### 1.4 Main process: file watcher

- Use `chokidar` to watch `~/Folio/output/`
- On new file detected:
  - Infer date from filename prefix (`YYYY-MM-DD_`) or fall back to `fs.stat` birthtime
  - Infer type from extension (`.jpg/.png/.webp/.heic` → sketch, `.mp3/.wav/.aiff` → music, `.mp4/.mov/.gif` → animation)
  - Generate a short unique ID (`nanoid`)
  - Append new item to `folio.json` via the same atomic write function used everywhere
  - Emit `files-added` IPC event to renderer with the new item data
- Debounce 300ms to batch rapid multi-file drops
- Handle deletes: mark item as `removed: true`, don't delete metadata

### 1.5 Main process: filesystem operations

```typescript
// main/fs.ts

// Atomic JSON write: write to .tmp, then rename (never corrupt mid-write)
async function saveFolioData(data: FolioData): Promise<void>

// Copy dropped files to ~/Folio/output/ with date prefix
// Returns array of new item objects to be merged into folio.json
async function copyToFolio(srcPaths: string[]): Promise<Item[]>

// Generate thumbnail using sharp, save to .cache/thumbs/<id>.jpg
async function generateThumbnail(item: Item): Promise<string>

// Copy file to ~/Folio/references/<pileId>/
async function copyReference(pileId: number, srcPaths: string[]): Promise<Ref[]>
```

### 1.6 Thumbnail generation

- Use `sharp` to resize images to 400px wide, JPEG 80% quality
- Cache to `~/Folio/.cache/thumbs/<id>.jpg`
- `ensureThumbnails(ids[])`: only generate what's missing — fast on subsequent launches
- For audio files: use a fixed SVG waveform placeholder asset
- For video/animation: extract first frame using `ffmpeg` if available; otherwise placeholder
- Renderer loads thumbnails via `file://` protocol pointing directly into the cache dir

### 1.7 Drop files into the app

- Renderer: `onDragOver` + `onDrop` on the window root element
- On drop: extract file paths via `webUtils.getPathForFile(file)` (Electron 28+ API)
- Call `window.folio.copyToFolio(paths)`
- Main process copies files, updates `folio.json`, triggers thumbnail generation async
- File watcher fires too but is idempotent — deduplicates by filename
- Show brief toast: "3 items added to today"

### 1.8 Header import button

- Native file dialog via IPC: `window.folio.openFileDialog()` → main calls `dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] })`
- Same `copyToFolio` flow as drag-and-drop

### 1.9 Daily strip view

- Render all dates from earliest item to today, most recent at top
- Each date row: date label column + thumbnails of items that day
- Empty dates: faint dash line — gaps in practice are part of the record, not hidden
- Thumbnails loaded lazily using `IntersectionObserver`
- Scroll position persisted in `sessionStorage`

### 1.10 Grid view

- Dense thumbnail grid using CSS `grid` with `auto-fill, minmax(148px, 1fr)`
- Same item data, no date grouping
- Type filter pills in header (all / sketch / ref / music / anim)

### 1.11 Status bar

- Live counts: N items · N piles · N tags · N gaps
- Folder path: `~/Folio/`

---

## Phase 2 — Organize: tags and piles

### 2.1 Click an item → detail drawer

- Slides up from bottom on single click
- Shows: thumbnail preview, title (editable inline), date, file type
- Title edits: update React state immediately, debounce write to `folio.json` 500ms
- "Show in Finder" button: calls `window.folio.openInFinder(filename)`

### 2.2 Tags

- Tag input in detail drawer: type a tag name, press Enter
- Tags stored as plain strings in `item.tags[]`; global list deduplicated in `folio.json.tags`
- Remove tag with × button
- Tag chips shown on grid cards below title
- Sidebar TAGS section: all tags with item count, expand to see thumbnail strip
- Clicking a tag in sidebar filters the active view

### 2.3 Multi-select

- ⌘+click (macOS) / Ctrl+click to add/remove from selection
- Shift+click for range select in grid view
- Amber border highlight on selected items
- Selection hint bar below header when active: "N selected — name and pull into a pile →"
- Escape or click background to deselect

### 2.4 Create a pile

- With items selected, sidebar shows an inline create-pile form: name input + optional observation note
- "pull into pile →" creates new pile in `folio.json`, clears selection
- Items can belong to multiple piles
- Pile color auto-assigned from a fixed warm palette (8 colors, cycles)

### 2.5 Pile list in sidebar

- Each pile row: colored dot, name, item count, ref badge (◎N), note badge (✎N)
- Expand pile: observation note (italic), thumbnail grid of members, "arrange this pile" button (visible only in arrange view)
- Pile dot indicators under strip thumbnails (small colored dots, one per pile membership)
- Pile membership shown in detail drawer

---

## Phase 3 — Arrange: spatial canvas with notes

### 3.1 Arrange view — entry and context selection

- Arrange tab shows an empty canvas with instruction text until a pile or tag is activated
- Sidebar: expand pile → click "arrange this pile" to load items onto the canvas
- Active context shown in arrange toolbar: colored dot + pile name + item/note counts
- Switching context saves current positions before loading the new one

### 3.2 Draggable item cards on the canvas

- Items positioned absolutely on a `1400×1100px` scrollable canvas div
- Mouse down → track `mousemove` delta → update position in React state → `mouseup` saves to `folio.json`
- Positions stored per context key (`pile-{id}` or `tag-{name}`) in `folio.json`
- Default positions: auto-arranged in a loose grid if no saved positions exist
- Dotted grid background (24px radial-gradient dots)

### 3.3 Canvas notes

- "+ note" button in arrange toolbar: creates new note card centered in current scroll viewport
- Note card: amber drag-handle strip, auto-resizing textarea, delete link in footer
- Drag handle repositions the note (same mouse tracking pattern as item cards)
- Click note body to enter edit mode; blur saves and exits
- Empty note on blur: auto-deletes itself
- Escape exits edit mode
- Notes saved to active context's `canvasNotes[]` in `folio.json`
- Delete link visible only while editing (prevents accidental deletes)

### 3.4 References panel (pile context only)

- 200px fixed panel on right edge of arrange view, shown only for pile contexts
- Drop image files onto panel to add references, or use browse button
- Browse: `window.folio.openFileDialog()` → `copyReference(pileId, paths)`
- Main copies to `~/Folio/references/<pile-id>/`, updates `folio.json`
- Each reference card: thumbnail, filename, date added, × remove (deletes file from disk)
- Folder path at panel footer: `~/Folio/references/<pile-name>/`

### 3.5 Tag canvas

- Same canvas and note system as pile canvas
- No references panel — references belong to piles, not tags
- Right edge shows a quiet note: "references belong to piles, not tags"

---

## Cross-cutting concerns

### Data integrity
- All `folio.json` writes use atomic rename: write to `folio.json.tmp`, then `fs.rename()` to `folio.json`
- Before each write, copy current `folio.json` to `folio.json.bak`
- On load: validate schema (check `version` field and required top-level keys); if invalid, restore from `.bak` and alert user
- React state is the live working copy; every meaningful change triggers a debounced save (500ms)

### IPC security
- `contextIsolation: true`, `nodeIntegration: false` in all `BrowserWindow` instances
- Renderer has zero direct Node.js access — all filesystem ops go through the typed preload bridge
- Validate and sanitize all IPC inputs in main process before acting on them

### Performance
- Thumbnails generated in a non-blocking queue (main process, async, one at a time to avoid disk thrash)
- Strip and grid use `IntersectionObserver` for lazy thumbnail loading
- `folio.json` read once at startup, kept in memory; written only on change
- File watcher debounced at 300ms

### File naming
- Output files: `YYYY-MM-DD_<sanitized-original-name>.<ext>`
- Sanitize: lowercase, spaces → hyphens, strip special characters
- Name collision: append `_2`, `_3`, etc.
- `item.title` defaults to filename without date prefix and extension; user can rename at any time

### Accepted file types
- Images: `jpg`, `jpeg`, `png`, `gif`, `webp`, `heic`, `avif`
- Audio: `mp3`, `wav`, `aiff`, `m4a`
- Video/animation: `mp4`, `mov`, `gif`
- Anything else: clear rejection toast, nothing copied

### Packaging
- Electron Forge handles packaging, code signing, and distribution — it's built in, not a separate tool
- `forge.config.ts`: configure `@electron-forge/maker-dmg` for macOS `.dmg` output
- `@electron-forge/plugin-vite` wires up the Vite build for all three targets (main, preload, renderer)
- If using `sharp` later: Forge's `@electron-forge/plugin-auto-unpack-natives` handles native module extraction automatically
- Windows support later: add `@electron-forge/maker-squirrel` to the makers list — no other changes needed

---

## What is explicitly out of scope for MVP

- Social / sharing / circle
- Velocity / heatmap view
- Juxtapose view
- Rediscovery nudge
- Cloud sync
- Mobile
- Windows (macOS first; Electron makes it a config change later)

---

## Rough sequence and effort

| Phase | Milestone | Est. effort |
|---|---|---|
| 1.1–1.3 | Electron scaffold + IPC bridge + folder schema | 3–4 days |
| 1.4–1.5 | File watcher + filesystem operations | 3–4 days |
| 1.6–1.8 | Thumbnails + file drop + import button | 3–4 days |
| 1.9–1.11 | Strip + grid + status bar | 4–5 days |
| 2.1–2.3 | Detail drawer + tags + multi-select | 4–5 days |
| 2.4–2.5 | Piles: create, list, membership | 3–4 days |
| 3.1–3.3 | Arrange canvas + drag + notes | 5–6 days |
| 3.4–3.5 | References panel + tag canvas | 2–3 days |
| Polish | Empty states, error handling, edge cases, packaging | 4–5 days |
| **Total** | | **~7–8 weeks solo** |

Electron shaves roughly a week off the Tauri estimate — mostly because thumbnail generation, file watching, and filesystem ops are all Node.js rather than requiring Rust. The UI work is identical either way since the prototype is already close to production-ready.
