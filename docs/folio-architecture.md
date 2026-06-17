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
    - projects home view
    - project image list and Works views
    - strip, grid, and heatmap views for tracked work
    - tags sidebar
    - selection bar and import controls
    - project board browser and canvas boards
    - item details modal
```

There is no backend service. The app is designed to keep working in a studio, on a plane, or anywhere else the network is irrelevant.

## Product Direction

Folio is moving toward a project-first local studio model with three connected product goals:

1. **Projects as the primary workspace**: opening the app should show a Projects view. Each project owns a local folder, an image library, a Works subset, and any number of boards.
2. **Interactive studio wall**: within a project, selected images can be promoted to Works and reviewed over time through strip, grid, and heatmap views.
3. **Reference and inspiration graph**: project boards can connect references, notes, sketches, WIP, and final work to each other spatially.

The current architecture already supports the base of this direction: local archive items, board membership, board-local references, notes, and a persisted `CanvasEdge` shape. The next architectural work is to add a real `Project` storage domain so boards and image lists are scoped to a project instead of treating the archive as the primary surface.

Important product constraints remain:

- The app stays local-first and single-user by default.
- Files remain readable outside the app.
- Metadata remains inspectable and migratable.
- Fast capture should not require users to classify everything immediately. Dragging or pasting images into a project should create project images automatically.
- Process artifacts are valuable: references, WIP, notes, failures, and outputs all belong in the record.
- Project review is personal self-review, not collaborative review. The data model should not include teammates, assignees, approvals, shared comment threads, or review requests.
- Sharing affordances should stay outside the live app surface: export board snapshots, export project artifacts, and open project-related folders in Finder.

## Process Boundaries

### Main Process

The main process owns all disk access. `src/main/base.manager.ts` registers IPC handlers, manages app launch preparation, watches Folio folders, handles import dialogs, and coordinates saves. `src/main/archive.manager.ts` handles lower-level media operations: copying files, computing hashes, deduplicating imports, copying canvas references, and generating thumbnails. `src/main/storage.manager.ts` owns split JSON reads and atomic writes.

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

Folio creates and manages `~/Documents/Folio`. The existing archive layout remains valid for migration and loose imports:

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

The project-oriented layout should add first-class project folders:

```text
~/Documents/Folio/
  projects/
    <project-slug-or-id>/
      images/
        uploaded-project-image.png
      works/
        promoted-work-image.png
      boards/
        <board-id>/
          references/
            board-reference.png
  .folio/
    projects.json
    folio.json
    tags.json
    canvases.json
    thumbs/
```

The visible folders are normal user files. `.folio/` is the app's bookkeeping directory. The thumbnail cache is fully regenerable. Project `images/` contains all images imported into the project. Project `works/` is the user-accessible representation of images promoted into Works; implementation may use copies, links, or generated exports, but canonical work membership should remain in metadata so it can be reconciled. Project `boards/<board-id>/` contains board-scoped assets such as references that are not part of the project's main image library.

## Data Model

The shared schema lives in `src/types/`.

`folio.json` stores version and media items. In the current app most of these are archive items; in the project model they also represent images imported into a project:

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
  mediaWidth?: number;
  mediaHeight?: number;
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

`canvases.json` stores boards, spatial object geometry, notes, references, and future edge data:

```ts
interface CanvasObjectGeometry {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

type CanvasTextSize = "sm" | "md" | "large";

interface CanvasReference extends CanvasObjectGeometry {
  id: string;
  path: string;
  filename: string;
  mediaWidth?: number;
  mediaHeight?: number;
}

interface Canvas {
  id: string;
  title: string;
  description?: string;
  color?: string;
  createdAt?: string;
  updatedAt?: string;
  itemIds: string[];
  positions: Record<string, CanvasObjectGeometry>;
  notes: CanvasNote[];
  edges: CanvasEdge[];
  references: CanvasReference[];
  strokes?: CanvasStroke[];
  texts?: CanvasTextElement[]; // text elements may include size?: CanvasTextSize
}
```

Board membership is derived from `canvas.itemIds`. Items can appear on multiple boards.

### Planned model evolution

The current model should evolve in small schema versions rather than being replaced wholesale. The near-term path is to introduce a top-level `Project` entity, keep `FolioItem` as the canonical image/media record, and keep `Canvas` as the board/canvas record owned by a project.

`projects.json` should store the app's first-screen workspace list:

```ts
type ProjectStatus = "active" | "paused" | "done" | "archived";

interface Project {
  id: string;
  title: string;
  description?: string;
  status?: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  folderPath: string;
  imageIds: string[];
  workItemIds: string[];
  boardIds: string[];
}
```

Project semantics:

- `imageIds` is the complete list of images in the project.
- `workItemIds` is a subset of `imageIds` promoted into Works.
- `boardIds` stores project board ordering. Each referenced canvas should also carry `projectId` so ownership can be recovered if ordering metadata drifts.
- Works are not a separate file type or task state. A Work is an image in a project with project-level work membership.
- The app may continue to support loose archive items, but the primary capture path should import into a project.

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
  projectId?: string;
  stage?: ItemStage;
  sourceCreatedAt?: string;
  updatedAt?: string;
}
```

Proposed canvas/project-board additions:

```ts
type BoardKind =
  | "reference-board"
  | "moodboard"
  | "process-board"
  | "review-board"
  | "collection";

type BoardStatus = "active" | "paused" | "done" | "archived";

interface Canvas {
  // existing fields...
  projectId?: string;
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

- Create a default project for existing archive items and canvases so current users do not lose board context.
- Add `projects.json` with at least one project record before routing app launch to Projects.
- Assign existing canvases to the default project through `canvas.projectId` and `project.boardIds`.
- Preserve existing `canvas.itemIds` as the source of board membership.
- Default missing item stages from item type and context.
- Default old canvases to `kind: "process-board"` when they contain archive items and `kind: "collection"` when they do not.
- Default old canvases to `status: "active"` unless archived behavior exists.
- Keep relationship geometry derived from card positions until manual bend points are explicitly designed.

## Import Flow

The app has existing import paths, plus planned clipboard capture, that should become project-aware:

1. Drag files into the app. The renderer uses `webUtils.getPathForFile` through preload and calls the project import path when a project is active.
2. Paste images or copied image files into a project. Clipboard capture should use the same project import path as drag/drop.
3. Press Import and choose files or Photos. The main process opens a native file picker, or on macOS launches the Swift `FolioPhotosPicker` helper, then imports into the active project.

Project imports are copied to:

```text
~/Documents/Folio/projects/<project-slug-or-id>/images/
```

The file is registered as a `FolioItem`, appended to `Project.imageIds`, and shown in the project's All Images list. Filenames are sanitized and collision-safe. When Electron can read image dimensions, imported images store optional `mediaWidth`/`mediaHeight` values for proportional board card sizing.

Dragging or pasting a new image directly onto a project board should still import it into the project image list first, then add the resulting item to the board's `itemIds` and `positions`. This keeps board content reusable in the project instead of hiding media inside a board-only folder.

Promoting an image to Works updates `Project.workItemIds`. The Works view should reuse the existing strip, grid, and heatmap presentation over that subset of project images.

Loose archive imports can continue to copy to:

```text
~/Documents/Folio/items/YYYY/MM_monthname/
```

This path is useful for migration, legacy archive browsing, or unsorted imports before a project is chosen. Existing files inside `items/` can be registered in place during reconciliation.

Board-local references use a project board path:

```text
~/Documents/Folio/projects/<project-slug-or-id>/boards/<board-id>/references/
```

References belong to one board and do not become project images unless the user explicitly adds or promotes them. Older board references in `~/Documents/Folio/references/<board-id>/` remain valid and should be migrated lazily or read in place.

## Thumbnail Pipeline

Cards, project image lists, Works views, and board previews should not load full source images. The renderer requests small thumbnails through `LazyThumbnail`, which batches visible thumbnail requests over a short frame window before calling `ensureThumbnails`.

The main process generates:

- 320px JPEG thumbnails for image-like project and archive items.
- SVG placeholders for missing files, unsupported media, audio, text, or failed thumbnail generation.
- 320px JPEG reference thumbnails through `ensureReferenceThumbnail`.

Generated files use `-small` suffixes and are served through `folio://thumb/...`. Board browser previews batch their thumbnail request at the board level and then render `LazyThumbnail` with automatic per-card requests disabled.

## Projects Home And Project Workspace UI

Opening the app should show a Projects view, not the archive. The Projects view lists all projects from `projects.json`, supports creating any number of projects, and makes the local project folder easy to reveal in Finder.

Opening a project shows a project workspace with three primary surfaces:

- **All Images**: every image in `Project.imageIds`, including images dragged, pasted, imported, or dropped onto a project board.
- **Works**: the subset in `Project.workItemIds`, shown with strip, grid, and heatmap views so the user can track actual pieces of work over time.
- **Boards**: all canvases owned by the project, with creation, switching, and board canvas editing.

The existing archive strip/grid can remain available as a legacy or global view, but the default product path should be project selection, then project-scoped capture and review. Tags, filters, size controls, and thumbnail behavior should be reused inside project image and Works views before creating parallel UI systems.

Project image views should preserve the current visual behavior where useful:

- A resizable tags sidebar starts open and can collapse to an icon rail when tags are visible.
- Strip view groups items by day and hides empty date groups when a tag filter is active.
- Grid view shows filtered items in a dense card grid.
- Works heatmap shows project work activity, not unrelated global archive activity.
- Both views sort most recent first and share the same card component.
- The status bar should report project image, Works, board, tag, and project folder counts.

Scrollable project surfaces should keep scrollbars visually quiet and only show the main scrollbar on hover.

## Selection Flow

Project image and Works cards support:

- click to select
- Cmd/Ctrl-click to toggle
- Shift-click for range selection across day boundaries
- drag selected items onto an open board
- promote selected project images into Works
- create a new project board from the current selection

When items are selected, the top selection bar remains draggable as part of the window chrome except for its actual buttons.

## Board And Canvas UI

Boards are scoped to the active project. The board panel is minimized by default. When open, it can show either:

- the project board browser, a grid of that project's boards with member previews and a New board action
- a focused board with its name, counts, Add note, Import images, Edit, and minimize controls

Board settings support title and color editing. The selected board color appears as dots on project image cards that belong to that board.

Board headers show `createdAt` and `updatedAt` timestamps instead of object counts. New boards set both fields when created, and board mutations refresh `updatedAt` before the updated `canvases.json` payload is saved. Legacy boards without timestamps remain readable and receive timestamp fields the next time a board save touches them.

Canvas boards use `CanvasViewport`, which renders the dotted background with an actual HTML `<canvas>`. The scrollable surface contains cards, notes, and references as absolutely positioned React elements. Wheel input zooms around the pointer, clamps between the configured min and max zoom, and prevents the page-style scroll effect once the zoom limit is reached.

Canvas project-image cards and references render as image-only objects in the board surface. When source dimensions are known, default card bounds are scaled from the image's natural proportions instead of a single fixed rectangle; legacy items without dimensions use the existing fallback size. Cards, references, notes, and text elements are draggable from any non-control area. Pointer movement beyond the small drag threshold becomes a drag; otherwise the action remains a click. They can also be resized from the lower-right corner; saved dimensions are optional `width`/`height` fields on the same canvas objects, and image cards preserve their aspect ratio while resizing. Remove/delete controls appear on hover or focus. Board text renders in lightweight resizable text boxes, supports `sm`, `md`, and `large` text sizes, and saves typed text after a short debounce.

## Project Home Architecture

The Projects view should become the app's first screen. It should be a renderer-level composition over `projects.json`, `folio.json`, and `canvases.json`:

- Projects list: all projects sorted by active status and `updatedAt`.
- Project cards: title, latest saved date, image count, Works count, board count, and a small thumbnail preview from recent project images or Works.
- New project action: creates a project record, a readable project folder, and empty image/work/board lists.
- Open project action: routes into the project workspace.
- Archive or unsorted access: available as a supporting view, not the default organizing surface.

The Projects view should not derive projects from canvases anymore. Canvases are boards inside projects. The renderer should compute project summaries with memoized selectors, then persist only user edits through `saveFolioData`.

If the view grows expensive, introduce a renderer-side selector module before adding new main-process APIs. A database should remain out of scope until JSON read/write cost or query complexity proves it is necessary.

## Project Timeline Architecture

A project timeline is a derived view from the owning `Project` and its boards:

- Image events come from `Project.imageIds` and each item `date` or `updatedAt`.
- Works events come from `Project.workItemIds` and each promoted item's timeline metadata.
- Reference events come from references in canvases where `canvas.projectId` matches the project.
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

The project timeline should not duplicate source data. It should sort and group existing records into a presentation model, then route edits back to the owning project, item, note, reference, edge, or canvas.

## Reference Graph Architecture

The current `CanvasReference` type is board-local. That is sufficient for drag/drop reference cards, but a Pinterest-like reference library will need a clearer distinction:

- **Board-local reference**: an image or URL captured for one board only.
- **Project image/reference item**: a reusable image stored in a project image list and available across that project's boards.
- **Global reference index**: a future optional store if references need independent browsing before they belong to any board.

The recommended path is incremental:

1. Keep `CanvasReference` board-local and add source metadata.
2. Add a references browser that flattens references across canvases at render time.
3. Add "add to project images" when a reference should become reusable across boards in the same project.
4. Introduce a separate `references.json` only if board-local flattening becomes awkward or references need to exist before board assignment.

Edges should remain attached to canvases because their meaning is spatial and contextual. A connection between a reference and an item on one project board may not mean the same thing elsewhere.

## Edge Rendering Architecture

`CanvasEdge` already exists in the schema. Rendering should be implemented as an SVG overlay inside the same zoomed canvas surface as cards:

- Compute endpoints from each connected object's current position, card bounds, and optional `fromSide`/`toSide` side handles.
- Render curves below cards and above the dotted background.
- Keep edge path data derived, not persisted.
- Store only semantic edge data: IDs, side endpoints, direction, type, label, and timestamps.
- Recompute paths while dragging so edges stay attached.
- Support current board object endpoints: project/archive items, references, notes, and board text elements.
- Render `direction: "none" | "forward" | "bidirectional"` with no arrow, end arrow, or both arrows.

Selection should be local renderer state until the user edits or deletes an edge. Edge creation, label edits, type edits, and deletes should persist through `saveFolioData`.

## Search And Retrieval Architecture

Search should start as a renderer-side in-memory index built from loaded `FolioData`. It should cover:

- project title, description, status, and folder name
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
- Printable project self-review summaries.

Folder access should use existing main-process shell capabilities:

- `openInFinder(filePath)` already opens an individual item.
- Add project-level actions that reveal `~/Documents/Folio/projects/<project-slug-or-id>/`.
- Add scoped actions for project `images/`, `works/`, and `boards/<board-id>/`.
- If a legacy project spans old archive month folders, show a file list or migrate/copy into the project folder before relying on Finder folder access.

No persistent collaborator, comment, permission, or shared-review schema is needed for these flows.

## File Reconciliation

Every item stores a short hash derived from the first 64KB of the file. At launch, Folio scans project `images/` folders and the legacy `items/` archive, compares paths and hashes, then:

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
- Prefer derived renderer view models for Project Home, timelines, backlinks, and search before adding new persisted indexes.
- Add `projects.json` as the next planned split JSON file because projects are now the primary app container.
- Keep other new JSON files optional until the project split plus current split (`folio.json`, `tags.json`, `canvases.json`) becomes a real limitation.

Planned and possible future JSON files:

```text
.folio/
  projects.json      # top-level project records and project ordering
  references.json    # only if references need global life outside boards
  search-index.json  # only if background indexing becomes necessary
```

## Roadmap

Completed MVP foundation:

- Board-local reference capture from drag/drop and file dialog.
- SVG edge rendering and editing for item, reference, note, and text connections.
- Side connector nodes with no-direction, single-direction, and bidirectional edge modes.
- Freehand canvas strokes with board-color ink, eraser, and Cmd+Z undo.
- Editable board text elements that can be dragged, connected, and deleted.
- Local archive import, board membership, notes, thumbnails, tags, and reconciliation.

Near-term roadmap:

- Add `projects.json`, project folders, and app launch into Projects view.
- Add project creation and project folder reveal actions.
- Add project image intake from drag/drop, paste, import, and board drop.
- Add Works promotion and Works strip/grid/heatmap views.
- Scope boards to projects while preserving existing canvas behavior.
- Add item stages so sketches, WIP, final pieces, output, and references are distinct.
- Add project timeline view from existing item/reference/note data.
- Add clipboard paste and URL capture for references.
- Add backlinks and connected-item summaries in detail views.
- Add project folder access actions for images, Works, and board references.

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
