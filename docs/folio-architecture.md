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

## Product Direction

Folio is moving toward two connected product goals:

1. **Interactive studio wall**: a workspace where imported work can be watched over time, grouped by project, promoted through stages, and reviewed as evolving output.
2. **Reference and inspiration graph**: a Pinterest-like collection layer where references, notes, sketches, WIP, and final work can be connected to projects and to each other.

The current architecture already supports the base of this direction: local archive items, board membership, board-local references, notes, and a persisted `CanvasEdge` shape. The next architectural work is to make projects, item stages, references, and relationships explicit enough that the UI can show progress and meaning instead of only files and boards.

Important product constraints remain:

- The app stays local-first and single-user by default.
- Files remain readable outside the app.
- Metadata remains inspectable and migratable.
- Fast capture should not require users to classify everything immediately.
- Process artifacts are valuable: references, WIP, notes, failures, and outputs all belong in the record.
- Project review is personal self-review, not collaborative review. The data model should not include teammates, assignees, approvals, shared comment threads, or review requests.
- Sharing affordances should stay outside the live app surface: export board snapshots, export project artifacts, and open project-related folders in Finder.

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

### Planned model evolution

The current model should evolve in small schema versions rather than being replaced wholesale. The near-term path is to enrich `FolioItem` and `Canvas` first, then introduce standalone project/reference indexes only when the UI needs cross-board queries that are awkward to derive.

Proposed item additions:

```ts
type ItemStage =
  | "reference"
  | "sketch"
  | "wip"
  | "process"
  | "final"
  | "output"
  | "note"
  | "other";

interface FolioItem {
  // existing fields...
  stage?: ItemStage;
  sourceCreatedAt?: string;
  updatedAt?: string;
}
```

Proposed board/project additions:

```ts
type BoardKind =
  | "project"
  | "reference-board"
  | "moodboard"
  | "collection";

type BoardStatus = "active" | "paused" | "done" | "archived";

interface Canvas {
  // existing fields...
  kind?: BoardKind;
  status?: BoardStatus;
  brief?: string;
  outcome?: string;
  startedAt?: string;
  targetDate?: string;
  completedAt?: string;
  updatedAt?: string;
  sections?: CanvasSection[];
  strokes?: CanvasStroke[];
}
```

These additions are intentionally personal. They should describe the user's own studio process, not collaboration state. Avoid adding fields such as collaborator IDs, reviewers, task assignees, approval status, or comment-thread ownership unless the product direction changes explicitly.

Proposed relationship additions:

```ts
type RelationshipType =
  | "inspired-by"
  | "uses"
  | "variant-of"
  | "version-of"
  | "response-to"
  | "part-of"
  | "output-of"
  | "related";

interface CanvasEdge {
  id: string;
  fromId: string;
  toId: string;
  type?: RelationshipType;
  label?: string;
}
```

Proposed reference additions:

```ts
interface CanvasReference {
  // existing fields...
  sourceUrl?: string;
  sourceTitle?: string;
  author?: string;
  capturedAt?: string;
  notes?: string;
  tagIds?: string[];
}
```

The first migrations should remain additive:

- Default missing item stages from item type and context.
- Default old canvases to `kind: "project"` when they contain archive items and `kind: "collection"` when they do not.
- Default old canvases to `status: "active"` unless archived behavior exists.
- Preserve existing `canvas.itemIds` as the source of board membership.
- Keep relationship geometry derived from card positions until manual bend points are explicitly designed.

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

## Studio Wall Architecture

The Studio Wall should be a renderer-level composition over existing archive, tag, and canvas data before it becomes a new storage domain. Its first version can derive everything from `FolioData`:

- Active projects: canvases where `kind === "project"` and `status !== "archived"`.
- Recent work: archive items sorted by `date` or `updatedAt`.
- Recent references: board references sorted by `capturedAt` or inferred insertion order.
- Outputs: items where `stage === "final"` or `stage === "output"`.
- Needs sorting: items with no tags, no board membership, and no edited stage.
- Self-review prompts: stale active projects, new unsorted imports, and recent outputs.

This keeps the main process unchanged for the first Studio Wall iteration. The renderer should compute view models with memoized selectors, then persist only user edits through `saveFolioData`.

If the view grows expensive, introduce a renderer-side selector module before adding new main-process APIs. A database should remain out of scope until JSON read/write cost or query complexity proves it is necessary.

## Project Timeline Architecture

A project timeline is also a derived view at first. For a given project board:

- Archive item events come from the board's `itemIds` and the item `date`.
- Reference events come from `canvas.references`.
- Note events come from `canvas.notes`; add timestamps before treating notes as timeline-grade data.
- Output events come from project items whose `stage` is `final` or `output`.
- Relationship events can be added later if edges receive `createdAt` or `updatedAt`.

Near-term timeline work should add timestamps to mutable board objects:

```ts
interface CanvasNote {
  id: string;
  text: string;
  x: number;
  y: number;
  createdAt?: string;
  updatedAt?: string;
}

interface CanvasReference {
  id: string;
  path: string;
  filename: string;
  x: number;
  y: number;
  capturedAt?: string;
  updatedAt?: string;
}
```

The project timeline should not duplicate source data. It should sort and group existing records into a presentation model, then route edits back to the owning item, note, reference, edge, or canvas.

## Reference Graph Architecture

The current `CanvasReference` type is board-local. That is sufficient for drag/drop reference cards, but a Pinterest-like reference library will need a clearer distinction:

- **Board-local reference**: an image or URL captured for one board only.
- **Archive reference item**: a reusable reference stored in `items/` and available across boards.
- **Global reference index**: a future optional store if references need independent browsing before they belong to any board.

The recommended path is incremental:

1. Keep `CanvasReference` board-local and add source metadata.
2. Add a references browser that flattens references across canvases at render time.
3. Add "promote to archive" when a reference should become reusable across boards.
4. Introduce a separate `references.json` only if board-local flattening becomes awkward or references need to exist before board assignment.

Edges should remain attached to canvases because their meaning is spatial and contextual. A connection between a reference and an item on one project board may not mean the same thing elsewhere.

## Edge Rendering Architecture

`CanvasEdge` already exists in the schema. Rendering should be implemented as an SVG overlay inside the same zoomed canvas surface as cards:

- Compute endpoints from each connected object's current position and card bounds.
- Render curves below cards and above the dotted background.
- Keep edge path data derived, not persisted.
- Store only semantic edge data: IDs, endpoints, type, label, and timestamps.
- Recompute paths while dragging so edges stay attached.

Selection should be local renderer state until the user edits or deletes an edge. Edge creation, label edits, type edits, and deletes should persist through `saveFolioData`.

## Search And Retrieval Architecture

Search should start as a renderer-side in-memory index built from loaded `FolioData`. It should cover:

- item title, description, path, stage, and tags
- board title, brief, outcome, kind, and status
- note text
- reference filename, notes, source title, source URL, and tags
- edge label and relationship type

If search needs ranking, highlighting, or fuzzy matching, add a small local search helper in the renderer. Do not move search into the main process until it needs disk-only data, OCR text extraction, or background indexing.

## Export And Folder Access Architecture

The only planned collaboration-adjacent affordances are export and direct folder access. They should not create shared state inside Folio.

Export should be modeled as one-way artifact generation:

- Board snapshot image or PDF contact sheet.
- Project timeline Markdown.
- Portable project folder containing selected files and metadata JSON.
- Printable Studio Wall or self-review summaries.

Folder access should use existing main-process shell capabilities:

- `openInFinder(filePath)` already opens an individual item.
- Add project-level actions that reveal the relevant archive files and `references/<board-id>/` folder.
- If a project spans many month folders, open a generated project export folder or show a file list before opening Finder.

No persistent collaborator, comment, permission, or shared-review schema is needed for these flows.

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

## Schema And Migration Decisions

Future schema changes should be handled deliberately:

- Keep `SCHEMA_VERSION` meaningful and increment it for persisted shape changes.
- Add migration functions in the main process before validating loaded JSON.
- Keep migrations additive where possible so older data remains easy to understand.
- Avoid duplicating board membership onto items unless query needs prove it is necessary.
- Prefer derived renderer view models for Studio Wall, timelines, backlinks, and search before adding new persisted indexes.
- Keep new JSON files optional until the current split (`folio.json`, `tags.json`, `canvases.json`) becomes a real limitation.

Likely future JSON files, only if needed:

```text
.folio/
  projects.json      # only if projects become separate from canvases
  references.json    # only if references need global life outside boards
  search-index.json  # only if background indexing becomes necessary
```

## Roadmap

Completed MVP foundation:

- Board-local reference capture from drag/drop and file dialog.
- SVG edge rendering and editing for item, reference, and note connections.
- Freehand canvas strokes with board-color ink and Cmd+Z undo.
- Local archive import, board membership, notes, thumbnails, tags, and reconciliation.

Near-term roadmap:

- Add clipboard paste and URL capture for references.
- Add item stages so sketches, WIP, final pieces, output, and references are distinct.
- Add project-like board metadata: kind, status, brief, outcome, and dates.
- Add Studio Wall home view from derived renderer selectors.
- Add project timeline view from existing item/reference/note data.
- Add backlinks and connected-item summaries in detail views.
- Add project folder access actions for archive files and board references.

Middle-term roadmap:

- Add canvas sections, board templates, lasso selection, alignment, and minimap.
- Add reference browser with Pinterest-like browsing and filters.
- Add iteration/version grouping and "promote to output" flows.
- Add global search across items, boards, notes, references, tags, and edges.
- Add weekly/project self-review summaries.
- Add export for board snapshots, project timelines, and contact sheets.

Long-term roadmap:

- Add optional local intelligence for tag suggestions, OCR, color palettes, and relationship suggestions.
- Add explicit backup/export before any sync work.
- Explore sync only after conflict behavior is designed.
- Keep collaboration out of the live app surface; support outside sharing through exported files and direct folder access.
- Keep social features, mobile, and cloud-first workflows outside the core product.
