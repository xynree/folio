# Folio

Folio is a local-first Electron app for collecting visual work, organizing it into projects, reviewing Works over time, and arranging project images on spatial canvas boards. The app is built for a single-user desktop studio archive: files stay readable in `~/Documents/Folio`, app state is stored beside them as JSON, and the UI works without a backend.

## Current Features

- Archive import from drag and drop, the floating Import action, Finder file selection, and the macOS Photos picker helper.
- Projects as the first screen, with one Finder shortcut to the readable project folder and separate project sidebar areas for All Images, Works, Boards, and Review.
- Project Review surface with recap metrics, a Works-focused progress timeline, and dedicated Markdown editor pages for review documents that can tag specific Works.
- Strip and grid views for All Images and Works, with most-recent-first sorting, tag filtering, multi-select, and a 50%-200% UI scale control.
- A Works-only bottom heatmap shown only in the Works view, with work activity capped at 8 items per day.
- A compact tags rail that starts auto-collapsed, expands on demand, and still supports per-tag counts and thumbnail previews.
- A Boards sidebar view that opens to a project board browser or a focused canvas board, with a scrollable project-image tray for adding existing project images to the open board.
- Canvas boards with image-only draggable and resizable project image cards, notes, and text; image cards default to the source image's proportions.
- Double-clicking an image or Work opens the item editor with a large source preview on the left and editable metadata on the right.
- Board headers show when each board was created and when it was last saved.
- Side-node connection edges between canvas items, notes, and board text, with inline labels and direction modes.
- Canvas relationships can be marked as related, inspired by, or version of.
- Freehand pen strokes on boards with an eraser and Cmd+Z undo.
- Resizable board text boxes for quick labels, headings, and questions, with small, medium, and large sizing.
- Board settings for title, color, delete, and board member dots on archive cards.
- Small generated thumbnails for archive cards and board previews so the UI does not load full source images for normal browsing.
- Local reconciliation for files renamed, moved, or deleted in Finder.

## Architecture

Folio uses the standard Electron split:

- `src/main.ts` starts Electron, creates the BrowserWindow, registers custom protocols, and delegates archive work to main-process managers.
- `src/main/base.manager.ts` owns the main IPC surface, launch reconciliation, file watcher, Photos import picker flow, and high-level data saves.
- `src/main/archive.manager.ts` handles file imports, hashes, thumbnails, and archive path helpers.
- `src/main/storage.manager.ts` performs the split JSON reads and atomic writes.
- `src/preload.ts` exposes a typed `window.folio` API with `contextIsolation` enabled and `nodeIntegration` disabled.
- `src/components/` contains the React renderer UI.
- `src/types/` contains the shared data contracts used by both main and renderer code.

More detail is in `docs/folio-architecture.md`.

## Local Data Layout

The app manages a folder at `~/Documents/Folio`:

```text
~/Documents/Folio/
  projects/
    <project-slug>/
      images/
        example.png
      works/
        promoted-work-link-or-copy.png
      reviews/
        review-<review-id>.md
      boards/
        <board-id>/
  .folio/
    folio.json
    tags.json
    canvases.json
    projects.json
    thumbs/
      <item-id>-small.jpg
```

Each project owns its own `images/`, `works/`, `boards/`, and `reviews/` folders. `.folio/` stores app metadata and a regenerable thumbnail cache. Legacy `items/` and root-level media folders are migrated into the owning project at launch when Folio can match them to metadata.

## Project Organization

```text
src/
  main/                 Electron main-process managers
  components/archive/   Strip, grid, heatmap, item cards, and tags sidebar
  components/canvas/    Board browser, canvas viewport, cards, notes, text
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
npm run package
```

## Notes

- The archive is intentionally offline-first and has no backend.
- The JSON files are small, readable, and portable.
- Thumbnails are cache files and can be regenerated from source media.
- Current canvas boards support spatial arrangement, notes, text elements, connection edges, and freehand strokes.
