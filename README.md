# Folio

Folio is a local-first Electron app for collecting visual work, browsing it by time and tag, and arranging references on spatial canvas boards. The app is built for a single-user desktop archive: files stay readable in `~/Documents/Folio`, app state is stored beside them as JSON, and the UI works without a backend.

## Current Features

- Archive import from drag and drop, the floating Import action, Finder file selection, and the macOS Photos picker helper.
- Strip and grid archive views with most-recent-first sorting, tag filtering, multi-select, and a 50%-200% UI scale control.
- A persistent bottom heatmap inspired by GitHub activity grids, with upload intensity capped at 8 items per day.
- A resizable tags sidebar with per-tag counts and thumbnail previews.
- A right-side board dock that opens to a board browser or a focused canvas board.
- Canvas boards with image-only draggable and resizable archive cards, reference images, notes, and text; image cards default to the source image's proportions.
- Board headers show when each board was created and when it was last saved.
- Side-node connection edges between canvas items, references, notes, and board text, with inline labels and direction modes.
- Freehand pen strokes on boards with an eraser and Cmd+Z undo.
- Resizable board text boxes for quick labels, headings, and questions, with small, medium, and large sizing.
- Board settings for title, color, delete, and board member dots on archive cards.
- Small generated thumbnails for archive cards, board previews, and canvas references so the UI does not load full source images for normal browsing.
- Local reconciliation for files renamed, moved, or deleted in Finder.

## Architecture

Folio uses the standard Electron split:

- `src/main.ts` starts Electron, creates the BrowserWindow, registers custom protocols, and delegates archive work to main-process managers.
- `src/main/base.manager.ts` owns the main IPC surface, launch reconciliation, file watcher, Photos import picker flow, and high-level data saves.
- `src/main/archive.manager.ts` handles file imports, hashes, reference copies, thumbnails, and archive path helpers.
- `src/main/storage.manager.ts` performs the split JSON reads and atomic writes.
- `src/preload.ts` exposes a typed `window.folio` API with `contextIsolation` enabled and `nodeIntegration` disabled.
- `src/components/` contains the React renderer UI.
- `src/types/` contains the shared data contracts used by both main and renderer code.

More detail is in `docs/folio-architecture.md`.

## Local Data Layout

The app manages a folder at `~/Documents/Folio`:

```text
~/Documents/Folio/
  items/
    2026/
      06_june/
        example.png
  references/
    <board-id>/
      reference-image.png
  .folio/
    folio.json
    tags.json
    canvases.json
    thumbs/
      <item-id>-small.jpg
      reference-<reference-id>-small.jpg
```

`items/` and `references/` are user-readable media folders. `.folio/` stores app metadata and a regenerable thumbnail cache.

## Project Organization

```text
src/
  main/                 Electron main-process managers
  components/archive/   Strip, grid, heatmap, item cards, and tags sidebar
  components/canvas/    Board browser, canvas viewport, cards, notes, references
  components/details/   Item details modal
  components/folio/     Renderer model helpers, constants, and import helpers
  components/layout/    Selection bar, status bar, reconciliation notice
  components/shared/    Shared UI primitives and lazy thumbnails
  types/                Shared TypeScript schemas and preload API types
native/
  FolioPhotosPicker/    Swift helper for the macOS Photos picker
scripts/
  build-native-helpers.mjs
docs/
  folio-architecture.md
  folio-mvp-plan.md
```

## Development

Install dependencies once:

```sh
npm install
```

Run the app:

```sh
npm run start
```

`npm run start` runs `npm run build:native` first, which builds the Photos picker helper when the host supports it. The same native helper build runs before packaging.

Useful checks:

```sh
npm run lint
npm test
```

Package locally:

```sh
npm run package
```

## Notes

- The archive is intentionally offline-first and has no backend.
- The JSON files are small, readable, and portable.
- Thumbnails are cache files and can be regenerated from source media.
- Current canvas boards support spatial arrangement, notes, references, text elements, connection edges, and freehand strokes.
