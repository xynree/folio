# Folio — MVP Project Plan

## Stack

- **Electron** + **Electron Forge** — desktop shell and build/packaging pipeline
- **React + Vite** — UI (renderer process), via `@electron-forge/plugin-vite`
- **Node.js** — file watching, filesystem ops, thumbnail generation (main process)
- **`.folio/*.json`** — split flat JSON in `~/Documents/Folio/.folio/` (`folio.json`, `tags.json`, `canvases.json`, planned `projects.json`), single source of truth (no database)
- **`nativeImage`** — thumbnail generation (built into Electron, no native module needed)
- **`chokidar`** — file watching

---

## Product goals

Folio should move from a file archive with boards into a project-based local studio workspace for creative practice. The app has three core jobs:

1. **Projects as the primary workspace** — opening the app shows a Projects view; each project owns its image list, Works view, boards, and local folder.
2. **Interactive studio wall** — within a project, users can upload work, arrange it, track it, and watch Works evolve over days and weeks.
3. **Reference and inspiration graph** — users can collect reference material like a personal Pinterest board, then connect references, notes, work-in-progress, and finished pieces back to specific projects.

The design should preserve these principles:

- **Local-first ownership**: source files remain readable in `~/Documents/Folio`; app metadata stays portable and inspectable in `.folio/*.json`.
- **Fast capture first**: adding work, reference, or notes should take one gesture and should not force metadata decisions up front.
- **Process is first-class**: sketches, references, WIP, final pieces, notes, reviews, revisions, and gaps should all contribute to the record of practice.
- **Spatial thinking plus time**: boards show relationships in space; project image, Works, and review views show how work changes over time.
- **Gentle organization**: tags, projects, statuses, and relationships should help discovery without turning the app into a heavy task manager.
- **Personal review, not collaboration**: project review means self-review inside a private studio surface. The app should not add comments, approvals, assignments, shared cursors, or team workflow.

## Current product read

The completed MVP already provides the archive foundation, local import pipeline, thumbnail cache, daily strip, heatmap, tags, board browser, draggable board cards, notes, and project-image placement on boards. Conceptually, it is strongest as a grouped archive and early spatial board tool.

The next gap is not raw file handling. The next gap is making **Projects** the first-screen organizing model: a user can create any number of projects, import or paste images into a project, promote selected images into Works, and create project boards that use those images.

---

## Phase 1 — Archive: drop images in, see them over time

### 1.1 Scaffold the app

- [x] Run `npm init electron-app@latest folio -- --template=vite-typescript`
- [x] Add React: install `react`, `react-dom`, `@vitejs/plugin-react`, update `vite.renderer.config.ts`
- [x] Configure `BrowserWindow`: minimum 900×600, `titleBarStyle: 'hiddenInset'`
- [x] Add renderer state for project sidebar switching across All Images, Works, Boards, and Review

### 1.2 Define folder structure and JSON schema

- [x] Create `~/Documents/Folio/projects/` and per-project `images/`, `works/`, `boards/`, and `reviews/` folders
- [x] Create `~/Documents/Folio/.folio/thumbs/` on first launch if it doesn't exist
- [x] Define and document the split JSON schema (folio.json, tags.json, canvases.json)
- [x] Write TypeScript types for the full schema (`src/types/`, imported by both main and renderer)

```
~/Documents/Folio/
  projects/
    <project-slug>/
      images/
        figure-study-5.jpg
        hand-gestures.png
      works/
        figure-study-5-<item-id>.jpg
      boards/
        <board-id>/
      reviews/
        review-<review-id>.md
  .folio/               ← hidden app state (analogous to .git/)
    folio.json          ← items metadata and schema version
    tags.json           ← global tags list
    canvases.json       ← canvas structures and positions
    thumbs/             ← generated small thumbnails and placeholders, regenerable
```

Project media folders are flat lists. Folio no longer creates date-bucketed media folders; legacy `items/YYYY/MM_monthname/` folders are migration sources only.

### 1.3 IPC bridge (preload layer)

- [x] Set `contextIsolation: true`, `nodeIntegration: false` on `BrowserWindow`
- [x] Write `src/preload.ts` — expose `window.folio.*` API via `contextBridge`
- [x] Wire each method to an `ipcMain.handle()` in `src/main/base.manager.ts`
- [x] Add TypeScript declaration file so the renderer gets full type checking on `window.folio`

```typescript
// Invocations (renderer → main)
window.folio.getFolioData();
window.folio.saveFolioData(data);
window.folio.copyToFolio(filePaths);
window.folio.importToFolio();
window.folio.copyToProject(projectId, filePaths);
window.folio.importToProject(projectId);
window.folio.deleteItems(itemIds);
window.folio.openFileDialog();
window.folio.ensureThumbnails(itemIds);
window.folio.getFileDataUrl(filePath);
window.folio.getReconciliationResult(); // called once on launch by renderer
window.folio.openInFinder(filePath);
window.folio.getPathForFile(file);

// Events (main → renderer)
window.folio.onFilesAdded(callback);
```

### 1.4 File watcher

- [x] Install `chokidar`, start watching project `images/` folders from the main process on app launch
- [x] On new file detected: check hash against all known `item.hash` values — if it matches an existing item, update `item.path` and clear any `missing` flag rather than creating a duplicate entry
- [x] On new file with no matching hash: date is always the current import date (`new Date()`), infer type from extension (`jpg/png/webp/heic` → sketch, `mp3/wav/aiff` → music, `mp4/mov/gif` → animation, `txt/md/rtf/docx` → text), generate ID with `nanoid`, append to `folio.json`, emit `files-added` IPC event
- [x] Debounce watcher at 300ms to batch rapid drops
- [x] On file deleted: mark item `missing: true` in `folio.json` rather than removing the entry — metadata, tags, and canvas membership are preserved

### 1.5 Filesystem operations (`src/main/*`)

- [x] `saveFolioData()`: atomic writes — split data and write to respective `.json.tmp` files, then rename over target files; the OS-level rename is the crash guard
- [x] `copyToFolio()`: route legacy import calls into the default project and copy files to `projects/<project>/images/<sanitized-name>.<ext>`, handling name collisions with `_2`, `_3` suffix
- [x] `computeHash(filePath)`: read first 64KB of file, return 8-char hex hash using Node's built-in `crypto.createHash('sha256')` — fast enough for large files, unique enough for a personal archive
- [x] Project image imports copy files to `projects/<project>/images/`
- [x] Imported archive and project images store optional natural image dimensions for proportional board card sizing
- [x] `loadFolioData()`: read all three `.json` files in parallel on startup; if missing, create fresh empty schemas via `initialize()`
- [x] File sanitization helper: lowercase, spaces → hyphens, strip special characters

### 1.6 Launch reconciliation

Run once on every app launch, after `loadFolioData()`, before the UI renders. Diffs `folio.json` against what's actually on disk and surfaces any drift.

- [x] **Scan the archive**: walk files under project `images/` folders plus legacy `items/` and root-level `images/` migration sources, then build a set of `{path, hash}` for every file found on disk
- [x] **Find missing files**: items in `folio.json` whose `item.path` no longer exists on disk — mark as `missing: true`
- [x] **Re-locate moved/renamed files**: for each missing item, check if any on-disk file has a matching `item.hash` — if found, update `item.path` to the new location, clear `missing` flag, save silently. This handles manual renames and moves in Finder with no user interaction required
- [x] **Find untracked files**: files on disk with no matching entry in `folio.json` (no path match, no hash match) — these were added manually in Finder
- [x] **Show reconciliation UI if needed**: if there are untracked files or genuinely missing files (missing and no hash match), show a non-blocking notice at the top of the app: `"2 new files found in your Folio folder — add to archive?"` and `"1 file is missing and couldn't be located"` — user can dismiss or resolve
- [x] **Reconciliation is always non-destructive**: never delete metadata, never move files automatically, never block app launch — the UI is fully usable while the notice is present

### 1.7 Thumbnail generation

- [x] Use `nativeImage.createThumbnailFromPath(path, { width: 320, height: 320 })` — built into Electron, no extra dependency
- [x] Write generated archive thumbnails to `~/Documents/Folio/.folio/thumbs/<id>-small.jpg` via `thumb.toJPEG(72)`
- [x] `ensureThumbnails(ids[])`: skip already-cached items, process missing ones sequentially, and repair missing flags when files have reappeared
- [x] For audio, text, unsupported media, and missing files: create static SVG placeholders in the thumbs cache
- [x] Renderer loads thumbnails from the main-process `folio://thumb/...` protocol so dev-server origins do not block local media
- [x] Renderer batches visible thumbnail requests in `LazyThumbnail` so many cards entering the viewport do not fan out into one IPC call per card

### 1.8 Drop files into the app

- [x] Renderer: `onDragOver` + `onDrop` on the root div
- [x] Extract file paths with `webUtils.getPathForFile(file)` (Electron 28+)
- [x] Call `window.folio.copyToFolio(paths)`, update React state with returned item objects
- [x] Show toast: "N items added to today"
- [x] File watcher deduplication: when `copyToFolio()` copies a file, it adds the destination path to a short-lived `recentlyCopied` Set that clears each entry after 2 seconds; when the watcher fires on that same path it checks this set first and skips without hashing — fast path for the common case

### 1.9 Import button

- [x] Floating Import button next to the size control and Strip/Grid selector calls `window.folio.importToFolio()`
- [x] Main process prompts for either local files or, on macOS, the Photos picker helper
- [x] Local file imports use the same `copyToFolio` path as drag-and-drop
- [x] Photos imports export selected Photos library assets to a temporary folder, copy them into Folio, and clean up the temporary export folder

### 1.10 Daily strip view

- [x] Render all dates from earliest item to today, most recent at top
- [x] Empty date rows: faint dash line when no tag filter is active (gaps are part of the record, not hidden)
- [x] Hide empty date rows when a tag filter is active so selected tags do not render unrelated day headers
- [x] Thumbnails lazy-loaded with `IntersectionObserver`
- [x] Scroll position persisted in `sessionStorage`

### 1.11 Grid view

- [x] CSS grid: `auto-fill, minmax(148px, 1fr)`
- [x] Sort most recent first automatically
- [x] Grid filter pills show `All` plus only user-created tags from `tags.json`
- [x] Same lazy thumbnail loading as strip

### 1.12 Status bar

- [x] Display: N items · N canvases · N tags · N gaps · `~/Documents/Folio/`

### 1.13 Archive controls and heatmap

- [x] Floating archive action bar includes Size, Strip/Grid icon-only toggle, and Import controls
- [x] Size scale ranges from 50% to 200% and scales thumbnails, card text, spacing, and board dots
- [x] Bottom heatmap is part of the Works layout rather than a separate mode
- [x] Heatmap uses green intensity with a max bucket of 8 Works per day
- [x] Heatmap can minimize/restore with a transition and scroll horizontally when it overflows

---

## Phase 2 — Organize: tags and canvases

### 2.1 Item details modal

- [x] Clicking an item selects it; item editing opens from the card `More (...)` menu via `Edit`
- [x] Details open in a centered modal with a light blurred overlay so the rest of the UI is not interactive
- [x] Show: thumbnail preview, title, notes/description, file type, and board membership chips
- [x] Title/notes edits stay local until the user clicks `Save`, then persist with `saveFolioData`
- [x] "Show in Finder" button: `window.folio.openInFinder(filePath)`
- [x] Delete button moves the file to Trash, removes metadata, and clears canvas memberships
- [x] Click outside or press Escape to close

### 2.2 Tags

- [x] Tag input in details modal: type name + Enter to add, x to remove
- [x] Card `More (...)` menu includes an `Add tags` submenu where existing user tags can be toggled on or off for that item
- [x] Store tag IDs in `item.tagIds[]`, deduplicate global records in `tags.json`
- [x] Show tag chips on grid/strip cards and in detail modal
- [x] Sidebar TAGS section: list all tags with item count, expand to see thumbnail strip
- [x] Clicking a tag in sidebar filters the active view to items with that tag
- [x] Tags sidebar is compact, starts auto-collapsed, and can be expanded/restored

### 2.3 Multi-select

- [x] ⌘+click (macOS) / Ctrl+click to toggle selection
- [x] Shift+click for range select in strip and grid views
- [x] Amber border on selected items
- [x] Selection hint bar: "N items selected" and "Drag onto a board", centered in the top bar
- [x] Selection action: create a new board from the current selection
- [x] Escape or click background to clear selection

### 2.4 Open items on a board

- [x] Boards are a project sidebar view rather than a persistent side dock next to the Strip/Grid archive area
- [x] With items selected in strip/grid, user can create a board pre-populated with the selection
- [x] Detail modal can add the current item to the active board, creating a new board if needed
- [x] Focused board header can import new archive items directly onto the active board
- [x] New board: auto-assign color from warm palette, save to `canvases.json`
- [x] Items can appear on multiple boards simultaneously — board membership reflects what's been added to each board

### 2.5 Board list and edit menu

- [x] Boards view opens to either a board browser grid or a focused active board
- [x] Board browser cards show colored dot, board name, item count, and member thumbnail preview grid (max 8)
- [x] Board browser contains the New board action; focused boards have a back button that returns to the browser
- [x] Focused board header shows Add note, Import images, drawing/text tools, folder, undo, and Edit actions in one row
- [x] Board edit popover supports rename, color picker, save, and delete board
- [x] Canvas dots shown under strip/grid thumbnails (one smaller colored dot per board membership)
- [x] Board chips shown in detail modal

---

## Phase 3 — Canvas: the thinking surface

### 3.1 Canvas view entry

- [x] Canvas boards live in the project sidebar's Boards view, not in a persistent side dock beside the archive
- [x] Board browser shows all boards and creates new boards
- [x] Opening a board loads its items, positions, notes, text, strokes, and edges exactly as left
- [x] Header shows board name, colored dot, created/saved timestamps, and board actions
- [x] Switching boards loads persisted state from `canvases.json`

### 3.2 Draggable item cards and drag-in from strip/grid

- [x] Items positioned absolutely on a large scrollable canvas surface (2400×1800px to give room to spread)
- [x] Drag: pointer down → track pointer move delta → pointer up saves position to `canvases.json`
- [x] Positions stored per canvas in `canvases.json` under `canvas.positions`
- [x] Existing project images can be added to an open board from a scrollable project-image tray
- [x] Canvas archive rail was removed; archive-to-board placement now happens by the board image tray, selection actions, details modal, board import, or dropping new external images onto the canvas
- [x] First-time layout: auto-arrange in a loose grid if no saved positions
- [x] Dotted grid background rendered by an HTML `<canvas>` backing layer, with zoom-aware drawing
- [x] Wheel zoom clamps to the configured min/max range and prevents the surrounding app from page-scrolling when the range limit is reached

### 3.3 Canvas notes

- [x] Add note button in the focused board header creates a note card on the canvas surface
- [x] Note card: amber header strip, editable textarea, delete action
- [x] Click note body to edit, blur to save and exit
- [x] Empty note on blur: auto-delete
- [x] Notes saved to `canvas.notes[]` in `canvases.json`

### 3.4 Project images on the canvas

Images dropped onto boards are imported into the project first, then added to the board as reusable project image cards.

- [x] Drop image files directly onto the canvas to import project images and place them at the drop position
- [x] Import images button in the focused board header imports archive items directly onto the active board
- [x] Project image cards use generated small thumbnails and can be dragged, resized, removed from the board, and connected to notes or text
- [x] Board membership stays in `canvas.itemIds[]` and item positions stay in `canvas.positions`

### 3.5 Edges and side connectors

- [x] Each card-like canvas object exposes FigJam-style side connector nodes at the middle of the top, right, bottom, and left edges
- [x] Connector nodes work for archive item cards, notes, and board text elements
- [x] Drag from one connector node to another to draw a connection edge
- [x] Hold Shift and drag from one item, note, or text card to another as a shortcut to draw a connection edge
- [x] Edge renders as a derived SVG curve between the selected sides, with an optional label
- [x] Edge direction can be changed between no direction, single direction, and bidirectional; single-arrow links can be reversed from the selected-link toolbar
- [x] Click an edge to select it; double-click to edit the label inline
- [x] Delete selected edge with Backspace/Delete or the remove action in the selected-link toolbar
- [x] Edges stored as `{ id, fromId, toId, fromSide?, toSide?, direction?, label? }` in `canvas.edges[]`
- [x] Edges update position dynamically as cards are dragged

### 3.6 Freehand strokes and board text

- [x] Pen tool in canvas toolbar toggles freehand drawing mode
- [x] Pen mode renders a pen cursor over the canvas surface
- [x] Draw directly on the canvas surface — to circle items, annotate, sketch quick marks
- [x] Strokes render as SVG paths overlaid on the canvas
- [x] Stroke color inherits canvas color by default
- [x] Strokes stored as `{ id, path, color }` in `canvas.strokes[]`
- [x] Undo (⌘Z) removes last stroke
- [x] Eraser mode renders an eraser cursor with a visible hit circle and deletes intersecting strokes on click or drag
- [x] Text tool places editable text elements directly on the canvas surface
- [x] Text elements can be edited, dragged, connected, and deleted; text is stored in `canvas.texts[]`

---

## Phase 4 — Projects: first-screen workspace containers

This phase turns the current archive and board system into a project-based creative workspace. The goal is to answer: What projects exist? What images belong to each project? Which images are actual Works? Which boards help think through the project?

### 4.1 Project model and launch flow

- [x] Add `projects.json` to the split metadata schema.
- [x] Define `Project` with `id`, `title`, `description`, `status`, `createdAt`, `updatedAt`, `folderPath`, `imageIds`, `workItemIds`, and `boardIds`.
- [x] Open the app to a Projects view that lists all projects instead of opening directly to the archive/board workspace.
- [x] Let the user create any number of projects from the Projects view.
- [x] Project creation should create a readable folder at `~/Documents/Folio/projects/<project-slug-or-id>/`.
- [x] Each project folder should include `images/`, `works/`, `boards/`, and `reviews/` subfolders.
- [x] Add a migration path that creates a default project for existing archive items and existing canvases.
- [x] Assign existing canvases to the default project with `canvas.projectId` and `project.boardIds`.
- [x] Define project as a personal studio container, not a collaborative workspace; avoid collaborator, owner, assignee, review-request, comment-thread, or approval concepts.

### 4.2 Project image intake

- [x] Add an All Images view inside each project, backed by `Project.imageIds`.
- [x] Dragging image files into an open project should copy them into `projects/<project>/images/`, create `FolioItem` records, and append them to `Project.imageIds`.
- [x] Pasting images or copied image files into an open project should use the same import path as drag/drop.
- [x] The Import button and macOS Photos picker should import into the active project when a project is open.
- [x] Dropping a new image directly onto a project board should first add it to the project's All Images list, then place it on the board.
- [x] Imported project images should continue to store optional `mediaWidth` and `mediaHeight` for proportional canvas card sizing.
- [x] Reconciliation should scan project `images/` folders in addition to legacy `items/` and root-level `images/` migration sources.

### 4.3 Works view

- [x] Let users select one or more project images and mark or unmark them as Works.
- [x] Store Works membership as `Project.workItemIds`, a subset of `Project.imageIds`.
- [x] Show Works with the existing strip, grid, and heatmap views, scoped to the active project.
- [x] Works should represent the actual pieces of work being tracked, not every captured reference or process image.
- [x] Keep Works lightweight: promoting to Works should not force stage, tag, title, or board assignment decisions.
- [x] Add a user-accessible `works/` folder representation for promoted Works, while keeping canonical membership in `projects.json` so it can be reconciled.
- [x] Add item `stage`: `sketch`, `wip`, `process`, `final`, `note`, `other` only after Works membership exists, so stage does not carry the burden of identifying Works.

### 4.4 Project boards

- [x] Let each project have any number of boards.
- [x] Scope the board browser to the active project by `Project.boardIds` and `canvas.projectId`.
- [x] Creating a board from inside a project should create a `Canvas` owned by that project.
- [x] Existing canvas behavior remains the project board surface: draggable image cards, notes, board text, strokes, and edges.
- [x] Any image in `Project.imageIds` should be available to place on any board in that project.
- [x] Existing project images are available in a scrollable tray beside the focused board, with Added/Missing states.
- [x] Board media should come from reusable project images while board membership remains in `canvases.json`.
- [x] Keep board headers focused on created/saved timestamps and board actions, not object counts.
- [ ] Board edit UI can expose board kind, status, brief, and outcome later without cluttering quick rename/color editing.

### 4.5 Local folder access and tracking

- [x] Add "Open project folder" from the Projects view and project workspace.
- [x] Add a single project folder action that opens the readable `projects/<project>/` folder.
- [x] Ensure all project images, Works membership, and canvases are recoverable from local files plus `.folio/*.json`.
- [x] Keep source images readable in project folders and metadata inspectable in `.folio/projects.json`, `.folio/folio.json`, and `.folio/canvases.json`.
- [x] Keep file operations non-destructive; reconciliation should mark missing files and repair moved paths by hash where possible.
- [x] Preserve the legacy archive path as a migration and unsorted-import fallback, not the main product surface.

### 4.6 Project review and progress timeline

- [x] Add a project detail/timeline view from the owning `Project`, not from a single board.
- [x] Timeline should combine project images, Works, notes, review documents, and relationship changes in chronological order.
- [x] Group timeline entries by day, week, or milestone depending on density.
- [x] Add project recap metadata: image count, Works count, review count, board count, active days, first image date, latest saved date.
- [x] Expand heatmap meaning from upload volume to Works activity in the project Works view.
- [x] Keep review timeline entries focused on project progress, with image activity shown as thumbnail grids instead of board-jump actions.
- [x] Add relationship type `version-of` or a dedicated `ItemRevisionGroup` to connect iterations of the same work.
- [x] Let a project have multiple Markdown reviews, each taggable to one or more Works.

---

## Phase 5 — Canvas workspace: FigJam/MelloNote-style boards

This phase turns project Boards from a spatial image board into a flexible thinking canvas. A board should make it easy to drop images into the view, add text, attach documents, save outside links, connect any objects, organize content into sections, and start from built-in templates. The board remains local-first and single-user: source files stay in the project folder and board structure stays in `.folio/canvases.json`.

Phase 5 should be implemented as an additive evolution of the current board system. Do not rewrite the whole canvas at once. First introduce a clearer canvas-object model and helper layer, then add new node types and templates on top of it.

### 5.1 Product scope and non-goals

- [x] Define Phase 5 acceptance criteria before implementation:
  - A user can create a blank board or choose a template.
  - A user can drop project images, external image files, documents, text snippets, and URLs directly onto a board.
  - Dropped external files are imported into the active project before being placed on the board.
  - A user can connect any supported board object to any other supported board object.
  - A user can select multiple objects, move them together, align them, distribute them, and tidy them into a grid.
  - A user can save, close, and reopen a board with object positions, sections, links, documents, edges, and viewport restored.
- [x] Keep collaboration out of scope: no shared cursors, comments, assignments, permissions, or live multiplayer state.
- [x] Keep a full database out of scope unless JSON persistence becomes a measured bottleneck.
- [x] Keep templates editable after creation; templates should seed content, not lock board structure.

### 5.2 Storage and schema foundation

- [x] Add a schema migration plan before changing persisted board data.
- [x] Keep `Canvas.itemIds`, `Canvas.positions`, `Canvas.notes`, `Canvas.texts`, `Canvas.edges`, and `Canvas.strokes` readable for old boards.
- [x] Add `Canvas.sections?: CanvasSection[]` for section/frame nodes:

```ts
interface CanvasSection extends CanvasObjectGeometry {
  id: string;
  title: string;
  color?: string;
  collapsed?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
```

- [x] Add `Canvas.links?: CanvasLink[]` for outside-link cards:

```ts
interface CanvasLink extends CanvasObjectGeometry {
  id: string;
  url: string;
  title: string;
  description?: string;
  sourceDomain?: string;
  faviconUrl?: string;
  capturedAt: string;
  updatedAt?: string;
}
```

- [x] Treat documents as normal `FolioItem` records so they can be reused across boards and details:
  - Add or formalize a per-project `documents/` folder for imported PDF, Markdown, text, RTF, and office files.
  - Continue storing visual images in `projects/<project>/images/`.
  - Keep `works/` as a readable generated representation of Works membership, not a separate import location.
- [x] Decide whether Phase 5 renames `Project.imageIds` to `Project.itemIds` or keeps the current field as a compatibility alias:
  - Preferred long-term shape: `itemIds` for all project assets and a derived image filter for the All Images view.
  - If renaming is too disruptive, keep `imageIds` for now and document that it is a legacy project-asset list.
- [x] Add `createdAt` and `updatedAt` timestamps to all new canvas objects.
- [x] Keep edge paths derived from object geometry; do not persist SVG path data unless manual bend points are designed later.

### 5.3 Canvas object model refactor

- [x] Add a colocated canvas-object helper module, for example `src/components/canvas/canvasObjects.ts`.
- [x] Introduce a renderer view model over all board objects:

```ts
type CanvasObjectKind =
  | "item"
  | "note"
  | "text"
  | "document"
  | "link"
  | "section";

interface CanvasObjectView {
  id: string;
  kind: CanvasObjectKind;
  geometry: CanvasObjectGeometry;
  title: string;
  connectable: boolean;
  selectable: boolean;
}
```

- [x] Use this view model for selection, dragging, resizing, connector handles, edge endpoint calculation, keyboard delete, and hit testing.
- [x] Keep persisted data in existing arrays until the view model proves stable.
- [x] Extract canvas mutations into named helpers near `CanvasView`:
  - `addItemsToCanvas`
  - `addDocumentToCanvas`
  - `addLinkToCanvas`
  - `addSectionToCanvas`
  - `moveCanvasObjects`
  - `resizeCanvasObject`
  - `deleteCanvasObjects`
  - `duplicateCanvasObjects`
- [x] Add unit tests for every canvas mutation helper before wiring the UI.

### 5.4 Node creation and capture flows

- [x] Replace the current board header tool cluster with a compact canvas toolbar:
  - Select
  - Connect
  - Image
  - Note
  - Text
  - Document
  - Link
  - Section
  - Pen
  - Eraser
- [x] Keep tool buttons icon-first with tooltips and clear active states.
- [x] Add paste support:
  - image clipboard data imports into project `images/`, then places an image card on the board
  - copied files import into the correct project folder, then place cards on the board
  - URL text creates a link card
  - plain text creates a note or text element depending on active tool
- [x] Add drag/drop support:
  - image files import into `images/`
  - document files import into `documents/`
  - URLs create link cards
  - project-image tray cards can still be clicked to add existing images
- [ ] Add a link card creation popover with URL, title, optional description, and source domain. The current implementation uses a prompt plus editable link card fields.
- [x] Add document cards that show filename, extension/type, and route to the item details drawer for preview/Finder actions.
- [x] Add text nodes that can behave as headings, labels, or paragraph notes without becoming oversized cards.

### 5.5 Connections and graph behavior

- [x] Keep visible side connector handles for all connectable object kinds.
- [x] Add a dedicated Connect tool in addition to Shift-drag so the feature is discoverable.
- [x] Extend relationship types to:
  - `related`
  - `inspired-by`
  - `uses`
  - `variant-of`
  - `version-of`
  - `response-to`
  - `part-of`
- [x] Keep optional freeform edge labels in addition to relationship type.
- [x] Add a quick relationship menu after creating an edge.
- [x] Add inline edge label editing on double-click.
- [x] Keep edge direction controls: none, forward, bidirectional.
- [ ] Add "Connected to" backlinks in item/document/link details, grouped by relationship type.
- [ ] Add "Appears on" project and board backlinks in item/document details.
- [x] Add tests for edge creation, deletion, label editing, type changes, direction changes, and endpoint recalculation after object movement.

### 5.6 Sections, frames, and organization

- [x] Add section/frame nodes with title, color, bounds, and collapsed state.
- [x] Let cards be dragged into sections while preserving absolute canvas positions.
- [x] Render section headers as lightweight board structure, not decorative cards.
- [x] Add section actions: rename, collapse/expand, duplicate, delete.
- [ ] Add a dedicated section recolor control. Sections already persist color, and templates/new sections apply the board color.
- [x] Add marquee/lasso selection on the canvas.
- [x] Allow moving multiple selected objects together.
- [x] Add align left, align top, align center, distribute horizontal, distribute vertical, and tidy grid actions.
- [x] Add "organize selected into section" from the selection action bar.
- [x] Add "arrange by date" and "arrange by type" for selected project items.
- [x] Add keyboard shortcuts for delete, escape, duplicate, zoom reset, fit to content, and zoom to selection.

### 5.7 Built-in templates

- [x] Add a new-board template picker before creating a board.
- [x] Store templates as TypeScript definitions, not persisted records. Applying a template creates normal sections, notes, text elements, and optional starter links.
- [x] Keep `createdFromTemplate?: string` on `Canvas` only as optional provenance.
- [x] Include these first templates:
  - **Blank board**: empty spatial canvas.
  - **Project planning**: Brief, References, Work in progress, Final pieces, Open questions.
  - **Moodboard**: Visual references, Color/material, Type/tone, Patterns, Notes.
  - **Research map**: Sources, Claims/ideas, Evidence, Open questions, Follow-ups.
  - **Work review**: Current Works, Revisions, Feedback notes, Next experiments.
  - **Process timeline**: Early sketches, Iterations, Decisions, Final direction.
  - **Comparison board**: Option A, Option B, Shared patterns, Tradeoffs.
- [x] Template definitions should include:
  - board title suggestion
  - default color
  - sections with positions and sizes
  - starter text/note prompts
  - optional initial zoom/viewport
- [x] Add template unit tests that assert generated objects have stable IDs, valid bounds, no overlapping required sections, and complete timestamps.

### 5.8 Navigation, viewport, and performance

- [x] Add zoom controls in a corner overlay or board header.
- [x] Add fit-to-content and zoom-to-selection.
- [x] Add saved viewport per board:

```ts
interface CanvasViewportState {
  x: number;
  y: number;
  zoom: number;
  updatedAt: string;
}
```

- [x] Add minimap only after content exceeds the visible viewport by a meaningful threshold.
- [x] Add search-within-board that highlights matching image titles, document names, link titles, notes, text elements, section names, and edge labels.
- [ ] Measure board performance with 100, 250, and 500 objects before adding virtualization.
- [x] Keep thumbnail usage for image cards and only load originals when editing or previewing.

### 5.9 Testing and verification plan

- [x] Add model tests next to every new helper:
  - `canvasObjects.test.ts`
  - `canvasTemplates.test.ts`
  - `canvasArrangement.test.ts`
  - `canvasLinks.test.ts`
- [x] Add React tests for:
  - template picker
  - toolbar active states
  - document card rendering
  - link card rendering
  - section collapse/expand
  - multi-select and selection action bar
  - connect tool and quick relationship menu
- [x] Add main-process tests for:
  - document import into `documents/`
  - image import into `images/`
  - dropped URL metadata persistence
  - schema migration for old canvases
  - folder reconciliation with new document assets
- [x] Run before considering Phase 5 complete:
  - `npm test`
  - `npm run test:coverage`
  - `npm run lint`
  - `npm run package`
- [x] Preserve the repository coverage bar above 85% for statements, functions, and lines.

### 5.10 Implementation order

1. **Canvas object foundation**: add view-model helpers, tests, and existing-object adapters without UI changes.
2. **Schema and folder migration**: add sections, links, document folder support, and migration tests.
3. **Toolbar and creation flows**: add tools for image, note, text, document, link, and section creation.
4. **Drop and paste capture**: route files, URLs, images, and text into the active board.
5. **Connection upgrades**: add connect mode, expanded relationship types, quick label/type editing, and backlinks.
6. **Selection and arrangement**: add lasso, multi-move, align, distribute, tidy grid, duplicate, and delete.
7. **Templates**: add template definitions, chooser UI, preview, and template application tests.
8. **Navigation polish**: add saved viewport, fit-to-content, zoom-to-selection, and optional minimap.
9. **Performance and QA**: test large boards, keyboard paths, accessibility, package build, and data migration.

---

## Phase 6 — Search, retrieval, and intelligence

This phase makes a larger project library useful without requiring perfect manual organization. It should build on the richer Phase 5 canvas objects and relationships rather than adding a separate database too early.

### 6.1 Search foundation

- [ ] Add global search across item titles, descriptions, tags, board titles, notes, reference metadata, and edge labels.
- [ ] Add scoped search for current project or board.
- [ ] Add saved filters for common queries such as "unused references", "active WIP", and "recent final pieces".
- [ ] Add sort controls: newest, oldest, recently edited, project, stage, title.
- [ ] Add "needs sorting" filter for items with no board, no tag, and no stage edits.

### 6.2 Metadata extraction

- [ ] Store basic file metadata: size, dimensions, extension, importedAt, and optional original created date.
- [ ] Add OCR for screenshots and text-heavy images only if local-first processing remains practical.
- [ ] Add color palette extraction for image references and work items.
- [ ] Add duplicate/near-duplicate detection beyond first-64KB hash.
- [ ] Add optional generated contact sheets per project or board.

### 6.3 Suggested organization

- [ ] Suggest tags from filename, folder, board context, and existing tag vocabulary.
- [ ] Suggest adding unsorted items to active projects or boards based on import timing and visual/source similarity.
- [ ] Suggest relationship links between references and work only as optional prompts; never auto-create graph edges without user approval.
- [ ] Add "review suggestions" queue that can be accepted, edited, or dismissed.
- [ ] Keep all intelligent features optional and local-first where possible.

---

## Phase 7 — Longer-term directions

These ideas should not block the project workspace and reference graph MVP, but they describe where the product can go after the core loop works.

### 7.1 Export and presentation

- [ ] Export a project board as an image or PDF contact sheet.
- [ ] Export a board snapshot as a shareable outside file without introducing in-app collaboration state.
- [ ] Export a project timeline as Markdown.
- [ ] Export selected work and references into a portable folder with metadata JSON.
- [ ] Add "presentation mode" for a board: clean view, hide controls, step through sections or reviewed Works.
- [ ] Add printable project review summaries.
- [ ] Add scoped folder actions only for current project folders that need direct Finder access.

### 7.2 Sync and portability

- [ ] Keep single-user local-first as the default product shape.
- [ ] Design cloud sync only after conflict rules are specified for JSON metadata, moved files, and duplicate imports.
- [ ] Consider Git-like metadata history for `.folio` changes before adding multi-device sync.
- [x] Add explicit backup/export workflow before any networked sync. (Backup to the opposite location plus non-destructive restore, with a configurable Documents/iCloud Drive source of truth.)
- [ ] Keep readable file layout as a non-negotiable constraint.

### 7.3 Collaboration and sharing

- [ ] Treat collaboration as out of scope for the app surface.
- [ ] Do not add shared projects, invitations, comments, approvals, tasks, or team review states.
- [ ] Support sharing only by exporting outside artifacts such as board snapshots, contact sheets, Markdown timelines, or portable project folders.
- [ ] Let users access the folders related to a project directly in Finder so they can manage or share files outside Folio.
- [ ] Consider external feedback as imported artifacts only: screenshots, notes, PDFs, or files that the user adds back into a personal project.

---

## Cross-cutting concerns

### Data integrity

- [x] All split JSON writes atomic: write `.tmp` beside the target file, then rename over the real file (OS rename is crash-safe; no `.bak` file)
- [x] Schema validation on load: check `version` field and required keys; surface a clear error to the user if invalid (no `.bak` fallback)
- [x] React state is live working copy; meaningful edits persist through `saveFolioData`
- [x] Every item carries a `hash` (first-64KB SHA-256, truncated to 8 hex chars) used to re-locate files that were renamed or moved outside the app
- [x] Every item carries a `missing` boolean — set when a file can't be found and no hash match exists; cleared automatically if the file reappears
- [x] Canvas membership is derived from `canvas.itemIds[]` — no separate denormalized list on items
- [x] Reconciliation runs at every launch: silent auto-fix for moved files, non-blocking notice for untracked or genuinely missing files

### IPC security

- [x] `contextIsolation: true`, `nodeIntegration: false` on all windows
- [ ] Validate and sanitize all IPC arguments in main process before acting

### Performance

- [x] Thumbnails generated sequentially by `ensureThumbnails`, never blocking the main process event loop
- [x] Strip and grid use `IntersectionObserver` for lazy loading
- [x] Strip, grid, board previews, and canvas image cards use generated small thumbnails instead of loading full source files
- [x] Visible thumbnail requests are batched in the renderer before crossing IPC
- [x] Board browser prefetches preview thumbnails in one batch and disables duplicate per-card requests for those previews
- [x] Split JSON state read once at startup, kept in memory, written only on change
- [x] `recentlyCopied` is an in-memory `Set<string>` on the main process; entries are added by `copyToFolio()` and auto-deleted after 2 seconds via `setTimeout`
- [x] File watcher debounced at 300ms

### File naming and paths

- [x] Destination resolved from active project: `~/Documents/Folio/projects/<project>/images/`
- [x] Legacy month folders (`items/YYYY/MM_monthname/`) are migration sources only and are not created for new imports
- [x] Filename: original name, sanitized — lowercase, spaces → hyphens, special characters stripped
- [x] Name collision within the same project media folder: append `_2`, `_3`, etc. before the extension
- [x] `item.title` defaults to filename without extension; user can rename at any time
- [x] `item.path` stores relative path from `~/Documents/Folio/` (e.g. `projects/studio-archive/images/figure-study.jpg`) — used to locate files and rebuild thumbnails if the cache is deleted

### Accepted file types

- [x] Images: `jpg`, `jpeg`, `png`, `gif`, `webp`, `heic`
- [x] Audio: `mp3`, `wav`, `aiff`, `m4a`
- [x] Video: `mp4`, `mov`
- [x] Text and documents: `txt`, `md`, `rtf`, `docx`
- [x] Other files can be copied and tracked as generic `other` items with placeholders

### Packaging

- [ ] `forge.config.ts`: add `@electron-forge/maker-dmg` for macOS `.dmg`
- [x] Confirm all three Vite targets (main, preload, renderer) build cleanly

---

## Out of scope for MVP

- Social / sharing / circle
- Juxtapose view
- Rediscovery nudge
- Cloud sync
- Mobile
- Windows (macOS first)
