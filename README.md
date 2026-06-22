# Folio

Folio is a local-first Electron app for collecting visual work, organizing it into projects, reviewing Works over time, and arranging project assets on spatial canvas boards. The app is built for a single-user desktop studio archive: files stay readable in `~/Documents/Folio`, app state is stored beside them as JSON, and the UI works without a backend.

## Current Features

- Archive import from drag and drop, the floating Import action, Finder file selection, and the macOS Photos picker helper.
- Projects as the first screen, with one Finder shortcut to the readable project folder and separate project sidebar areas for All Images, Works, Boards, and Review.
- Project Review surface with recap metrics, a Works-focused progress timeline, and dedicated Markdown editor pages for review documents that can tag specific Works.
- Strip and grid views for All Images and Works, with most-recent-first sorting, tag filtering, multi-select, and a 50%-200% UI scale control.
- A Works-only bottom heatmap shown only in the Works view, with work activity capped at 8 items per day.
- A compact tags rail that starts auto-collapsed, expands on demand, and still supports per-tag counts and thumbnail previews.
- A Boards sidebar view that opens to a project board browser or a focused canvas board, with built-in board templates and a scrollable project asset tray for adding existing images and documents.
- Canvas boards with draggable and resizable image cards, document cards, link cards, section frames, notes, and text; image cards default to the source image's proportions.
- Canvas selection tools for selecting multiple objects, moving them together, aligning, distributing, tidying into a grid, arranging by date/type, duplicating editable objects, deleting selected objects, and organizing a selection into a section.
- Board search highlights matching image titles, document names, links, notes, text, section names, and edge labels. Large boards show a minimap when content meaningfully exceeds the viewport.
- Double-clicking an image or Work opens the item editor with a large source preview on the left and editable metadata on the right.
- Board headers show when each board was created and when it was last saved.
- Side-node connection edges between canvas items, documents, notes, text, links, and sections, with inline labels, direction modes, and relationship types.
- Canvas relationships can be marked as related, inspired by, uses, variant of, version of, response to, or part of.
- Freehand pen strokes on boards with an eraser and Cmd+Z undo.
- Resizable board text boxes for quick labels, headings, and questions, with small, medium, and large sizing.
- Board viewport state is saved, with zoom controls, reset zoom, fit-to-content, and keyboard zoom-to-selection.
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
      documents/
        brief.md
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

Each project owns its own `images/`, `documents/`, `works/`, `boards/`, and `reviews/` folders. `.folio/` stores app metadata and a regenerable thumbnail cache. Legacy `items/` and root-level media folders are migrated into the owning project at launch when Folio can match them to metadata.

## Storage Location And Backups

By default Folio lives in `~/Documents/Folio`. From the settings menu (gear icon in the Projects header) you can switch the source of truth to iCloud Drive, where Folio lives in `iCloud Drive/Folio`. Switching copies your current folder to the new location, leaves the original in place as a safety copy, and relaunches the app. The chosen location is remembered in `folio-settings.json` in Electron's user-data directory.

Backups are written to the opposite location from your live folder: a Documents source backs up to `iCloud Drive/Folio Backup`, and an iCloud source backs up to `~/Documents/Folio Backup`. A backup is a single overwriting copy (the regenerable thumbnail cache is skipped). Restoring copies the latest backup into a new timestamped folder in `~/Documents` and reveals it in Finder, leaving your current data untouched.

## Project Organization

```text
src/
  main/                 Electron main-process managers
  components/archive/   Strip, grid, heatmap, item cards, and tags sidebar
  components/canvas/    Board browser, canvas viewport, canvas cards, templates, selection, arrangement
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
- Current canvas boards support spatial arrangement, project assets, notes, text elements, link cards, sections, connection edges, search, minimap, templates, and freehand strokes.
