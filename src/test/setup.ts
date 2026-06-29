import type { FolioApi } from "../types/preload";

class ImmediateIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds = [];

  constructor(private readonly callback: IntersectionObserverCallback) {}

  disconnect() {
    return undefined;
  }

  observe(target: Element) {
    this.callback(
      [
        {
          boundingClientRect: target.getBoundingClientRect(),
          intersectionRatio: 1,
          intersectionRect: target.getBoundingClientRect(),
          isIntersecting: true,
          rootBounds: null,
          target,
          time: 0,
        },
      ],
      this,
    );
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  unobserve() {
    return undefined;
  }
}

Object.defineProperty(globalThis, "IntersectionObserver", {
  configurable: true,
  value: ImmediateIntersectionObserver,
});

Object.defineProperty(globalThis.crypto, "randomUUID", {
  configurable: true,
  value: vi.fn(() => `test-${Math.random().toString(16).slice(2)}`),
});

const canvasContextMock = {
  setTransform: vi.fn(),
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  fillStyle: "",
} as unknown as CanvasRenderingContext2D;

Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  configurable: true,
  value: vi.fn(() => canvasContextMock),
});

window.confirm = vi.fn(() => true);

const folioMock: FolioApi = {
  getFolioData: vi.fn(),
  saveFolioData: vi.fn(),
  createProject: vi.fn(),
  deleteProject: vi.fn(),
  copyToFolio: vi.fn(),
  importToFolio: vi.fn(),
  copyToProject: vi.fn(),
  importToProject: vi.fn(),
  importSourcesToProject: vi.fn(),
  setProjectWorkItems: vi.fn(),
  deleteItems: vi.fn(),
  createNote: vi.fn(),
  readNoteContent: vi.fn(async () => ""),
  writeNoteContent: vi.fn(),
  deleteNote: vi.fn(),
  openFileDialog: vi.fn(),
  ensureThumbnails: vi.fn(),
  getFileDataUrl: vi.fn(),
  getReconciliationResult: vi.fn(),
  openInFinder: vi.fn(),
  fetchLinkMetadata: vi.fn(async (url: string) => ({ url })),
  getBackupStatus: vi.fn(async () => ({
    available: true,
    target: "icloud" as const,
    backupPath:
      "/Users/test/Library/Mobile Documents/com~apple~CloudDocs/Folio Backup",
    lastBackupAt: null,
  })),
  backupToICloud: vi.fn(async () => ({
    backupPath:
      "/Users/test/Library/Mobile Documents/com~apple~CloudDocs/Folio Backup",
    createdAt: new Date().toISOString(),
  })),
  restoreFromICloud: vi.fn(async () => ({
    restoredPath: "/Users/test/Documents/Folio Restored 2026-06-20 14-30-00",
    restoredAt: new Date().toISOString(),
  })),
  getStorageSettings: vi.fn(async () => ({
    location: "documents" as const,
    iCloudAvailable: true,
    documentsPath: "/Users/test/Documents/Folio",
    iCloudPath:
      "/Users/test/Library/Mobile Documents/com~apple~CloudDocs/Folio",
  })),
  setStorageLocation: vi.fn(async () => undefined),
  getPathForFile: vi.fn(),
  onFilesAdded: vi.fn(),
};

window.folio = folioMock;

afterEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  document.body.innerHTML = "";
});
