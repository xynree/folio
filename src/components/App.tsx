/* eslint-disable import/namespace */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  Canvas,
  CanvasNote,
  CanvasPosition,
  CanvasReference,
  FolioData,
  FolioItem,
  ItemType,
  ReconciliationResult,
  Tag,
  ThumbnailUrls,
} from "../types";

type ArchiveViewMode = "strip" | "grid";
type GridTagFilter = "all" | string;
type DataUpdater = (current: FolioData) => FolioData;
type ItemOpenHandler = (
  itemId: string,
  event: React.MouseEvent,
  orderedItems: FolioItem[],
  rangeEnabled: boolean,
) => void;
type ItemDetailsOpenHandler = (itemId: string) => void;

const EMPTY_DATA: FolioData = {
  version: 1,
  items: [],
  canvases: [],
  tags: [],
};

const TYPE_LABELS: Record<ItemType, string> = {
  sketch: "Sketch",
  ref: "Ref",
  music: "Music",
  anim: "Anim",
  text: "Text",
  other: "File",
};

const CANVAS_COLORS = ["#9f6b3d", "#385d56", "#7c5d92", "#b06d4a", "#546f9a"];
const ITEM_DRAG_MIME = "application/x-folio-item-ids";
const IMAGE_FILE_PATTERN = /\.(avif|gif|heic|jpeg|jpg|png|svg|webp)$/i;
const ARCHIVE_PANEL_MIN_WIDTH = 390;
const CANVAS_DOCK_MIN_WIDTH = 420;
const CANVAS_DOCK_DEFAULT_WIDTH = 560;
const CANVAS_SPLITTER_WIDTH = 8;

function createId(prefix: string) {
  if ("randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function mergeItems(current: FolioItem[], incoming: FolioItem[]): FolioItem[] {
  const byId = new Map(current.map((item) => [item.id, item]));
  incoming.forEach((item) => byId.set(item.id, item));
  return Array.from(byId.values());
}

function dateKeyFromDate(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function dateKeyFromItem(item: FolioItem): string {
  const date = new Date(item.date);
  if (Number.isNaN(date.getTime())) {
    return dateKeyFromDate(new Date());
  }
  return dateKeyFromDate(date);
}

function dateFromKey(key: string): Date {
  return new Date(`${key}T12:00:00`);
}

function formatDateLabel(key: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(dateFromKey(key));
}

function buildDateRange(items: FolioItem[]): string[] {
  const today = dateKeyFromDate(new Date());
  const itemKeys = items.map(dateKeyFromItem);
  const earliestKey = itemKeys.length
    ? itemKeys.reduce((earliest, key) => (key < earliest ? key : earliest))
    : today;
  const latestKey = itemKeys.length
    ? itemKeys.reduce((latest, key) => (key > latest ? key : latest), today)
    : today;

  const dates: string[] = [];
  const cursor = dateFromKey(latestKey > today ? latestKey : today);
  const earliest = dateFromKey(earliestKey);

  while (cursor >= earliest) {
    dates.push(dateKeyFromDate(cursor));
    cursor.setDate(cursor.getDate() - 1);
  }

  return dates;
}

function groupItemsByDate(items: FolioItem[]): Map<string, FolioItem[]> {
  const groups = new Map<string, FolioItem[]>();
  items.forEach((item) => {
    const key = dateKeyFromItem(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  });

  groups.forEach((group) =>
    group.sort(
      (a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title),
    ),
  );

  return groups;
}

function getGaps(items: FolioItem[]): number {
  if (!items.length) return 0;
  const groups = groupItemsByDate(items);
  return buildDateRange(items).filter((date) => !groups.has(date)).length;
}

function basename(filePath: string): string {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}

function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function createCanvas(index: number, title?: string, description?: string): Canvas {
  return {
    id: createId("canvas"),
    title: title?.trim() || `Board ${index + 1}`,
    description: description?.trim() ?? "",
    color: CANVAS_COLORS[index % CANVAS_COLORS.length],
    itemIds: [],
    positions: {},
    notes: [],
    edges: [],
    references: [],
  };
}

function addItemToCanvas(canvas: Canvas, itemId: string): Canvas {
  return addItemsToCanvas(canvas, [itemId]);
}

function addItemsToCanvas(
  canvas: Canvas,
  itemIds: string[],
  origin?: CanvasPosition,
): Canvas {
  const nextItemIds = [...canvas.itemIds];
  const positions = { ...canvas.positions };
  let placedCount = 0;

  Array.from(new Set(itemIds)).forEach((itemId) => {
    if (nextItemIds.includes(itemId)) return;

    const gridIndex = nextItemIds.length;
    positions[itemId] = origin
      ? {
          x: Math.max(0, origin.x + (placedCount % 4) * 184),
          y: Math.max(0, origin.y + Math.floor(placedCount / 4) * 228),
        }
      : {
          x: 80 + (gridIndex % 4) * 190,
          y: 90 + Math.floor(gridIndex / 4) * 230,
        };

    nextItemIds.push(itemId);
    placedCount += 1;
  });

  return {
    ...canvas,
    itemIds: nextItemIds,
    positions,
  };
}

function tagTextsForItem(item: FolioItem, tags: Tag[]) {
  const byId = new Map(tags.map((tag) => [tag.id, tag.text]));
  return item.tagIds.map((tagId) => byId.get(tagId)).filter(Boolean) as string[];
}

function canvasColorsForItem(itemId: string, canvases: Canvas[]): string[] {
  return canvases
    .filter((canvas) => canvas.itemIds.includes(itemId))
    .map((canvas, index) => canvas.color ?? CANVAS_COLORS[index % CANVAS_COLORS.length]);
}

function itemCanUseDirectPreview(item: FolioItem): boolean {
  return !item.missing && ["sketch", "ref", "anim"].includes(item.type)
    && IMAGE_FILE_PATTERN.test(item.path);
}

function AppShell() {
  const [data, setData] = useState<FolioData>(EMPTY_DATA);
  const dataRef = useRef<FolioData>(EMPTY_DATA);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [archiveView, setArchiveView] = useState<ArchiveViewMode>("strip");
  const [canvasMinimized, setCanvasMinimized] = useState(false);
  const [canvasDockWidth, setCanvasDockWidth] = useState(CANVAS_DOCK_DEFAULT_WIDTH);
  const [gridTagFilter, setGridTagFilter] = useState<GridTagFilter>("all");
  const [thumbUrls, setThumbUrls] = useState<ThumbnailUrls>({});
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [lastSelectedItemId, setLastSelectedItemId] = useState<string | null>(null);
  const [activeCanvasId, setActiveCanvasId] = useState<string | null>(null);
  const [reconciliation, setReconciliation] =
    useState<ReconciliationResult | null>(null);
  const [reconciliationDismissed, setReconciliationDismissed] = useState(false);
  const studioWorkspaceRef = useRef<HTMLElement | null>(null);
  const dragDepth = useRef(0);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const putData = useCallback((nextData: FolioData) => {
    dataRef.current = nextData;
    setData(nextData);
  }, []);

  const saveData = useCallback(
    (nextData: FolioData, successMessage?: string) => {
      putData(nextData);
      void window.folio
        .saveFolioData(nextData)
        .then(() => {
          if (successMessage) setToast(successMessage);
        })
        .catch((error) => {
          console.error(error);
          setToast("Save failed");
        });
    },
    [putData],
  );

  const commitData = useCallback(
    (updater: DataUpdater, successMessage?: string) => {
      saveData(updater(dataRef.current), successMessage);
    },
    [saveData],
  );

  const importFilePaths = useCallback(
    async (filePaths: string[]) => {
      const uniquePaths = Array.from(new Set(filePaths.filter(Boolean)));
      if (!uniquePaths.length) return;

      setBusy(true);
      try {
        const imported = await window.folio.copyToFolio(uniquePaths);
        if (imported.length) {
          putData({
            ...dataRef.current,
            items: mergeItems(dataRef.current.items, imported),
          });
          setToast(`${formatCount(imported.length, "item")} added to today`);
        } else {
          setToast("No new items added");
        }
      } catch (error) {
        console.error(error);
        setToast("Import failed");
      } finally {
        setBusy(false);
      }
    },
    [putData],
  );

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = window.folio.onFilesAdded((items) => {
      putData({
        ...dataRef.current,
        items: mergeItems(dataRef.current.items, items),
      });
    });

    async function load() {
      try {
        const [folioData, reconciliationResult] = await Promise.all([
          window.folio.getFolioData(),
          window.folio.getReconciliationResult(),
        ]);

        if (cancelled) return;
        putData(folioData);
        setActiveCanvasId(folioData.canvases[0]?.id ?? null);
        setReconciliation(reconciliationResult);
      } catch (error) {
        console.error(error);
        if (!cancelled) setToast("Folio data could not be loaded");
      }
    }

    void load();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [putData]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const clampCanvasDockWidth = useCallback((width: number) => {
    const workspaceWidth =
      studioWorkspaceRef.current?.getBoundingClientRect().width ?? window.innerWidth;
    const maxWidth = Math.max(
      CANVAS_DOCK_MIN_WIDTH,
      workspaceWidth - ARCHIVE_PANEL_MIN_WIDTH - CANVAS_SPLITTER_WIDTH,
    );
    return Math.round(
      Math.min(Math.max(width, CANVAS_DOCK_MIN_WIDTH), maxWidth),
    );
  }, []);

  useEffect(() => {
    const onResize = () => {
      setCanvasDockWidth((current) => clampCanvasDockWidth(current));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clampCanvasDockWidth]);

  const startCanvasDockResize = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (canvasMinimized) return;
      const workspace = studioWorkspaceRef.current;
      if (!workspace) return;

      event.preventDefault();
      event.stopPropagation();

      const previousCursor = document.body.style.cursor;
      const previousUserSelect = document.body.style.userSelect;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const resizeToPointer = (clientX: number) => {
        const rect = workspace.getBoundingClientRect();
        setCanvasDockWidth(clampCanvasDockWidth(rect.right - clientX));
      };

      const onPointerMove = (moveEvent: PointerEvent) => {
        resizeToPointer(moveEvent.clientX);
      };

      const onPointerUp = () => {
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };

      resizeToPointer(event.clientX);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [canvasMinimized, clampCanvasDockWidth],
  );

  const nudgeCanvasDockWidth = useCallback(
    (delta: number) => {
      setCanvasDockWidth((current) => clampCanvasDockWidth(current + delta));
    },
    [clampCanvasDockWidth],
  );

  const sortedItems = useMemo(
    () =>
      [...data.items].sort(
        (a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title),
      ),
    [data.items],
  );

  const visibleArchiveItems = useMemo(
    () =>
      gridTagFilter === "all"
        ? sortedItems
        : sortedItems.filter((item) => item.tagIds.includes(gridTagFilter)),
    [gridTagFilter, sortedItems],
  );

  const selectedItemSet = useMemo(
    () => new Set(selectedItemIds),
    [selectedItemIds],
  );

  const selectedItem =
    data.items.find((item) => item.id === selectedItemId) ?? null;

  const clearSelection = useCallback(() => {
    setSelectedItemIds([]);
    setLastSelectedItemId(null);
  }, []);

  useEffect(() => {
    if (gridTagFilter === "all") return;
    if (!data.tags.some((tag) => tag.id === gridTagFilter)) {
      setGridTagFilter("all");
    }
  }, [data.tags, gridTagFilter]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSelectedItemId(null);
      clearSelection();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearSelection]);

  const handleItemOpen = useCallback<ItemOpenHandler>(
    (itemId, event, orderedItems, rangeEnabled) => {
      event.stopPropagation();

      if (event.metaKey || event.ctrlKey) {
        setSelectedItemId(null);
        setLastSelectedItemId(itemId);
        setSelectedItemIds((current) =>
          current.includes(itemId)
            ? current.filter((selectedId) => selectedId !== itemId)
            : [...current, itemId],
        );
        return;
      }

      if (event.shiftKey && rangeEnabled) {
        const fallbackStartId =
          lastSelectedItemId ?? selectedItemIds[selectedItemIds.length - 1];
        const startIndex = orderedItems.findIndex(
          (item) => item.id === fallbackStartId,
        );
        const endIndex = orderedItems.findIndex((item) => item.id === itemId);

        if (startIndex >= 0 && endIndex >= 0) {
          const [from, to] =
            startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
          setSelectedItemId(null);
          setSelectedItemIds(orderedItems.slice(from, to + 1).map((item) => item.id));
          setLastSelectedItemId(itemId);
          return;
        }
      }

      setSelectedItemIds([itemId]);
      setSelectedItemId(itemId);
      setLastSelectedItemId(itemId);
    },
    [lastSelectedItemId, selectedItemIds],
  );

  const openItemDetails = useCallback<ItemDetailsOpenHandler>((itemId) => {
    setSelectedItemIds([itemId]);
    setSelectedItemId(itemId);
    setLastSelectedItemId(itemId);
  }, []);

  const startArchiveItemDrag = useCallback(
    (itemId: string, event: React.DragEvent<HTMLElement>) => {
      const itemIds = selectedItemSet.has(itemId) ? selectedItemIds : [itemId];
      event.dataTransfer.setData(ITEM_DRAG_MIME, JSON.stringify(itemIds));
      event.dataTransfer.effectAllowed = "copy";
    },
    [selectedItemIds, selectedItemSet],
  );

  const handleOpenDialog = useCallback(async () => {
    const filePaths = await window.folio.openFileDialog();
    await importFilePaths(filePaths);
  }, [importFilePaths]);

  const handleDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      dragDepth.current = 0;
      setDragging(false);

      const filePaths = Array.from(event.dataTransfer.files)
        .map((file) => window.folio.getPathForFile(file))
        .filter(Boolean);

      await importFilePaths(filePaths);
    },
    [importFilePaths],
  );

  const handleDragEnter = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!Array.from(event.dataTransfer.types).includes("Files")) return;
    dragDepth.current += 1;
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  const addUntrackedFiles = useCallback(async () => {
    if (!reconciliation?.untrackedFiles.length) return;
    await importFilePaths(
      reconciliation.untrackedFiles.map((file) => file.absolutePath),
    );
    setReconciliation((current) =>
      current
        ? {
            ...current,
            untrackedFiles: [],
          }
        : current,
    );
  }, [importFilePaths, reconciliation]);

  const patchItem = useCallback(
    (itemId: string, patch: Partial<FolioItem>, successMessage?: string) => {
      commitData(
        (current) => ({
          ...current,
          items: current.items.map((item) =>
            item.id === itemId ? { ...item, ...patch } : item,
          ),
        }),
        successMessage,
      );
    },
    [commitData],
  );

  const addTagToItem = useCallback(
    (itemId: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      commitData((current) => {
        const existingTag = current.tags.find(
          (tag) => tag.text.toLowerCase() === trimmed.toLowerCase(),
        );
        const tag = existingTag ?? { id: createId("tag"), text: trimmed };

        return {
          ...current,
          tags: existingTag ? current.tags : [...current.tags, tag],
          items: current.items.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  tagIds: item.tagIds.includes(tag.id)
                    ? item.tagIds
                    : [...item.tagIds, tag.id],
                }
              : item,
          ),
        };
      }, "Tag added");
    },
    [commitData],
  );

  const removeTagFromItem = useCallback(
    (itemId: string, tagText: string) => {
      commitData(
        (current) => {
          const tag = current.tags.find((candidate) => candidate.text === tagText);
          if (!tag) return current;

          const items = current.items.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  tagIds: item.tagIds.filter((tagId) => tagId !== tag.id),
                }
              : item,
          );
          const usedTagIds = new Set(items.flatMap((item) => item.tagIds));

          return {
            ...current,
            items,
            tags: current.tags.filter((candidate) => usedTagIds.has(candidate.id)),
          };
        },
        "Tag removed",
      );
    },
    [commitData],
  );

  const addItemToActiveCanvas = useCallback(
    (itemId: string) => {
      let targetCanvasId = activeCanvasId;
      let createdCanvas: Canvas | null = null;

      commitData((current) => {
        let canvases = [...current.canvases];
        if (!targetCanvasId || !canvases.some((canvas) => canvas.id === targetCanvasId)) {
          createdCanvas = createCanvas(canvases.length);
          targetCanvasId = createdCanvas.id;
          canvases = [createdCanvas, ...canvases];
        }

        return {
          ...current,
          canvases: canvases.map((canvas) =>
            canvas.id === targetCanvasId ? addItemToCanvas(canvas, itemId) : canvas,
          ),
        };
      }, createdCanvas ? "Board created" : "Added to board");

      if (targetCanvasId) {
        setActiveCanvasId(targetCanvasId);
        setCanvasMinimized(false);
      }
    },
    [activeCanvasId, commitData],
  );

  const addSelectedToActiveCanvas = useCallback(() => {
    if (!selectedItemIds.length) return;
    let targetCanvasId = activeCanvasId;
    let createdCanvas: Canvas | null = null;

    commitData((current) => {
      let canvases = [...current.canvases];
      if (!targetCanvasId || !canvases.some((canvas) => canvas.id === targetCanvasId)) {
        createdCanvas = createCanvas(canvases.length);
        targetCanvasId = createdCanvas.id;
        canvases = [createdCanvas, ...canvases];
      }

      return {
        ...current,
        canvases: canvases.map((canvas) =>
          canvas.id === targetCanvasId
            ? addItemsToCanvas(canvas, selectedItemIds)
            : canvas,
        ),
      };
    }, createdCanvas ? "Board created" : "Selection added to board");

    if (targetCanvasId) {
      setActiveCanvasId(targetCanvasId);
      setCanvasMinimized(false);
    }
    clearSelection();
  }, [activeCanvasId, clearSelection, commitData, selectedItemIds]);

  const openSelectedOnNewCanvas = useCallback(() => {
    if (!selectedItemIds.length) return;

    const defaultTitle = `Board ${dataRef.current.canvases.length + 1}`;
    const title = window.prompt("Board name", defaultTitle);
    if (title === null) return;
    const description = window.prompt("Opening note (optional)", "") ?? "";
    const board = addItemsToCanvas(
      createCanvas(dataRef.current.canvases.length, title, description),
      selectedItemIds,
    );

    commitData(
      (current) => ({
        ...current,
        canvases: [board, ...current.canvases],
      }),
      "Board created",
    );

    setActiveCanvasId(board.id);
    setCanvasMinimized(false);
    clearSelection();
  }, [clearSelection, commitData, selectedItemIds]);

  const deleteItem = useCallback(
    async (itemId: string) => {
      const item = dataRef.current.items.find((candidate) => candidate.id === itemId);
      if (!item) return;

      const confirmed = window.confirm(`Delete "${item.title || basename(item.path)}"?`);
      if (!confirmed) return;

      setBusy(true);
      try {
        const nextData = await window.folio.deleteItems([itemId]);
        putData(nextData);
        setSelectedItemId(null);
        setSelectedItemIds((current) =>
          current.filter((selectedId) => selectedId !== itemId),
        );
        setThumbUrls((current) => {
          const next = { ...current };
          delete next[itemId];
          return next;
        });
        setToast("Item moved to Trash");
      } catch (error) {
        console.error(error);
        setToast("Delete failed");
      } finally {
        setBusy(false);
      }
    },
    [putData],
  );

  const studioGridTemplateColumns = canvasMinimized
    ? `minmax(${ARCHIVE_PANEL_MIN_WIDTH}px, 1fr) 58px`
    : `minmax(${ARCHIVE_PANEL_MIN_WIDTH}px, 1fr) ${CANVAS_SPLITTER_WIDTH}px ${canvasDockWidth}px`;

  return (
    <div
      className="app-shell"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <ReconciliationNotice
        reconciliation={reconciliation}
        dismissed={reconciliationDismissed}
        onAddUntracked={addUntrackedFiles}
        onDismiss={() => setReconciliationDismissed(true)}
      />

      <SelectionBar
        count={selectedItemIds.length}
        onAddToBoard={addSelectedToActiveCanvas}
        onClear={clearSelection}
        onOpenNewBoard={openSelectedOnNewCanvas}
      />

      <main className="app-main">
        <section
          ref={studioWorkspaceRef}
          className={`studio-workspace ${
            canvasMinimized ? "studio-workspace-canvas-minimized" : ""
          }`}
          style={{ gridTemplateColumns: studioGridTemplateColumns }}
        >
          <section className="archive-panel">
            <header className="archive-panel-header">
              <div>
                <strong>Archive</strong>
                <span>{formatCount(visibleArchiveItems.length, "visible item")}</span>
              </div>
              <div className="archive-panel-actions">
                <div className="view-tabs archive-view-toggle" aria-label="Archive view">
                  <button
                    className={archiveView === "strip" ? "active" : ""}
                    type="button"
                    onClick={() => setArchiveView("strip")}
                  >
                    Strip
                  </button>
                  <button
                    className={archiveView === "grid" ? "active" : ""}
                    type="button"
                    onClick={() => setArchiveView("grid")}
                  >
                    Grid
                  </button>
                </div>
                <button className="primary-action" type="button" onClick={handleOpenDialog}>
                  {busy ? "Importing" : "Import"}
                </button>
              </div>
            </header>

            <ArchiveWorkspace
              sidebar={
                <TagsSidebar
                  items={sortedItems}
                  tags={data.tags}
                  canvases={data.canvases}
                  thumbUrls={thumbUrls}
                  setThumbUrls={setThumbUrls}
                  onOpenItem={openItemDetails}
                  tagFilter={gridTagFilter}
                  setTagFilter={setGridTagFilter}
                />
              }
            >
              {archiveView === "strip" ? (
                <DailyStripView
                  items={visibleArchiveItems}
                  tags={data.tags}
                  canvases={data.canvases}
                  thumbUrls={thumbUrls}
                  setThumbUrls={setThumbUrls}
                  selectedItemIds={selectedItemIds}
                  onBackgroundClick={clearSelection}
                  onDragStart={startArchiveItemDrag}
                  onItemOpen={handleItemOpen}
                />
              ) : (
                <GridView
                  items={sortedItems}
                  tags={data.tags}
                  canvases={data.canvases}
                  thumbUrls={thumbUrls}
                  setThumbUrls={setThumbUrls}
                  tagFilter={gridTagFilter}
                  setTagFilter={setGridTagFilter}
                  selectedItemIds={selectedItemIds}
                  onBackgroundClick={clearSelection}
                  onDragStart={startArchiveItemDrag}
                  onItemOpen={handleItemOpen}
                />
              )}
            </ArchiveWorkspace>
          </section>

          {canvasMinimized ? null : (
            <div
              className="canvas-resize-handle"
              role="separator"
              aria-label="Resize open board panel"
              aria-orientation="vertical"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft") {
                  event.preventDefault();
                  nudgeCanvasDockWidth(32);
                }
                if (event.key === "ArrowRight") {
                  event.preventDefault();
                  nudgeCanvasDockWidth(-32);
                }
              }}
              onPointerDown={startCanvasDockResize}
            />
          )}

          <aside
            className={`canvas-dock ${canvasMinimized ? "canvas-dock-minimized" : ""}`}
          >
            <header className="canvas-dock-header">
              <div>
                <strong>{canvasMinimized ? "Board" : "Open board"}</strong>
                <span>
                  {data.canvases.find((canvas) => canvas.id === activeCanvasId)
                    ?.title ?? data.canvases[0]?.title ?? "No board"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setCanvasMinimized((current) => !current)}
              >
                {canvasMinimized ? "Open" : "Minimize"}
              </button>
            </header>

            {canvasMinimized ? null : (
              <CanvasView
                data={data}
                activeCanvasId={activeCanvasId}
                setActiveCanvasId={setActiveCanvasId}
                onOpenItem={openItemDetails}
                thumbUrls={thumbUrls}
                setThumbUrls={setThumbUrls}
                selectedItemIds={selectedItemIds}
                commitData={commitData}
                saveData={saveData}
                clearDragState={() => {
                  dragDepth.current = 0;
                  setDragging(false);
                }}
              />
            )}
          </aside>
        </section>
      </main>

      <StatusBar
        itemCount={data.items.length}
        canvasCount={data.canvases.length}
        tagCount={data.tags.length}
        gapCount={getGaps(data.items)}
      />

      <DetailDrawer
        item={selectedItem}
        tags={data.tags}
        canvases={data.canvases}
        thumbUrls={thumbUrls}
        setThumbUrls={setThumbUrls}
        onClose={() => setSelectedItemId(null)}
        onPatch={patchItem}
        onAddTag={addTagToItem}
        onRemoveTag={removeTagFromItem}
        onAddToCanvas={addItemToActiveCanvas}
        onDelete={deleteItem}
      />

      {dragging ? <div className="drop-state">Drop to add to Folio</div> : null}
      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}

function ReconciliationNotice({
  reconciliation,
  dismissed,
  onAddUntracked,
  onDismiss,
}: {
  reconciliation: ReconciliationResult | null;
  dismissed: boolean;
  onAddUntracked: () => void;
  onDismiss: () => void;
}) {
  if (!reconciliation || dismissed) return null;

  const { untrackedFiles, missingItems, relocatedItems } = reconciliation;
  if (!untrackedFiles.length && !missingItems.length && !relocatedItems.length) {
    return null;
  }

  return (
    <section className="reconciliation" aria-live="polite">
      <div>
        {untrackedFiles.length ? (
          <p>
            {formatCount(untrackedFiles.length, "new file")} found in your Folio
            folder - add to archive?
          </p>
        ) : null}
        {missingItems.length ? (
          <p>
            {formatCount(missingItems.length, "file")} missing and could not be
            located
          </p>
        ) : null}
        {relocatedItems.length ? (
          <p>{formatCount(relocatedItems.length, "moved file")} reconnected</p>
        ) : null}
      </div>
      <div className="notice-actions">
        {untrackedFiles.length ? (
          <button type="button" onClick={onAddUntracked}>
            Add
          </button>
        ) : null}
        <button type="button" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </section>
  );
}

function SelectionBar({
  count,
  onAddToBoard,
  onClear,
  onOpenNewBoard,
}: {
  count: number;
  onAddToBoard: () => void;
  onClear: () => void;
  onOpenNewBoard: () => void;
}) {
  if (!count) return null;

  return (
    <section className="selection-bar" aria-live="polite">
      <strong>{formatCount(count, "item")} selected</strong>
      <span>Drag onto a board or open on new board -&gt;</span>
      <div className="selection-actions">
        <button type="button" onClick={onAddToBoard}>
          Add to active board
        </button>
        <button type="button" onClick={onOpenNewBoard}>
          Open on new board
        </button>
        <button type="button" onClick={onClear}>
          Clear
        </button>
      </div>
    </section>
  );
}

function ArchiveWorkspace({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="archive-workspace">
      {sidebar}
      <div className="archive-route">{children}</div>
    </section>
  );
}

function TagsSidebar({
  items,
  tags,
  canvases,
  thumbUrls,
  setThumbUrls,
  onOpenItem,
  tagFilter,
  setTagFilter,
}: {
  items: FolioItem[];
  tags: Tag[];
  canvases: Canvas[];
  thumbUrls: ThumbnailUrls;
  setThumbUrls: React.Dispatch<React.SetStateAction<ThumbnailUrls>>;
  onOpenItem: ItemDetailsOpenHandler;
  tagFilter: GridTagFilter;
  setTagFilter: React.Dispatch<React.SetStateAction<GridTagFilter>>;
}) {
  const [expandedTagIds, setExpandedTagIds] = useState<string[]>([]);

  const itemCounts = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((item) => {
      item.tagIds.forEach((tagId) => {
        counts.set(tagId, (counts.get(tagId) ?? 0) + 1);
      });
    });
    return counts;
  }, [items]);

  const toggleExpanded = (tagId: string) => {
    setExpandedTagIds((current) =>
      current.includes(tagId)
        ? current.filter((expandedId) => expandedId !== tagId)
        : [...current, tagId],
    );
  };

  return (
    <aside className="tags-sidebar" aria-label="Tags">
      <div className="sidebar-heading">
        <strong>Tags</strong>
        <span>{formatCount(tags.length, "tag")}</span>
      </div>

      <button
        className={`tag-sidebar-row ${tagFilter === "all" ? "active" : ""}`}
        type="button"
        onClick={() => setTagFilter("all")}
      >
        <span>All</span>
        <small>{items.length}</small>
      </button>

      {tags.length ? (
        tags.map((tag) => {
          const tagItems = items.filter((item) => item.tagIds.includes(tag.id));
          const expanded = expandedTagIds.includes(tag.id);
          return (
            <article className="tag-sidebar-item" key={tag.id}>
              <div className="tag-sidebar-controls">
                <button
                  className={`tag-sidebar-row ${
                    tag.id === tagFilter ? "active" : ""
                  }`}
                  type="button"
                  onClick={() => setTagFilter(tag.id)}
                >
                  <span>{tag.text}</span>
                  <small>{itemCounts.get(tag.id) ?? 0}</small>
                </button>
                <button
                  className="tag-expand-button"
                  type="button"
                  onClick={() => toggleExpanded(tag.id)}
                  aria-label={`${expanded ? "Collapse" : "Expand"} ${tag.text}`}
                >
                  {expanded ? "Hide" : "Show"}
                </button>
              </div>

              {expanded ? (
                <div className="tag-thumbnail-strip">
                  {tagItems.length ? (
                    tagItems.slice(0, 8).map((item) => (
                      <button
                        className="mini-thumb mini-thumb-button"
                        key={item.id}
                        title={item.title}
                        type="button"
                        onClick={() => onOpenItem(item.id)}
                      >
                        <LazyThumbnail
                          item={item}
                          thumbUrls={thumbUrls}
                          setThumbUrls={setThumbUrls}
                        />
                        <CanvasDots colors={canvasColorsForItem(item.id, canvases)} />
                      </button>
                    ))
                  ) : (
                    <span className="muted">No items</span>
                  )}
                </div>
              ) : null}
            </article>
          );
        })
      ) : (
        <p className="sidebar-empty">No user tags yet</p>
      )}
    </aside>
  );
}

function DailyStripView({
  items,
  tags,
  canvases,
  thumbUrls,
  setThumbUrls,
  selectedItemIds,
  onBackgroundClick,
  onDragStart,
  onItemOpen,
}: {
  items: FolioItem[];
  tags: Tag[];
  canvases: Canvas[];
  thumbUrls: ThumbnailUrls;
  setThumbUrls: React.Dispatch<React.SetStateAction<ThumbnailUrls>>;
  selectedItemIds: string[];
  onBackgroundClick: () => void;
  onDragStart: (itemId: string, event: React.DragEvent<HTMLElement>) => void;
  onItemOpen: ItemOpenHandler;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const groups = useMemo(() => groupItemsByDate(items), [items]);
  const dates = useMemo(() => buildDateRange(items), [items]);
  const selectedSet = useMemo(() => new Set(selectedItemIds), [selectedItemIds]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollTop = Number(sessionStorage.getItem("folio:strip-scroll") ?? 0);
  }, []);

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    sessionStorage.setItem(
      "folio:strip-scroll",
      String(event.currentTarget.scrollTop),
    );
  }, []);

  return (
    <section
      className="view-scroller strip-view"
      ref={scrollerRef}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onBackgroundClick();
      }}
      onScroll={handleScroll}
    >
      {items.length ? null : <EmptyState label="No archive items yet" />}
      {dates.map((date) => {
        const dayItems = groups.get(date) ?? [];
        return (
          <article
            className={`day-row ${dayItems.length ? "" : "day-row-empty"}`}
            key={date}
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) onBackgroundClick();
            }}
          >
            <div className="day-meta">
              <strong>{formatDateLabel(date)}</strong>
              <span>{dayItems.length ? formatCount(dayItems.length, "item") : ""}</span>
            </div>

            {dayItems.length ? (
              <div
                className="strip-items"
                onMouseDown={(event) => {
                  if (event.currentTarget === event.target) onBackgroundClick();
                }}
              >
                {dayItems.map((item) => (
                  <ItemCard
                    compact
                    item={item}
                    tags={tags}
                    canvasColors={canvasColorsForItem(item.id, canvases)}
                    key={item.id}
                    thumbUrls={thumbUrls}
                    setThumbUrls={setThumbUrls}
                    isSelected={selectedSet.has(item.id)}
                    selectedItemIds={selectedItemIds}
                    onDragStart={onDragStart}
                    onOpen={(itemId, event) =>
                      onItemOpen(itemId, event, items, true)
                    }
                  />
                ))}
              </div>
            ) : (
              <div className="gap-line" aria-label="No items for this date" />
            )}
          </article>
        );
      })}
    </section>
  );
}

function GridView({
  items,
  tags,
  canvases,
  thumbUrls,
  setThumbUrls,
  tagFilter,
  setTagFilter,
  selectedItemIds,
  onBackgroundClick,
  onDragStart,
  onItemOpen,
}: {
  items: FolioItem[];
  tags: Tag[];
  canvases: Canvas[];
  thumbUrls: ThumbnailUrls;
  setThumbUrls: React.Dispatch<React.SetStateAction<ThumbnailUrls>>;
  tagFilter: GridTagFilter;
  setTagFilter: React.Dispatch<React.SetStateAction<GridTagFilter>>;
  selectedItemIds: string[];
  onBackgroundClick: () => void;
  onDragStart: (itemId: string, event: React.DragEvent<HTMLElement>) => void;
  onItemOpen: ItemOpenHandler;
}) {
  const filteredItems = useMemo(
    () =>
      tagFilter === "all"
        ? items
        : items.filter((item) => item.tagIds.includes(tagFilter)),
    [items, tagFilter],
  );
  const selectedSet = useMemo(() => new Set(selectedItemIds), [selectedItemIds]);

  return (
    <section
      className="view-scroller grid-view"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onBackgroundClick();
      }}
    >
      <div className="filter-bar">
        <button
          className={tagFilter === "all" ? "active" : ""}
          type="button"
          onClick={() => setTagFilter("all")}
        >
          All
        </button>
        {tags.map((tag) => (
          <button
            className={tag.id === tagFilter ? "active" : ""}
            key={tag.id}
            type="button"
            onClick={() => setTagFilter(tag.id)}
          >
            {tag.text}
          </button>
        ))}
      </div>

      {filteredItems.length ? (
        <div
          className="item-grid"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) onBackgroundClick();
          }}
        >
          {filteredItems.map((item) => (
            <ItemCard
              item={item}
              tags={tags}
              canvasColors={canvasColorsForItem(item.id, canvases)}
              key={item.id}
              thumbUrls={thumbUrls}
              setThumbUrls={setThumbUrls}
              isSelected={selectedSet.has(item.id)}
              selectedItemIds={selectedItemIds}
              onDragStart={onDragStart}
              onOpen={(itemId, event) =>
                onItemOpen(itemId, event, filteredItems, true)
              }
            />
          ))}
        </div>
      ) : (
        <EmptyState label="No items in this view" />
      )}
    </section>
  );
}

function ItemCard({
  item,
  tags,
  canvasColors,
  thumbUrls,
  setThumbUrls,
  isSelected,
  selectedItemIds,
  onDragStart,
  onOpen,
  compact = false,
}: {
  item: FolioItem;
  tags: Tag[];
  canvasColors: string[];
  thumbUrls: ThumbnailUrls;
  setThumbUrls: React.Dispatch<React.SetStateAction<ThumbnailUrls>>;
  isSelected: boolean;
  selectedItemIds: string[];
  onDragStart: (itemId: string, event: React.DragEvent<HTMLElement>) => void;
  onOpen: (itemId: string, event: React.MouseEvent) => void;
  compact?: boolean;
}) {
  const itemTags = tagTextsForItem(item, tags);

  return (
    <button
      className={`item-card ${compact ? "item-card-compact" : ""} ${
        item.missing ? "item-missing" : ""
      } ${isSelected ? "item-selected" : ""}`}
      draggable={!item.missing}
      type="button"
      title={item.path}
      onClick={(event) => onOpen(item.id, event)}
      onDragStart={(event) => onDragStart(item.id, event)}
    >
      <LazyThumbnail
        item={item}
        thumbUrls={thumbUrls}
        setThumbUrls={setThumbUrls}
      />
      <CanvasDots colors={canvasColors} />
      <span className="item-title">{item.title || basename(item.path)}</span>
      <span className="item-subtitle">
        {TYPE_LABELS[item.type]} · {basename(item.path)}
      </span>
      {itemTags.length ? (
        <span className="card-tags">
          {itemTags.slice(0, compact ? 2 : 3).map((tag) => (
            <span className="tag-chip" key={tag}>
              {tag}
            </span>
          ))}
        </span>
      ) : null}
      {isSelected && selectedItemIds.length > 1 ? (
        <span className="selection-count">+{selectedItemIds.length - 1}</span>
      ) : null}
    </button>
  );
}

function CanvasDots({ colors }: { colors: string[] }) {
  if (!colors.length) return <span className="canvas-membership-dots empty" />;

  return (
    <span className="canvas-membership-dots" aria-label={`${colors.length} boards`}>
      {colors.slice(0, 6).map((color, index) => (
        <span
          key={`${color}-${index}`}
          style={{ background: color }}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

function LazyThumbnail({
  item,
  thumbUrls,
  setThumbUrls,
}: {
  item: FolioItem;
  thumbUrls: ThumbnailUrls;
  setThumbUrls: React.Dispatch<React.SetStateAction<ThumbnailUrls>>;
}) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [directSrc, setDirectSrc] = useState<string | null>(null);

  useEffect(() => {
    setDirectSrc(null);
  }, [item.id, item.path]);

  useEffect(() => {
    const node = shellRef.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setVisible(true);
        observer.disconnect();
      },
      { rootMargin: "180px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || thumbUrls[item.id]) return undefined;

    let cancelled = false;
    window.folio
      .ensureThumbnails([item.id])
      .then((urls) => {
        if (cancelled) return;
        setThumbUrls((current) => ({ ...current, ...urls }));
      })
      .catch((error) => {
        console.error(error);
      });

    return () => {
      cancelled = true;
    };
  }, [item.id, setThumbUrls, thumbUrls, visible]);

  useEffect(() => {
    if (!visible || !itemCanUseDirectPreview(item)) return undefined;

    let cancelled = false;
    window.folio
      .getFileDataUrl(item.path)
      .then((url) => {
        if (!cancelled) setDirectSrc(url);
      })
      .catch((error) => {
        console.error(error);
      });

    return () => {
      cancelled = true;
    };
  }, [item.missing, item.path, item.type, visible]);

  const src = directSrc ?? thumbUrls[item.id];

  return (
    <span className="thumb-shell" ref={shellRef}>
      {src ? (
        <img
          loading="lazy"
          src={src}
          alt=""
          onError={() => {
            if (directSrc) setDirectSrc(null);
          }}
        />
      ) : (
        <span className="thumb-placeholder">{item.missing ? "Missing" : "Preview"}</span>
      )}
    </span>
  );
}

function DetailDrawer({
  item,
  tags,
  canvases,
  thumbUrls,
  setThumbUrls,
  onClose,
  onPatch,
  onAddTag,
  onRemoveTag,
  onAddToCanvas,
  onDelete,
}: {
  item: FolioItem | null;
  tags: Tag[];
  canvases: Canvas[];
  thumbUrls: ThumbnailUrls;
  setThumbUrls: React.Dispatch<React.SetStateAction<ThumbnailUrls>>;
  onClose: () => void;
  onPatch: (itemId: string, patch: Partial<FolioItem>, message?: string) => void;
  onAddTag: (itemId: string, text: string) => void;
  onRemoveTag: (itemId: string, tagText: string) => void;
  onAddToCanvas: (itemId: string) => void;
  onDelete: (itemId: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagInput, setTagInput] = useState("");
  const drawerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setTitle(item?.title ?? "");
    setDescription(item?.description ?? "");
    setTagInput("");
  }, [item]);

  useEffect(() => {
    if (!item) return undefined;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (drawerRef.current?.contains(target)) return;
      onClose();
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [item, onClose]);

  if (!item) return null;

  const itemTags = tagTextsForItem(item, tags);
  const itemCanvases = canvases.filter((canvas) => canvas.itemIds.includes(item.id));

  const saveTitle = () => {
    const trimmed = title.trim() || basename(item.path);
    if (trimmed !== item.title) onPatch(item.id, { title: trimmed }, "Title saved");
  };

  const saveDescription = () => {
    if (description !== item.description) {
      onPatch(item.id, { description }, "Description saved");
    }
  };

  const submitTag = () => {
    if (!tagInput.trim()) return;
    onAddTag(item.id, tagInput);
    setTagInput("");
  };

  return (
    <>
      <aside className="detail-drawer" aria-label="Item details" ref={drawerRef}>
      <div className="drawer-header">
        <div>
          <p>{TYPE_LABELS[item.type]}</p>
          <strong>{basename(item.path)}</strong>
        </div>
        <button type="button" onClick={onClose} aria-label="Close details">
          Close
        </button>
      </div>

      <div className="drawer-preview">
        <LazyThumbnail
          item={item}
          thumbUrls={thumbUrls}
          setThumbUrls={setThumbUrls}
        />
      </div>

      <label className="field">
        <span>Title</span>
        <input
          value={title}
          onBlur={saveTitle}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
        />
      </label>

      <label className="field">
        <span>Notes</span>
        <textarea
          value={description}
          rows={4}
          onBlur={saveDescription}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>

      <div className="drawer-section">
        <div className="drawer-label">Tags</div>
        <div className="tag-list">
          {itemTags.length ? (
            itemTags.map((tag) => (
              <button
                className="tag-chip tag-chip-removable"
                key={tag}
                type="button"
                onClick={() => onRemoveTag(item.id, tag)}
              >
                {tag}
                <span aria-hidden="true">x</span>
              </button>
            ))
          ) : (
            <span className="muted">No tags</span>
          )}
        </div>
        <input
          className="tag-input"
          placeholder="Tag name"
          value={tagInput}
          onChange={(event) => setTagInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submitTag();
            }
          }}
        />
      </div>

      <div className="drawer-section">
        <div className="drawer-label">Board membership</div>
        {itemCanvases.length ? (
          <div className="canvas-chip-list">
            {itemCanvases.map((canvas) => (
              <span className="canvas-chip" key={canvas.id}>
                <span style={{ background: canvas.color }} aria-hidden="true" />
                {canvas.title}
              </span>
            ))}
          </div>
        ) : (
          <p className="muted">No boards</p>
        )}
      </div>

      <div className="drawer-actions">
        <button type="button" onClick={() => onAddToCanvas(item.id)}>
          Add to board
        </button>
        <button type="button" onClick={() => window.folio.openInFinder(item.path)}>
          Show in Finder
        </button>
        <button
          className="danger-action"
          type="button"
          onClick={() => onDelete(item.id)}
        >
          Delete
        </button>
      </div>
      </aside>
    </>
  );
}

function CanvasView({
  data,
  activeCanvasId,
  setActiveCanvasId,
  thumbUrls,
  setThumbUrls,
  selectedItemIds,
  commitData,
  saveData,
  clearDragState,
}: {
  data: FolioData;
  activeCanvasId: string | null;
  setActiveCanvasId: React.Dispatch<React.SetStateAction<string | null>>;
  thumbUrls: ThumbnailUrls;
  setThumbUrls: React.Dispatch<React.SetStateAction<ThumbnailUrls>>;
  selectedItemIds: string[];
  commitData: (updater: DataUpdater, message?: string) => void;
  saveData: (data: FolioData, message?: string) => void;
  clearDragState: () => void;
}) {
  const activeCanvas =
    data.canvases.find((canvas) => canvas.id === activeCanvasId) ??
    data.canvases[0] ??
    null;
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const [dragPreview, setDragPreview] = useState<{
    id: string;
    kind: "item" | "reference";
    position: CanvasPosition;
  } | null>(null);
  const [expandedCanvasIds, setExpandedCanvasIds] = useState<string[]>([]);

  useEffect(() => {
    if (!activeCanvas && data.canvases[0]) {
      setActiveCanvasId(data.canvases[0].id);
    }
  }, [activeCanvas, data.canvases, setActiveCanvasId]);

  const activeItems = useMemo(
    () =>
      activeCanvas
        ? activeCanvas.itemIds
            .map((itemId) => data.items.find((item) => item.id === itemId))
            .filter(Boolean) as FolioItem[]
        : [],
    [activeCanvas, data.items],
  );

  const activeItemIds = useMemo(
    () => new Set(activeCanvas?.itemIds ?? []),
    [activeCanvas],
  );

  const createBoard = useCallback(() => {
    const defaultTitle = `Board ${data.canvases.length + 1}`;
    const title = window.prompt("Board name", defaultTitle);
    if (title === null) return;
    const description = window.prompt("Opening note (optional)", "") ?? "";
    const board = createCanvas(data.canvases.length, title, description);
    setActiveCanvasId(board.id);
    commitData(
      (current) => ({
        ...current,
        canvases: [board, ...current.canvases],
      }),
      "Board created",
    );
  }, [commitData, data.canvases.length, setActiveCanvasId]);

  const updateCanvas = useCallback(
    (canvasId: string, updater: (canvas: Canvas) => Canvas, message?: string) => {
      commitData(
        (current) => ({
          ...current,
          canvases: current.canvases.map((canvas) =>
            canvas.id === canvasId ? updater(canvas) : canvas,
          ),
        }),
        message,
      );
    },
    [commitData],
  );

  const addItem = useCallback(
    (itemId: string) => {
      if (!activeCanvas) return;
      updateCanvas(activeCanvas.id, (canvas) => addItemToCanvas(canvas, itemId), "Added");
    },
    [activeCanvas, updateCanvas],
  );

  const addDroppedItems = useCallback(
    (itemIds: string[], position: CanvasPosition) => {
      if (!activeCanvas || !itemIds.length) return;
      const knownItemIds = new Set(data.items.map((item) => item.id));
      const validItemIds = itemIds.filter((itemId) => knownItemIds.has(itemId));
      if (!validItemIds.length) return;

      updateCanvas(
        activeCanvas.id,
        (canvas) => addItemsToCanvas(canvas, validItemIds, position),
        "Selection added to board",
      );
    },
    [activeCanvas, data.items, updateCanvas],
  );

  const importToBoard = useCallback(async () => {
    if (!activeCanvas) return;
    const filePaths = await window.folio.openFileDialog();
    if (!filePaths.length) return;

    try {
      const imported = await window.folio.copyToFolio(filePaths);
      if (!imported.length) return;

      const nextItems = mergeItems(data.items, imported);
      const nextCanvas = imported.reduce(
        (canvas, item) => addItemToCanvas(canvas, item.id),
        activeCanvas,
      );

      saveData(
        {
          ...data,
          items: nextItems,
          canvases: data.canvases.map((canvas) =>
            canvas.id === activeCanvas.id ? nextCanvas : canvas,
          ),
        },
        `${formatCount(imported.length, "item")} added to board`,
      );
    } catch (error) {
      console.error(error);
    }
  }, [activeCanvas, data, saveData]);

  const removeItem = useCallback(
    (itemId: string) => {
      if (!activeCanvas) return;
      updateCanvas(activeCanvas.id, (canvas) => {
        const positions = { ...canvas.positions };
        delete positions[itemId];
        return {
          ...canvas,
          itemIds: canvas.itemIds.filter((id) => id !== itemId),
          positions,
          edges: canvas.edges.filter(
            (edge) => edge.fromId !== itemId && edge.toId !== itemId,
          ),
        };
      }, "Removed");
    },
    [activeCanvas, updateCanvas],
  );

  const addNote = useCallback(() => {
    if (!activeCanvas) return;
    const note: CanvasNote = {
      id: createId("note"),
      text: "",
      x: 140,
      y: 120,
    };
    updateCanvas(
      activeCanvas.id,
      (canvas) => ({ ...canvas, notes: [...canvas.notes, note] }),
      "Note added",
    );
  }, [activeCanvas, updateCanvas]);

  const positionForItem = useCallback(
    (item: FolioItem, index: number): CanvasPosition => {
      if (dragPreview?.kind === "item" && dragPreview.id === item.id) {
        return dragPreview.position;
      }
      return activeCanvas?.positions[item.id] ?? {
        x: 80 + (index % 4) * 190,
        y: 90 + Math.floor(index / 4) * 230,
      };
    },
    [activeCanvas, dragPreview],
  );

  const positionForReference = useCallback(
    (reference: CanvasReference): CanvasPosition => {
      if (dragPreview?.kind === "reference" && dragPreview.id === reference.id) {
        return dragPreview.position;
      }
      return { x: reference.x, y: reference.y };
    },
    [dragPreview],
  );

  const startDrag = useCallback(
    (
      event: React.PointerEvent,
      kind: "item" | "reference",
      objectId: string,
      startPosition: CanvasPosition,
    ) => {
      if (!activeCanvas) return;
      event.preventDefault();
      const startPointer = { x: event.clientX, y: event.clientY };

      const onPointerMove = (moveEvent: PointerEvent) => {
        setDragPreview({
          id: objectId,
          kind,
          position: {
            x: Math.max(0, startPosition.x + moveEvent.clientX - startPointer.x),
            y: Math.max(0, startPosition.y + moveEvent.clientY - startPointer.y),
          },
        });
      };

      const onPointerUp = (upEvent: PointerEvent) => {
        const finalPosition = {
          x: Math.max(0, startPosition.x + upEvent.clientX - startPointer.x),
          y: Math.max(0, startPosition.y + upEvent.clientY - startPointer.y),
        };
        setDragPreview(null);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);

        const nextData = {
          ...data,
          canvases: data.canvases.map((canvas) => {
            if (canvas.id !== activeCanvas.id) return canvas;
            if (kind === "item") {
              return {
                ...canvas,
                positions: {
                  ...canvas.positions,
                  [objectId]: finalPosition,
                },
              };
            }
            return {
              ...canvas,
              references: canvas.references.map((reference) =>
                reference.id === objectId
                  ? { ...reference, ...finalPosition }
                  : reference,
              ),
            };
          }),
        };

        saveData(nextData, "Position saved");
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [activeCanvas, data, saveData],
  );

  const canvasPointFromEvent = useCallback((event: React.DragEvent) => {
    const surface = surfaceRef.current;
    if (!surface) return { x: 120, y: 120 };
    const rect = surface.getBoundingClientRect();
    return {
      x: Math.max(0, event.clientX - rect.left),
      y: Math.max(0, event.clientY - rect.top),
    };
  }, []);

  const handleReferenceDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      clearDragState();
      if (!activeCanvas) return;

      const itemPayload = event.dataTransfer.getData(ITEM_DRAG_MIME);
      if (itemPayload) {
        try {
          const itemIds = JSON.parse(itemPayload) as string[];
          addDroppedItems(itemIds, canvasPointFromEvent(event));
        } catch (error) {
          console.error(error);
        }
        return;
      }

      const filePaths = Array.from(event.dataTransfer.files)
        .map((file) => window.folio.getPathForFile(file))
        .filter(Boolean);
      if (!filePaths.length) return;

      const point = canvasPointFromEvent(event);
      try {
        const references = await window.folio.copyReference(activeCanvas.id, filePaths);
        const placed = references.map((reference, index) => ({
          ...reference,
          x: point.x + index * 28,
          y: point.y + index * 28,
        }));

        commitData(
          (current) => ({
            ...current,
            canvases: current.canvases.map((canvas) =>
              canvas.id === activeCanvas.id
                ? { ...canvas, references: [...canvas.references, ...placed] }
                : canvas,
            ),
          }),
          "Reference added",
        );
      } catch (error) {
        console.error(error);
      }
    },
    [activeCanvas, addDroppedItems, canvasPointFromEvent, clearDragState, commitData],
  );

  const handleReferenceDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const updateNote = useCallback(
    (noteId: string, text: string) => {
      if (!activeCanvas) return;
      updateCanvas(activeCanvas.id, (canvas) => ({
        ...canvas,
        notes: canvas.notes.map((note) =>
          note.id === noteId ? { ...note, text } : note,
        ),
      }));
    },
    [activeCanvas, updateCanvas],
  );

  const deleteNote = useCallback(
    (noteId: string) => {
      if (!activeCanvas) return;
      updateCanvas(activeCanvas.id, (canvas) => ({
        ...canvas,
        notes: canvas.notes.filter((note) => note.id !== noteId),
      }), "Note deleted");
    },
    [activeCanvas, updateCanvas],
  );

  const removeReference = useCallback(
    (referenceId: string) => {
      if (!activeCanvas) return;
      updateCanvas(activeCanvas.id, (canvas) => ({
        ...canvas,
        references: canvas.references.filter(
          (reference) => reference.id !== referenceId,
        ),
      }), "Reference removed");
    },
    [activeCanvas, updateCanvas],
  );

  const renameCanvas = useCallback(
    (title: string) => {
      if (!activeCanvas) return;
      const trimmed = title.trim();
      if (!trimmed || trimmed === activeCanvas.title) return;
      updateCanvas(activeCanvas.id, (canvas) => ({ ...canvas, title: trimmed }));
    },
    [activeCanvas, updateCanvas],
  );

  const toggleCanvasExpanded = useCallback((canvasId: string) => {
    setExpandedCanvasIds((current) =>
      current.includes(canvasId)
        ? current.filter((expandedId) => expandedId !== canvasId)
        : [...current, canvasId],
    );
  }, []);

  const openCanvas = useCallback(
    (canvasId: string) => {
      setActiveCanvasId(canvasId);
    },
    [setActiveCanvasId],
  );

  if (!activeCanvas) {
    return (
      <section className="view-scroller canvas-empty">
        <div className="canvas-board-preview">
          <div className="board-node board-node-a" />
          <div className="board-node board-node-b" />
          <div className="board-node board-node-c" />
          <svg viewBox="0 0 460 240" aria-hidden="true">
            <path d="M116 92 C170 54, 242 70, 310 116" />
            <path d="M164 164 C226 186, 292 178, 346 142" />
          </svg>
        </div>
        <button className="primary-action" type="button" onClick={createBoard}>
          New board
        </button>
      </section>
    );
  }

  return (
    <section className="canvas-workspace">
      <div className="canvas-board-strip">
        <button className="primary-action full-width" type="button" onClick={createBoard}>
          New board
        </button>
        <div className="canvas-list">
          {data.canvases.map((canvas) => {
            const expanded = expandedCanvasIds.includes(canvas.id);
            const memberItems = canvas.itemIds
              .map((itemId) => data.items.find((item) => item.id === itemId))
              .filter(Boolean) as FolioItem[];
            return (
              <article
                className={`canvas-list-item ${
                  canvas.id === activeCanvas.id ? "active" : ""
                }`}
                key={canvas.id}
              >
                <button
                  className="canvas-row"
                  type="button"
                  onClick={() => openCanvas(canvas.id)}
                >
                  <span
                    className="canvas-row-dot"
                    style={{ background: canvas.color }}
                  />
                  <span className="canvas-row-copy">
                    <strong>{canvas.title}</strong>
                    <small>{formatCount(canvas.itemIds.length, "item")}</small>
                  </span>
                  <span className="canvas-row-badges" aria-label="Board contents">
                    <span>{formatCount(canvas.notes.length, "note")}</span>
                    <span>{formatCount(canvas.references.length, "ref")}</span>
                    <span>{formatCount(canvas.edges.length, "link")}</span>
                  </span>
                </button>
                <button
                  className="canvas-expand-button"
                  type="button"
                  onClick={() => toggleCanvasExpanded(canvas.id)}
                >
                  {expanded ? "Hide" : "Details"}
                </button>

                {expanded ? (
                  <div className="canvas-list-details">
                    <p>{canvas.description?.trim() || "No opening note"}</p>
                    <div className="canvas-member-grid">
                      {memberItems.length ? (
                        memberItems.slice(0, 8).map((item) => (
                          <span className="mini-thumb" key={item.id}>
                            <LazyThumbnail
                              item={item}
                              thumbUrls={thumbUrls}
                              setThumbUrls={setThumbUrls}
                            />
                          </span>
                        ))
                      ) : (
                        <span className="muted">No items</span>
                      )}
                    </div>
                    <button
                      className="canvas-open-button"
                      type="button"
                      onClick={() => openCanvas(canvas.id)}
                    >
                      Open board
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>

      <div className="canvas-panel">
        <header className="canvas-toolbar">
          <span className="canvas-dot" style={{ background: activeCanvas.color }} />
          <input
            defaultValue={activeCanvas.title}
            onBlur={(event) => renameCanvas(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
          />
          <span>
            {formatCount(activeCanvas.itemIds.length, "item")} ·{" "}
            {formatCount(activeCanvas.notes.length, "note")} ·{" "}
            {formatCount(activeCanvas.references.length, "reference")}
          </span>
          <button type="button" onClick={addNote}>
            Add note
          </button>
          <button type="button" onClick={importToBoard}>
            Import to board
          </button>
        </header>

        <ArchiveRail
          items={data.items}
          activeItemIds={activeItemIds}
          selectedItemIds={selectedItemIds}
          thumbUrls={thumbUrls}
          setThumbUrls={setThumbUrls}
          onAddItem={addItem}
        />

        <div className="canvas-scroll">
          <div
            className="canvas-surface"
            ref={surfaceRef}
            onDrop={handleReferenceDrop}
            onDragOver={handleReferenceDragOver}
          >
            {activeItems.map((item, index) => {
              const position = positionForItem(item, index);
              return (
                <CanvasItemCard
                  item={item}
                  key={item.id}
                  position={position}
                  thumbUrls={thumbUrls}
                  setThumbUrls={setThumbUrls}
                  onRemove={removeItem}
                  onPointerDown={(event) =>
                    startDrag(event, "item", item.id, position)
                  }
                />
              );
            })}

            {activeCanvas.references.map((reference) => {
              const position = positionForReference(reference);
              return (
                <ReferenceCard
                  key={reference.id}
                  reference={reference}
                  position={position}
                  onRemove={removeReference}
                  onPointerDown={(event) =>
                    startDrag(event, "reference", reference.id, position)
                  }
                />
              );
            })}

            {activeCanvas.notes.map((note) => (
              <CanvasNoteCard
                key={note.id}
                note={note}
                onChange={updateNote}
                onDelete={deleteNote}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ArchiveRail({
  items,
  activeItemIds,
  selectedItemIds,
  thumbUrls,
  setThumbUrls,
  onAddItem,
}: {
  items: FolioItem[];
  activeItemIds: Set<string>;
  selectedItemIds: string[];
  thumbUrls: ThumbnailUrls;
  setThumbUrls: React.Dispatch<React.SetStateAction<ThumbnailUrls>>;
  onAddItem: (itemId: string) => void;
}) {
  const selectedSet = useMemo(() => new Set(selectedItemIds), [selectedItemIds]);

  return (
    <div className="archive-rail">
      <span>Archive</span>
      {items.length ? (
        items.map((item) => {
          const isOnBoard = activeItemIds.has(item.id);
          const isSelected = selectedSet.has(item.id);
          return (
          <button
            className={`${isOnBoard ? "on-board" : ""} ${
              isSelected ? "selected" : ""
            }`}
            draggable={!item.missing}
            key={item.id}
            type="button"
            onDragStart={(event) => {
              const itemIds = isSelected ? selectedItemIds : [item.id];
              event.dataTransfer.setData(ITEM_DRAG_MIME, JSON.stringify(itemIds));
              event.dataTransfer.effectAllowed = "copy";
            }}
            onClick={() => {
              if (!isOnBoard) onAddItem(item.id);
            }}
          >
            <LazyThumbnail
              item={item}
              thumbUrls={thumbUrls}
              setThumbUrls={setThumbUrls}
            />
            <span>
              <strong>{item.title || basename(item.path)}</strong>
              <small>{isOnBoard ? "On board" : "Add"}</small>
            </span>
          </button>
          );
        })
      ) : (
        <small>No archive items yet</small>
      )}
    </div>
  );
}

function CanvasItemCard({
  item,
  position,
  thumbUrls,
  setThumbUrls,
  onRemove,
  onPointerDown,
}: {
  item: FolioItem;
  position: CanvasPosition;
  thumbUrls: ThumbnailUrls;
  setThumbUrls: React.Dispatch<React.SetStateAction<ThumbnailUrls>>;
  onRemove: (itemId: string) => void;
  onPointerDown: (event: React.PointerEvent) => void;
}) {
  return (
    <div
      className="canvas-card"
      style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
    >
      <div className="canvas-card-handle" onPointerDown={onPointerDown}>
        <span>{TYPE_LABELS[item.type]}</span>
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onRemove(item.id)}
        >
          Remove
        </button>
      </div>
      <LazyThumbnail
        item={item}
        thumbUrls={thumbUrls}
        setThumbUrls={setThumbUrls}
      />
      <strong>{item.title || basename(item.path)}</strong>
    </div>
  );
}

function ReferenceCard({
  reference,
  position,
  onRemove,
  onPointerDown,
}: {
  reference: CanvasReference;
  position: CanvasPosition;
  onRemove: (referenceId: string) => void;
  onPointerDown: (event: React.PointerEvent) => void;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    window.folio
      .getFileDataUrl(reference.path)
      .then((dataUrl) => {
        if (!cancelled) setSrc(dataUrl);
      })
      .catch((error) => console.error(error));

    return () => {
      cancelled = true;
    };
  }, [reference.path]);

  return (
    <div
      className="canvas-card reference-card"
      style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
    >
      <div className="canvas-card-handle" onPointerDown={onPointerDown}>
        <span>Reference</span>
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onRemove(reference.id)}
        >
          Remove
        </button>
      </div>
      <span className="thumb-shell">
        {src ? <img src={src} alt="" /> : <span className="thumb-placeholder">Ref</span>}
      </span>
      <strong>{reference.filename}</strong>
    </div>
  );
}

function CanvasNoteCard({
  note,
  onChange,
  onDelete,
}: {
  note: CanvasNote;
  onChange: (noteId: string, text: string) => void;
  onDelete: (noteId: string) => void;
}) {
  const [draft, setDraft] = useState(note.text);

  useEffect(() => {
    setDraft(note.text);
  }, [note.text]);

  return (
    <div
      className="canvas-note"
      style={{ transform: `translate(${note.x}px, ${note.y}px)` }}
    >
      <textarea
        placeholder="Note"
        value={draft}
        onBlur={() => {
          if (draft.trim()) {
            onChange(note.id, draft);
          } else {
            onDelete(note.id);
          }
        }}
        onChange={(event) => setDraft(event.target.value)}
      />
      <button type="button" onClick={() => onDelete(note.id)}>
        Delete
      </button>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="empty-state">{label}</div>;
}

function StatusBar({
  itemCount,
  canvasCount,
  tagCount,
  gapCount,
}: {
  itemCount: number;
  canvasCount: number;
  tagCount: number;
  gapCount: number;
}) {
  return (
    <footer className="status-bar">
      <span>{formatCount(itemCount, "item")}</span>
      <span>{formatCount(canvasCount, "canvas")}</span>
      <span>{formatCount(tagCount, "tag")}</span>
      <span>{formatCount(gapCount, "gap")}</span>
      <span>~/Documents/Folio/</span>
    </footer>
  );
}

export default function App() {
  return <AppShell />;
}
