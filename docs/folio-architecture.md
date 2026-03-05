# Folio — Architecture Explanation

## The big picture

Electron gives you two JavaScript environments running simultaneously and talking to each other. Understanding that split is the whole architecture.

```
┌─────────────────────────────────────────────────────────┐
│                    Electron App                          │
│                                                         │
│  ┌──────────────────┐        ┌───────────────────────┐  │
│  │   Main Process   │        │  Renderer Process     │  │
│  │   (Node.js)      │◄──IPC──►  (Chromium + React)   │  │
│  │                  │        │                       │  │
│  │  - File system   │        │  - All UI             │  │
│  │  - File watcher  │        │  - Strip view         │  │
│  │  - Thumbnails    │        │  - Grid view          │  │
│  │  - folio.json    │        │  - Arrange canvas     │  │
│  │  - Copy files    │        │  - Sidebar            │  │
│  └──────────────────┘        └───────────────────────┘  │
│           │                            │                 │
│    ~/Folio/ on disk              React state             │
└─────────────────────────────────────────────────────────┘
```

The main process is like a small backend server. The renderer is like a browser tab. They never share memory directly — they pass messages back and forth through IPC (inter-process communication). This separation is what keeps the app secure and stable: a crash or bug in the UI doesn't take down the file system code, and vice versa.

---

## Why Electron for this project

The alternatives were Tauri (Rust backend) and a plain web app. Here's why Electron is the right call for Folio specifically:

**vs. Tauri:** Tauri is faster and produces smaller binaries, but it requires Rust for all filesystem operations. For Folio, that means writing file watching, thumbnail generation, and JSON persistence in Rust — a different language from everything else. Electron lets you write the entire app in one language. For a solo build where speed of iteration matters more than binary size, that's a meaningful advantage.

**vs. plain web app:** A web app can't write to `~/Folio/` or watch a folder on the user's machine. Those are hard filesystem requirements that only a desktop runtime provides. Electron is the simplest path to those capabilities while keeping the UI in React.

---

## The three-layer structure

### Layer 1: Main process (`src/main/`)

This is Node.js. It has full access to the file system, can spawn child processes, and runs in the background for the lifetime of the app. Everything that touches disk happens here:

- Reading and writing `folio.json`
- Watching `~/Folio/output/` for new files
- Copying dropped files into the right folders
- Generating thumbnails
- Opening Finder/Explorer

It never touches the UI.

### Layer 2: Preload script (`src/preload/`)

This is a thin typed bridge. It's the only place where the main process and renderer are allowed to communicate. It uses Electron's `contextBridge` API to expose a clean `window.folio.*` interface to the UI, without giving the UI any direct access to Node.

```typescript
// preload/index.ts — the contract between backend and frontend
contextBridge.exposeInMainWorld('folio', {
  getFolioData: () => ipcRenderer.invoke('get-folio-data'),
  saveFolioData: (data) => ipcRenderer.invoke('save-folio-data', data),
  copyToFolio: (paths) => ipcRenderer.invoke('copy-to-folio', paths),
  onFilesAdded: (cb) => ipcRenderer.on('files-added', cb),
  // ...
})
```

This is why `contextIsolation: true` and `nodeIntegration: false` matter: the renderer can only call what you explicitly expose here. It can't accidentally (or maliciously) call `fs.unlinkSync('/')`. The preload is the security boundary.

### Layer 3: Renderer (`src/renderer/`)

This is a normal React app running inside Chromium. It has no idea it's inside Electron. It just calls `window.folio.getFolioData()` the same way a web app would call `fetch('/api/data')`. All UI logic, state management, and view rendering lives here.

---

## Why `folio.json` instead of a database

The obvious question is: why not SQLite? A few reasons:

**It's human-readable.** If something goes wrong, you can open `folio.json` in a text editor and see exactly what's in it. You can also manually edit it to fix a problem. A SQLite database requires tooling.

**It's portable.** The entire state of the app is one file. You can copy it, back it up, put it in iCloud Drive, or email it. No migration scripts, no schema versions to manage (beyond a `version` field for future upgrades).

**The data is small.** Each item in `folio.json` is maybe 200 bytes of metadata. Even with 5,000 items, that's 1MB — well within what JSON can handle without performance concerns. Folio is not a database app; it's a personal archive.

**It's simpler to implement correctly.** The only tricky part is atomic writes (write to `.tmp`, then rename), which prevents corruption if the app crashes mid-write. That's ~5 lines of Node.js. Setting up SQLite in Electron correctly, with WAL mode and proper connection handling, is significantly more work.

The one downside: JSON doesn't handle concurrent writes. But Folio only has one user and one window, so that's not a real concern.

---

## The IPC pattern in practice

Every operation the UI needs follows the same pattern:

```
User does something in React
  → calls window.folio.someCommand(args)
    → ipcRenderer.invoke('some-command', args)  [preload]
      → ipcMain.handle('some-command', handler) [main]
        → does filesystem work
          → returns result
    → Promise resolves with result
  → React updates state
```

This is deliberately similar to how you'd call a REST API in a web app. The main process is the server; the renderer is the client. It means any developer familiar with web development already understands the pattern.

For events that the main process initiates (like the file watcher detecting a new file), the flow reverses:

```
chokidar detects new file in ~/Folio/output/
  → main process adds item to folio.json
  → mainWindow.webContents.send('files-added', newItem)
    → ipcRenderer.on('files-added', callback) [preload forwards to renderer]
      → React adds item to state, UI updates
```

---

## The file watcher

`chokidar` watches `~/Folio/output/` and fires events when files are added, changed, or removed. This serves two purposes:

1. It's the fallback for users who add files by dragging them directly into the Finder folder rather than dropping them into the app
2. It keeps the app in sync if `folio.json` and the folder ever drift out of sync

The watcher is debounced at 300ms so dropping 20 files at once doesn't trigger 20 separate writes to `folio.json` — it waits for the burst to settle and processes them all in one batch.

---

## Thumbnail generation and the `sharp` problem

This is the one genuinely awkward part of the plan.

### What sharp is and why it's the best option technically

`sharp` wraps `libvips`, a C library that is extremely fast at image processing — significantly faster than pure-JavaScript alternatives for large images. For a 4000×3000px DSLR photo, `sharp` might take 30ms to generate a thumbnail; a pure-JS library might take 800ms.

### The problem with sharp in Electron

Electron has a different application binary interface (ABI) from a given Node.js binary, which means native modules need to be recompiled for Electron. Without recompilation, you get errors like: `The module was compiled against a different Node.js version using NODE_MODULE_VERSION $XYZ`.

In practice this means every developer needs to run `@electron/rebuild` after `npm install`, and the packaging pipeline needs to handle it too. When building, the native packages need to be in a specific location so that both native packages and other dependencies are contained correctly within the packaged app. It works once you set it up, but it adds friction — especially for a solo project where you want to just clone and run.

### Three alternatives, ranked by simplicity

**Option 1: Jimp (recommended for MVP)**

Jimp is a pure JavaScript image manipulation library that implements all functionality in vanilla JavaScript, making it universally deployable across environments without compilation requirements. This pure-JS approach resolves critical pain points in deployment scenarios where native addons cause compatibility issues.

```typescript
import { Jimp } from 'jimp';

const image = await Jimp.read(srcPath);
await image
  .resize({ w: 400 })   // maintain aspect ratio
  .write(thumbPath);     // saves to disk
```

No rebuild step. No `@electron/rebuild`. No build pipeline complexity. Just `npm install` and it works. The tradeoff is speed: Jimp is slower than `sharp` for large images. But for generating thumbnails of a personal image archive — not a production image processing service — it's completely fine. A 400px thumbnail from a 3000px source takes a few hundred milliseconds. That's acceptable when it's happening in a background queue.

**Option 2: Electron's built-in `nativeImage`**

Electron's `nativeImage` module has a `createThumbnailFromPath` method that returns a `Promise<NativeImage>` — a thumbnail preview image constructed directly from a file path.

```typescript
import { nativeImage } from 'electron';

const thumb = await nativeImage.createThumbnailFromPath(srcPath, {
  width: 400,
  height: 400,
});
const jpeg = thumb.toJPEG(80);
await fs.writeFile(thumbPath, jpeg);
```

Zero dependencies — it's built into Electron. Uses Chromium's image decoding, which supports all formats Chromium supports (including HEIC on macOS). The downside is that it's only available in the main process, and the `height` parameter is ignored on Windows (it scales by width only), which is actually fine for thumbnails. This is arguably the most correct approach for Folio: use the platform's own image capabilities rather than adding a dependency at all.

**Option 3: Sharp (if you need it later)**

If the archive grows to thousands of large files and background thumbnail generation becomes noticeably slow, `sharp` is the upgrade path. With Electron Forge, `@electron-forge/plugin-auto-unpack-natives` handles native module extraction automatically during packaging — which removes the main sharp pain point. You'd still need to ensure sharp is rebuilt for Electron's ABI (`@electron/rebuild` as a postinstall step), but Forge's ecosystem makes this manageable.

### Recommendation

**Start with `nativeImage.createThumbnailFromPath`.** It's built in, zero dependencies, handles every format Chromium handles, and is fast enough for a personal archive. If you hit performance limits with very large archives, switch to `sharp` at that point — the thumbnail generation code is isolated enough that swapping it out is a one-file change.

---

## Data flow summary

Here's how each of the three main user actions flows through the architecture:

### Drop a file into the app

```
1. Renderer: onDrop event fires, gets file paths via webUtils.getPathForFile()
2. Renderer: calls window.folio.copyToFolio(paths)
3. Main: copies files to ~/Folio/output/ with YYYY-MM-DD_ prefix
4. Main: generates new item objects, appends to folio.json (atomic write)
5. Main: triggers thumbnail generation in background (nativeImage or Jimp)
6. Main: sends 'files-added' event to renderer with new item data
7. Renderer: adds items to React state → UI updates immediately
8. (chokidar also fires, but sees files already in folio.json → no-op)
```

### Click an item to open detail drawer

```
1. Renderer: onClick handler, sets detailItem in React state
2. React: renders DetailDrawer with item data already in memory
3. No IPC needed — all item metadata was loaded at startup
4. Thumbnail: <img src="file:///Users/x/Folio/.cache/thumbs/abc123.jpg" />
   → browser loads directly from disk via file:// protocol
```

### Save a tag change

```
1. Renderer: user adds a tag in DetailDrawer
2. Renderer: updates local React state immediately (UI feels instant)
3. Renderer: debounces a call to window.folio.saveFolioData(fullData) by 500ms
4. Main: writes folio.json.bak (backup of current)
5. Main: writes folio.json.tmp (new content)
6. Main: renames folio.json.tmp → folio.json (atomic, safe)
```

---

## What Electron Forge gives you

Plain Electron + Vite requires custom configuration to handle the three separate build targets (main, preload, renderer), plus separate tooling for packaging, code signing, and making installers. Electron Forge handles all of that in one place. It's maintained by the Electron team itself — the same people who maintain Electron.

The Vite + TypeScript template gives you:
- Correct Vite config for all three targets (main, preload, renderer) out of the box
- HMR that works properly for the renderer during development
- `forge.config.ts` for packaging — add `@electron-forge/maker-dmg` for macOS, `@electron-forge/maker-squirrel` for Windows later
- `@electron-forge/plugin-auto-unpack-natives` if you add native modules like `sharp`

One thing to know: Forge's Vite plugin is currently marked "experimental", meaning the team is still iterating on it and minor releases may contain breaking changes. In practice this means pinning your Forge version until you're ready to upgrade deliberately, which is good practice anyway. The alternative is Forge's webpack template (fully stable) but Vite's faster HMR is worth the mild caveat for a project in active development.

---

## Summary of key decisions

| Decision | Why |
|---|---|
| Electron over Tauri | One language (JS/TS) throughout; faster iteration for solo build |
| `folio.json` over SQLite | Human-readable, portable, simple to implement correctly for this data size |
| Typed preload / contextBridge | Security boundary between UI and filesystem; also makes the contract explicit |
| `nativeImage` over `sharp` | Zero dependencies, built in, handles HEIC; switch to `sharp` only if needed |
| `chokidar` for file watching | Battle-tested, cross-platform, handles macOS FSEvents and Linux inotify correctly |
| Electron Forge for scaffolding | Officially maintained by the Electron team; handles packaging, signing, and distribution alongside build |
| Atomic JSON writes | Prevents corruption on crash; five lines of code, no downside |
| Debounced saves (500ms) | UI stays responsive; writes batched rather than firing on every keystroke |
