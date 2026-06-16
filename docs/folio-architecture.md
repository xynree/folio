# Folio Architecture

## Current Shape

Folio is an offline-first Electron app. The main process acts like a local backend with filesystem access. The renderer is a React app with no direct Node access. The preload script is the typed security boundary between them.

```text
Electron app
  Main process (Node)
    - ~/Documents/Folio initialization
    - import, copy, delete, and Finder reconciliation
    - file watcher
    - thumbnail and reference thumbnail generation
    - custom folio:// protocol
    - Photos picker helper launch on macOS

  Preload bridge
    - exposes window.folio
    - forwards typed IPC calls
    - keeps contextIsolation on and nodeIntegration off

  Renderer process (React)
    - archive strip and grid views
    - tags sidebar
    - heatmap footer
    - selection bar and import controls
    - board browser and canvas boards
    - item details modal
```

There is no backend service. The app is designed to keep working in a studio, on a plane, or anywhere else the network is irrelevant.

## Process Boundaries

### Main Process

The main process owns all disk access. `src/main/base.manager.ts` registers IPC handlers, manages app launch preparation, watches the archive, handles import dialogs, and coordinates saves. `src/main/archive.manager.ts` handles lower-level archive operations: copying files, computing hashes, deduplicating imports, copying canvas references, and generating thumbnails. `src/main/storage.manager.ts` owns split JSON reads and atomic writes.

The main process also registers the `folio://` protocol:

- `folio://thumb/<filename>` serves files from `.folio/thumbs/`.
- `folio://file/<relative-path>` serves a file inside the Folio root when a full original is explicitly needed.

### Preload Script

`src/preload.ts` exposes the renderer API:

```ts
window.folio.getFolioData();
window.folio.saveFolioData(data);
window.folio.copyToFolio(filePaths);
window.folio.importToFolio();
window.folio.copyReference(canvasId, filePaths);
window.folio.deleteItems(itemIds);
window.folio.openFileDialog();
window.folio.ensureThumbnails(itemIds);
window.folio.ensureReferenceThumbnail(referenceId, filePath);
window.folio.getFileDataUrl(filePath);
window.folio.getReconciliationResult();
window.folio.openInFinder(filePath);
window.folio.getPathForFile(file);
window.folio.onFilesAdded(callback);
```

The renderer cannot import `fs`, call Electron APIs directly, or walk arbitrary files. Anything that touches disk must go through this bridge.

### Renderer

The renderer is a React app under `src/components/`. It treats `window.folio` like a local API. App state is loaded once at startup, then kept as a working copy in React. Meaningful user edits call `saveFolioData`, which writes the split JSON files through the main process.

## Local Storage

Folio creates and manages `~/Documents/Folio`:

```text
~/Documents/Folio/
  items/
    2026/
      06_june/
        imported-image.png
  references/
    <board-id>/
      reference-image.png
  .folio/
    folio.json
    tags.json
    canvases.json
    thumbs/
      <item-id>-small.jpg
      <item-id>-small.svg
      reference-<reference-id>-small.jpg
      reference-<reference-id>-small.svg
```

The visible folders are normal user files. `.folio/` is the app's bookkeeping directory. The thumbnail cache is fully regenerable.

## Data Model

The shared schema lives in `src/types/`.

`folio.json` stores version and archive items:

```ts
interface FolioItem {
  id: string;
  path: string;
  hash: string;
  type: "sketch" | "ref" | "music" | "anim" | "text" | "other";
  date: string;
  title: string;
  description: string;
  tagIds: string[];
  missing?: boolean;
}
```

`tags.json` stores user-defined labels:

```ts
interface Tag {
  id: string;
  text: string;
}
```

`canvases.json` stores boards, spatial positions, notes, references, and future edge data:

```ts
interface Canvas {
  id: string;
  title: string;
  description?: string;
  color?: string;
  itemIds: string[];
  positions: Record<string, CanvasPosition>;
  notes: CanvasNote[];
  edges: CanvasEdge[];
  references: CanvasReference[];
}
```

Board membership is derived from `canvas.itemIds`. Items can appear on multiple boards.

## Import Flow

The app has three current import paths:

1. Drag files into the app. The renderer uses `webUtils.getPathForFile` through preload and calls `copyToFolio`.
2. Press Import and choose files. The renderer calls `importToFolio`, and the main process opens a native file picker.
3. On macOS, press Import and choose Photos. The main process launches the Swift `FolioPhotosPicker` helper, exports selected Photos items to a temporary folder, imports those files into Folio, then cleans up the temporary folder.

Imported archive files are copied to:

```text
~/Documents/Folio/items/YYYY/MM_monthname/
```

The folder is based on import date. Filenames are sanitized and collision-safe. Existing files inside `items/` can be registered in place during reconciliation.

Canvas references use a separate path:

```text
~/Documents/Folio/references/<board-id>/
```

References belong to one board and do not become archive items.

## Thumbnail Pipeline

Cards and board previews should not load full source images. The renderer requests small thumbnails through `LazyThumbnail`, which batches visible thumbnail requests over a short frame window before calling `ensureThumbnails`.

The main process generates:

- 320px JPEG thumbnails for image-like archive items.
- SVG placeholders for missing files, unsupported media, audio, text, or failed thumbnail generation.
- 320px JPEG reference thumbnails through `ensureReferenceThumbnail`.

Generated files use `-small` suffixes and are served through `folio://thumb/...`. Board browser previews batch their thumbnail request at the board level and then render `LazyThumbnail` with automatic per-card requests disabled.

## Archive UI

The archive area is the left side of the app:

- A resizable tags sidebar starts open and can collapse to an icon rail.
- Strip view groups items by day and hides empty date groups when a tag filter is active.
- Grid view shows filtered items in a dense card grid.
- Both views sort most recent first and share the same card component.
- The floating action bar contains the size scale, strip/grid icon toggle, and Import button.
- The bottom heatmap is open by default, can be minimized, and scrolls horizontally when needed.
- The status bar shows item, board, tag, gap, and root-folder counts.

The archive area keeps scrollbars visually quiet and only shows the main archive scrollbar on hover.

## Selection Flow

Archive cards support:

- click to select
- Cmd/Ctrl-click to toggle
- Shift-click for range selection across day boundaries
- drag selected items onto an open board
- create a new board from the current selection

When items are selected, the top selection bar remains draggable as part of the window chrome except for its actual buttons.

## Board And Canvas UI

The right dock is minimized by default. When open, it can show either:

- the board browser, a grid of all boards with member previews and a New board action
- a focused board with its name, counts, Add note, Import images, Edit, and minimize controls

Board settings support title and color editing. The selected board color appears as dots on archive cards that belong to that board.

Canvas boards use `CanvasViewport`, which renders the dotted background with an actual HTML `<canvas>`. The scrollable surface contains cards, notes, and references as absolutely positioned React elements. Wheel input zooms around the pointer, clamps between the configured min and max zoom, and prevents the page-style scroll effect once the zoom limit is reached.

Canvas cards, references, and notes are draggable from any non-control area. Pointer movement beyond the small drag threshold becomes a drag; otherwise the action remains a click.

## File Reconciliation

Every item stores a short hash derived from the first 64KB of the file. At launch, Folio scans `items/`, compares paths and hashes, then:

- clears `missing` when a known file exists again
- silently updates paths for renamed or moved files with matching hashes
- marks genuinely missing files as `missing`
- reports untracked files through the reconciliation notice

The app never deletes user files during reconciliation.

## Reliability Decisions

- Split JSON keeps small updates isolated: item changes do not rewrite tags and boards unless needed.
- Saves write temporary JSON files and atomically rename them over the real files.
- File watcher events are debounced.
- `recentlyCopied` avoids double-registering files the app just imported.
- The renderer uses generated thumbnails for normal cards and previews.
- Original files are served only when a feature explicitly needs them.
- The UI remains local and single-user; cloud sync would require a separate conflict-resolution design.

## Still Planned

- Canvas edge drawing between items, notes, and references.
- Freehand canvas strokes.
- Stronger IPC argument validation in main process handlers.
- Packaging polish beyond the current Electron Forge setup.
