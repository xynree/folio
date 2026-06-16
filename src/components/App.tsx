import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Grid3X3,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Rows3,
  Upload,
} from "lucide-react";
import type {
  Canvas,
  FolioData,
  FolioItem,
  ReconciliationResult,
  ThumbnailUrls,
} from "../types";
import { ArchiveWorkspace } from "./archive/ArchiveWorkspace";
import { DailyStripView } from "./archive/DailyStripView";
import { GridView } from "./archive/GridView";
import { TagsSidebar } from "./archive/TagsSidebar";
import { CanvasView } from "./canvas/CanvasView";
import { DetailDrawer } from "./details/DetailDrawer";
import {
  ARCHIVE_PANEL_MIN_WIDTH,
  CANVAS_DOCK_DEFAULT_WIDTH,
  CANVAS_DOCK_MIN_WIDTH,
  CANVAS_SPLITTER_WIDTH,
  EMPTY_DATA,
  ITEM_DRAG_MIME,
} from "./folio/constants";
import type {
  ArchiveViewMode,
  DataUpdater,
  GridTagFilter,
  ItemDetailsMode,
  ItemDetailsOpenHandler,
  ItemOpenHandler,
} from "./folio/types";
import {
  addItemToCanvas,
  addItemsToCanvas,
  basename,
  createCanvas,
  createId,
  formatCount,
  getGaps,
  mergeItems,
} from "./folio/model";
import { ReconciliationNotice } from "./layout/ReconciliationNotice";
import { SelectionBar } from "./layout/SelectionBar";
import { StatusBar } from "./layout/StatusBar";
import { ButtonIcon } from "./shared/ButtonIcon";

export function AppShell() {
  const [data, setData] = useState<FolioData>(EMPTY_DATA);
  const dataRef = useRef<FolioData>(EMPTY_DATA);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [archiveView, setArchiveView] = useState<ArchiveViewMode>("strip");
  const [tagsCollapsed, setTagsCollapsed] = useState(false);
  const [canvasMinimized, setCanvasMinimized] = useState(false);
  const [canvasDockWidth, setCanvasDockWidth] = useState(CANVAS_DOCK_DEFAULT_WIDTH);
  const [canvasDockResizing, setCanvasDockResizing] = useState(false);
  const [gridTagFilter, setGridTagFilter] = useState<GridTagFilter>("all");
  const [thumbUrls, setThumbUrls] = useState<ThumbnailUrls>({});
  const [detailItemId, setDetailItemId] = useState<string | null>(null);
  const [detailMode, setDetailMode] = useState<ItemDetailsMode>("details");
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
      setCanvasDockResizing(true);

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
        setCanvasDockResizing(false);
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
        (a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title),
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

  const selectedItem = data.items.find((item) => item.id === detailItemId) ?? null;

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
      setDetailItemId(null);
      clearSelection();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearSelection]);

  const handleItemOpen = useCallback<ItemOpenHandler>(
    (itemId, event, orderedItems, rangeEnabled) => {
      event.stopPropagation();

      if (event.metaKey || event.ctrlKey) {
        setDetailItemId(null);
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
          setDetailItemId(null);
          setSelectedItemIds(orderedItems.slice(from, to + 1).map((item) => item.id));
          setLastSelectedItemId(itemId);
          return;
        }
      }

      setSelectedItemIds([itemId]);
      setDetailItemId(null);
      setLastSelectedItemId(itemId);
    },
    [lastSelectedItemId, selectedItemIds],
  );

  const openItemDetails = useCallback<ItemDetailsOpenHandler>((itemId, mode = "details") => {
    setSelectedItemIds([itemId]);
    setDetailItemId(itemId);
    setDetailMode(mode);
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

  const createBoard = useCallback(() => {
    let boardId: string | null = null;

    commitData(
      (current) => {
        const board = createCanvas(current.canvases.length);
        boardId = board.id;
        return {
          ...current,
          canvases: [board, ...current.canvases],
        };
      },
      "Board created",
    );

    if (boardId) {
      setActiveCanvasId(boardId);
      setCanvasMinimized(false);
    }
  }, [commitData]);

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
    const itemIds = [...selectedItemIds];
    if (!itemIds.length) return;

    let boardId: string | null = null;
    commitData(
      (current) => {
        const knownItemIds = new Set(current.items.map((item) => item.id));
        const validItemIds = itemIds.filter((itemId) => knownItemIds.has(itemId));
        if (!validItemIds.length) return current;

        const board = addItemsToCanvas(
          createCanvas(current.canvases.length),
          validItemIds,
        );
        boardId = board.id;

        return {
          ...current,
          canvases: [board, ...current.canvases],
        };
      },
      "Selection opened on new board",
    );

    if (boardId) {
      setActiveCanvasId(boardId);
      setCanvasMinimized(false);
      clearSelection();
    } else {
      setToast("No selected items found");
    }
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
        setDetailItemId(null);
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
    ? `minmax(${ARCHIVE_PANEL_MIN_WIDTH}px, 1fr) 0px 58px`
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
          } ${canvasDockResizing ? "studio-workspace-resizing" : ""}`}
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
                    <ButtonIcon icon={Rows3} />
                    Strip
                  </button>
                  <button
                    className={archiveView === "grid" ? "active" : ""}
                    type="button"
                    onClick={() => setArchiveView("grid")}
                  >
                    <ButtonIcon icon={Grid3X3} />
                    Grid
                  </button>
                </div>
                <button className="primary-action" type="button" onClick={handleOpenDialog}>
                  <ButtonIcon icon={Upload} />
                  {busy ? "Importing" : "Import"}
                </button>
              </div>
            </header>

            <ArchiveWorkspace
              sidebarCollapsed={tagsCollapsed}
              sidebar={
                <TagsSidebar
                  items={sortedItems}
                  tags={data.tags}
                  canvases={data.canvases}
                  thumbUrls={thumbUrls}
                  setThumbUrls={setThumbUrls}
                  onOpenItem={openItemDetails}
                  collapsed={tagsCollapsed}
                  onToggleCollapsed={() => setTagsCollapsed((current) => !current)}
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
                  onEditItem={(itemId) => openItemDetails(itemId, "details")}
                  onAddTag={addTagToItem}
                  onRemoveTag={removeTagFromItem}
                  onDeleteItem={deleteItem}
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
                  onEditItem={(itemId) => openItemDetails(itemId, "details")}
                  onAddTag={addTagToItem}
                  onRemoveTag={removeTagFromItem}
                  onDeleteItem={deleteItem}
                />
              )}
            </ArchiveWorkspace>
          </section>

          <div
            className={`canvas-resize-handle ${
              canvasMinimized ? "canvas-resize-handle-hidden" : ""
            }`}
            role="separator"
            aria-label="Resize open board panel"
            aria-orientation="vertical"
            aria-hidden={canvasMinimized}
            tabIndex={canvasMinimized ? -1 : 0}
            onKeyDown={(event) => {
              if (canvasMinimized) return;
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                nudgeCanvasDockWidth(32);
              }
              if (event.key === "ArrowRight") {
                event.preventDefault();
                nudgeCanvasDockWidth(-32);
              }
            }}
            onPointerDown={(event) => {
              if (canvasMinimized) return;
              startCanvasDockResize(event);
            }}
          />

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
              <div className="canvas-dock-header-actions">
                {canvasMinimized ? null : (
                  <button
                    className="secondary-action canvas-dock-new-board-button"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      createBoard();
                    }}
                  >
                    <ButtonIcon icon={Plus} />
                    New board
                  </button>
                )}
                <button
                  className="icon-button"
                  type="button"
                  aria-label={canvasMinimized ? "Open board panel" : "Minimize board panel"}
                  title={canvasMinimized ? "Open board panel" : "Minimize board panel"}
                  onClick={() => setCanvasMinimized((current) => !current)}
                >
                  <ButtonIcon icon={canvasMinimized ? PanelRightOpen : PanelRightClose} />
                </button>
              </div>
            </header>

            {canvasMinimized ? null : (
              <CanvasView
                data={data}
                activeCanvasId={activeCanvasId}
                setActiveCanvasId={setActiveCanvasId}
                onOpenItem={openItemDetails}
                thumbUrls={thumbUrls}
                setThumbUrls={setThumbUrls}
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
        initialFocus={detailMode}
        onClose={() => setDetailItemId(null)}
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

export default function App() {
  return <AppShell />;
}
