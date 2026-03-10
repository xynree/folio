# Folio — Architecture

## The big picture

Electron gives you two JavaScript environments running simultaneously and talking to each other. Understanding that split is the whole architecture.

```
┌──────────────────────────────────────────────────────────┐
│                      Electron App                        │
│                                                          │
│  ┌───────────────────┐        ┌────────────────────────┐ │
│  │   Main Process    │        │   Renderer Process     │ │
│  │   (Node.js)       │◄──IPC──►   (Chromium + React)  │ │
│  │                   │        │                        │ │
│  │  - File system    │        │  - All UI              │ │
│  │  - File watcher   │        │  - Strip / grid views  │ │
│  │  - Thumbnails     │        │  - Canvas view      │ │
│  │  - folio.json     │        │  - Long view           │ │
│  │  - Reconciliation │        │  - Sidebar             │ │
│  └───────────────────┘        └────────────────────────┘ │
│            │                            │                 │
│     ~/Folio/ on disk              React state             │
└──────────────────────────────────────────────────────────┘
```

The main process is like a small backend. The renderer is like a browser tab. They never share memory — they pass messages through IPC. A crash or bug in the UI can't affect the filesystem code, and vice versa.

## The three-layer structure

### Layer 1: Main process

Node.js with full filesystem access. Runs in the background for the lifetime of the app. Everything that touches disk happens here and only here: reading and writing `folio.json`, watching the archive folder, copying imported files, generating thumbnails, and running launch reconciliation. It never touches the UI directly.

### Layer 2: Preload script

A thin typed bridge between main and renderer. Uses Electron's `contextBridge` API to expose a clean `window.folio.*` interface to the UI — without giving the UI any direct access to Node.

```typescript
contextBridge.exposeInMainWorld("folio", {
  getFolioData: () => ipcRenderer.invoke("get-folio-data"),
  saveFolioData: (data) => ipcRenderer.invoke("save-folio-data", data),
  copyToFolio: (paths) => ipcRenderer.invoke("copy-to-folio", paths),
  onFilesAdded: (cb) => ipcRenderer.on("files-added", cb),
});
```

With `contextIsolation: true` and `nodeIntegration: false`, the renderer can only call what is explicitly listed here. It cannot accidentally call `fs.unlink()` or access any other Node API. The preload script is the security boundary.

### Layer 3: Renderer

A normal React app running inside Chromium. It has no idea it's inside Electron — it calls `window.folio.getFolioData()` the same way a web app calls `fetch('/api/data')`. All UI logic, state, and view rendering lives here.

---

## Why `folio.json` instead of a database

The right storage format is the one that matches the shape of the problem. Folio's data is small, single-user, and needs to be portable.

**The data is small.** Each item is around 200 bytes of metadata — a title, a relative path, a date, tags, canvas IDs, a hash. A serious artist making work every day for five years accumulates around 1,800 items. That's under 400KB of JSON. There is no query volume, no concurrency, nothing that would stress a flat file.

**It should be readable without the app.** If Folio stops working, the user can open `folio.json` in any text editor and see exactly what's in it. A database requires tooling to inspect. For an archive of someone's creative work — something that should outlast any particular piece of software — human-readability matters.

**It's portable.** The entire state of the app is one file alongside the images. Put it in iCloud, email it, copy it to a new machine. No migration scripts, no connection strings, no schema versions to manage beyond a single `version` field.

**It's simpler to implement correctly.** The only tricky part is atomic writes: write new content to `.folio/folio.json.tmp`, then rename it over `.folio/folio.json`. The OS-level rename is atomic — if the process dies mid-write, the original file is untouched. That's about five lines of Node.js. Setting up a database with proper concurrency handling and migrations in Electron is significantly more work for no benefit at this scale.

The one real limitation is concurrent writes — if two processes tried to write `folio.json` simultaneously they could conflict. But Folio has one user and one window, so this isn't a real concern.

---

## Why no backend

A backend implies a server, which implies the app requires a network connection to function. Folio should work completely offline — you're in your studio, the internet is irrelevant. A backend also introduces deployment, authentication, API versioning, and infrastructure cost. None of that is justified for a single-user local tool.

The main process already fills the role a backend would play: handling data access, enforcing business logic, managing files. The separation of concerns is preserved — it's just all happening locally on the user's machine.

The only scenario where a backend would make sense is multi-device sync: two machines writing to the same archive simultaneously. That's a genuinely different problem requiring conflict resolution and a sync protocol. It's out of scope for the MVP and would represent a fundamental architecture change when it eventually arrives.

---

## The IPC pattern

Every operation the UI needs follows the same request-response flow:

```
User does something in React
  → calls window.folio.someCommand(args)
    → ipcRenderer.invoke('some-command', args)   [preload]
      → ipcMain.handle('some-command', handler)  [main]
        → does filesystem work
          → returns result
    → Promise resolves with result
  → React updates state
```

This deliberately mirrors how a web app calls an API. The main process is the server; the renderer is the client. Any developer familiar with web development already understands the pattern.

For events the main process initiates — the file watcher detecting a new file, reconciliation finding a moved one — the flow reverses:

```
File watcher detects new file in ~/Folio/
  → main adds item to folio.json
  → mainWindow.webContents.send('files-added', newItem)
    → ipcRenderer.on('files-added', cb)  [preload forwards to renderer]
      → React adds item to state, UI updates
```

---

## The `.folio/` hidden directory

All app-managed state lives in a single hidden directory at `~/Folio/.folio/`. This is deliberately analogous to `.git/` — it's a clear separation between the user's files and the app's bookkeeping.

```
~/Folio/
  2026/
    02-february/
      figure-study.jpg        ← user's files
  references/
    <canvas-id>/              ← canvas reference images
  .folio/                     ← app state (hidden in Finder by default)
    folio.json                ← single source of truth
    folio.json.tmp            ← in-flight atomic write (transient)
    thumbs/                   ← generated thumbnail cache
```

The user's root folder — year folders and `references/` — is completely clean. Finder hides `.folio/` by default on macOS. If the user wants to inspect or back up their data, they can `ls -a ~/Folio/` and open `.folio/folio.json` in any text editor.

The thumbnail cache in `.folio/thumbs/` is fully regenerable from the archive. If a user deletes `.folio/` entirely, Folio recreates it on next launch and rebuilds thumbnails in the background.

---

## File organisation

Folio organises imported files into a year/month folder structure automatically:

```
~/Folio/
  2026/
    01-january/
      new-year-figure.jpg
    02-february/
      figure-study.jpg
      hand-gestures.png
  references/
    <canvas-id>/
  .folio/
    folio.json
    thumbs/
```

The destination is always computed from the **import date** — when the file was dragged into Folio — not the file's creation date or any embedded metadata. This makes the folder structure a record of your working sessions, which is more meaningful than a record of when files were created elsewhere.

Each item in `folio.json` stores both a bare `filename` and a `path` relative to `~/Folio/`. The relative path is what the app uses to locate files and reconstruct thumbnails. The folder structure is fully legible in Finder without the app open.

Canvases are stored as a top-level array in `folio.json`. Each canvas is a self-contained thinking surface:

```json
{
  "canvases": [
    {
      "id": 1,
      "name": "figure studies",
      "color": "#a06830",
      "note": "something about the weight of them",
      "itemIds": [1, 2, 4, 8],
      "positions": { "1": { "x": 60, "y": 80 } },
      "notes": [
        { "id": "n1", "x": 340, "y": 185, "text": "not the face — the torso" }
      ],
      "edges": [
        { "id": "e1", "fromId": 1, "toId": 4, "label": "same stance?" }
      ],
      "references": [
        {
          "id": "r1",
          "filename": "vermeer-window.jpg",
          "path": "references/1/vermeer-window.jpg",
          "x": 820,
          "y": 120
        }
      ]
    }
  ]
}
```

Items can appear on multiple canvases simultaneously. Canvas membership is a reflection of what items have been dragged onto that canvas — not a separately managed list.

---

## Hash tracking and reconciliation

Because the archive is a real folder on disk, a user can rename, move, or delete files in Finder without Folio knowing. Rather than preventing this, Folio handles it gracefully through two mechanisms.

**Every item carries a hash** — a short fingerprint computed from the first 64KB of the file's contents on import. This is enough to identify a file even after it has been renamed or moved to a different folder. Only hashing the first 64KB keeps it fast; the file header and early content is unique enough for real image files.

**On every launch, Folio reconciles** the contents of `~/Folio/` against `folio.json`:

1. Walk all files in the archive (excluding `.folio/` and `references/`)
2. Compute each file's hash
3. For any `folio.json` entry whose path no longer exists: check if any on-disk file matches the stored hash — if yes, update the path silently and carry on. This handles renames and Finder moves with no user interaction
4. Items still missing after the hash check are flagged `missing: true` — metadata, tags, and canvas membership are fully preserved
5. Files on disk with no matching `folio.json` entry surface as untracked

Silent auto-recovery (step 3) handles the common case. Only genuinely missing or untracked files surface to the user as a non-blocking notice that doesn't interrupt the app. Folio never moves, renames, or deletes files on its own — the user stays in control of the folder.

---

## Data flow: key user actions

### Drop a file into the app

```
1. Renderer: onDrop fires, extracts file paths
2. Renderer: calls window.folio.copyToFolio(paths)
3. Main: resolves destination (~/Folio/YYYY/MM-monthname/), creates folders if needed
4. Main: copies file, computes hash, builds item object
5. Main: appends item to folio.json (atomic write)
6. Main: queues thumbnail generation in background (non-blocking)
7. Main: sends 'files-added' event to renderer with new item data
8. Renderer: adds item to React state → UI updates immediately
   (file watcher also fires but sees path in `recentlyCopied` set → skips without hashing)
```

### Click an item to open the detail drawer

```
1. Renderer: onClick sets detailItem in React state
2. React renders DetailDrawer with data already in memory
3. No IPC needed — all metadata was loaded at startup
4. Thumbnail loads via file:// protocol directly from `.folio/thumbs/`
```

### Save a tag change

```
1. Renderer: user adds a tag
2. Renderer: updates React state immediately (UI feels instant)
3. Renderer: debounces saveFolioData call by 500ms
4. Main: writes new content to `.folio/folio.json.tmp`
5. Main: renames `.folio/folio.json.tmp` → `.folio/folio.json` (atomic)
```

---

## Key decisions

| Decision                             | Why                                                                                                                                                                                      |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Electron over Tauri                  | One language (JS/TS) throughout; faster iteration on a solo build                                                                                                                        |
| `folio.json` over a database         | Data is small; human-readable, portable, inspectable without tooling                                                                                                                     |
| No backend                           | Single-user, offline-first; main process covers what a backend would do                                                                                                                  |
| Typed preload / contextBridge        | Explicit security boundary; renderer has no direct filesystem access                                                                                                                     |
| Atomic JSON writes                   | Write to `.folio/folio.json.tmp`, rename over `.folio/folio.json` — OS rename is the crash guard, no `.bak` needed                                                                       |
| Debounced saves (500ms)              | UI stays responsive; writes batch naturally                                                                                                                                              |
| Import date governs folder placement | Archive reflects working sessions, not file provenance                                                                                                                                   |
| Hash-based file tracking             | Survives renames and Finder moves without locking the folder                                                                                                                             |
| `recentlyCopied` set                 | When `copyToFolio()` runs, the destination path is added to a short-lived set (2s TTL); the file watcher checks this set first and skips without hashing — fast path for the common case |
| Non-destructive reconciliation       | Folio never moves or deletes files automatically; user stays in control                                                                                                                  |
| Electron Forge                       | Maintained by the Electron team; handles build, packaging, and signing together                                                                                                          |
