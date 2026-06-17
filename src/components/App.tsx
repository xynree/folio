import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Columns2,
  Grid3X3,
  PanelLeft,
  PanelRight,
  Rows3,
  Upload,
} from "lucide-react";
import type {
  Canvas,
  FolioData,
  FolioItem,
  ImportSource,
  ReconciliationResult,
  ThumbnailUrls,
} from "../types";
import { ArchiveWorkspace } from "./archive/ArchiveWorkspace";
import { DailyStripView } from "./archive/DailyStripView";
import { GridView } from "./archive/GridView";
import { ArchiveHeatmap } from "./archive/HeatmapView";
import { TagsSidebar } from "./archive/TagsSidebar";
import { CanvasView } from "./canvas/CanvasView";
import { DetailDrawer } from "./details/DetailDrawer";
import {
  ARCHIVE_PANEL_MIN_WIDTH,
  CANVAS_DOCK_DEFAULT_WIDTH,
  CANVAS_DOCK_MIN_WIDTH,
  CANVAS_SPLITTER_WIDTH,
  EMPTY_DATA,
  IMAGE_FILE_PATTERN,
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
  chooseAndImportItems,
  getImportFailureMessage,
} from "./folio/importing";
import {
  addItemToCanvas,
  addItemsToCanvas,
  basename,
  createCanvas,
  createId,
  formatCount,
  getGaps,
  markCanvasSaved,
  mergeImportedItemsIntoProject,
  mergeItems,
} from "./folio/model";
import { ReconciliationNotice } from "./layout/ReconciliationNotice";
import { SelectionBar } from "./layout/SelectionBar";
import { StatusBar } from "./layout/StatusBar";
import { ProjectsView } from "./projects/ProjectsView";
import { ButtonIcon } from "./shared/ButtonIcon";

const ARCHIVE_UI_SCALE_MIN = 50;
const ARCHIVE_UI_SCALE_MAX = 200;
const ARCHIVE_UI_SCALE_STEP = 5;
const TAGS_SIDEBAR_DEFAULT_WIDTH = 176;
const TAGS_SIDEBAR_MIN_WIDTH = 132;
const TAGS_SIDEBAR_MAX_WIDTH = 360;
type WorkspacePanelMode = "left" | "split" | "right";

function clipboardImageExtension(file: File) {
  const filenameExt = file.name.match(/\.[a-z0-9]+$/i)?.[0];
  if (filenameExt) return filenameExt.toLowerCase();
  if (file.type === "image/jpeg") return ".jpg";
  if (file.type === "image/png") return ".png";
  if (file.type === "image/webp") return ".webp";
  if (file.type === "image/gif") return ".gif";
  return ".png";
}

function normalizeFolioData(data: FolioData): FolioData {
  return {
    ...data,
    items: data.items ?? [],
    canvases: data.canvases ?? [],
    tags: data.tags ?? [],
    projects: data.projects ?? [],
  };
}

export function AppShell() {
  const [data, setData] = useState<FolioData>(EMPTY_DATA);
  const dataRef = useRef<FolioData>(EMPTY_DATA);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [archiveView, setArchiveView] = useState<ArchiveViewMode>("strip");
  const [archiveUiScale, setArchiveUiScale] = useState(100);
  const [heatmapMinimized, setHeatmapMinimized] = useState(false);
  const [tagsCollapsed, setTagsCollapsed] = useState(false);
  const [tagsSidebarWidth, setTagsSidebarWidth] = useState(
    TAGS_SIDEBAR_DEFAULT_WIDTH,
  );
  const [tagsSidebarResizing, setTagsSidebarResizing] = useState(false);
  const [archiveMinimized, setArchiveMinimized] = useState(false);
  const [canvasMinimized, setCanvasMinimized] = useState(false);
  const [canvasDockWidth, setCanvasDockWidth] = useState(CANVAS_DOCK_DEFAULT_WIDTH);
  const [canvasDockResizing, setCanvasDockResizing] = useState(false);
  const [gridTagFilter, setGridTagFilter] = useState<GridTagFilter>("all");
  const [thumbUrls, setThumbUrls] = useState<ThumbnailUrls>({});
  const [detailItemId, setDetailItemId] = useState<string | null>(null);
  const [detailMode, setDetailMode] = useState<ItemDetailsMode>("details");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [selectionBoardDialogOpen, setSelectionBoardDialogOpen] = useState(false);
  const [selectionBoardTitleDraft, setSelectionBoardTitleDraft] = useState("");
  const [selectionTagDialogOpen, setSelectionTagDialogOpen] = useState(false);
  const [selectionTagDraft, setSelectionTagDraft] = useState("");
  const [lastSelectedItemId, setLastSelectedItemId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeCanvasId, setActiveCanvasId] = useState<string | null>(null);
  const [canvasDetailRequestId, setCanvasDetailRequestId] = useState(0);
  const [reconciliation, setReconciliation] =
    useState<ReconciliationResult | null>(null);
  const [reconciliationDismissed, setReconciliationDismissed] = useState(false);
  const studioWorkspaceRef = useRef<HTMLElement | null>(null);
  const dragDepth = useRef(0);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const putData = useCallback((nextData: FolioData) => {
    const normalizedData = normalizeFolioData(nextData);
    dataRef.current = normalizedData;
    setData(normalizedData);
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
        const imported = activeProjectId && window.folio.copyToProject
          ? await window.folio.copyToProject(activeProjectId, uniquePaths)
          : await window.folio.copyToFolio(uniquePaths);
        if (imported.length) {
          putData(
            mergeImportedItemsIntoProject(
              dataRef.current,
              imported,
              activeProjectId,
            ),
          );
          setToast(`${formatCount(imported.length, "item")} added to today`);
        } else {
          setToast("No new items added");
        }
      } catch (error) {
        console.error(error);
        setToast(getImportFailureMessage(error, "Import failed"));
      } finally {
        setBusy(false);
      }
    },
    [activeProjectId, putData],
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

  const clampTagsSidebarWidth = useCallback(
    (width: number) =>
      Math.round(
        Math.min(
          Math.max(width, TAGS_SIDEBAR_MIN_WIDTH),
          TAGS_SIDEBAR_MAX_WIDTH,
        ),
      ),
    [],
  );

  const startTagsSidebarResize = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (tagsCollapsed) return;
      const workspace = studioWorkspaceRef.current;
      if (!workspace) return;

      event.preventDefault();
      event.stopPropagation();

      const previousCursor = document.body.style.cursor;
      const previousUserSelect = document.body.style.userSelect;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      setTagsSidebarResizing(true);

      const resizeToPointer = (clientX: number) => {
        const rect = workspace.getBoundingClientRect();
        setTagsSidebarWidth(clampTagsSidebarWidth(clientX - rect.left));
      };

      const onPointerMove = (moveEvent: PointerEvent) => {
        resizeToPointer(moveEvent.clientX);
      };

      const onPointerUp = () => {
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        setTagsSidebarResizing(false);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };

      resizeToPointer(event.clientX);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [clampTagsSidebarWidth, tagsCollapsed],
  );

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

  const showLeftOnlyPanel = useCallback(() => {
    setArchiveMinimized(false);
    setCanvasMinimized(true);
  }, []);

  const showRightOnlyPanel = useCallback(() => {
    setCanvasMinimized(false);
    setArchiveMinimized(true);
  }, []);

  const showSplitPanel = useCallback(() => {
    setArchiveMinimized(false);
    setCanvasMinimized(false);
  }, []);

  const activeProject = useMemo(
    () => data.projects.find((project) => project.id === activeProjectId) ?? null,
    [activeProjectId, data.projects],
  );

  const projectImageIdSet = useMemo(
    () => new Set(activeProject?.imageIds ?? []),
    [activeProject],
  );

  const projectItems = useMemo(
    () =>
      activeProject
        ? data.items.filter((item) => projectImageIdSet.has(item.id))
        : data.items,
    [activeProject, data.items, projectImageIdSet],
  );

  const projectCanvases = useMemo(
    () =>
      activeProject
        ? data.canvases.filter(
            (canvas) =>
              canvas.projectId === activeProject.id ||
              activeProject.boardIds.includes(canvas.id),
          )
        : data.canvases,
    [activeProject, data.canvases],
  );

  const sortedItems = useMemo(
    () =>
      [...projectItems].sort(
        (a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title),
      ),
    [projectItems],
  );

  const visibleArchiveItems = useMemo(
    () =>
      gridTagFilter === "all"
        ? sortedItems
        : sortedItems.filter((item) => item.tagIds.includes(gridTagFilter)),
    [gridTagFilter, sortedItems],
  );

  const archiveScale = archiveUiScale / 100;
  const archiveRouteStyle = useMemo(
    () =>
      ({
        "--archive-card-gap": `${Math.round(12 * archiveScale)}px`,
        "--archive-card-inner-gap": `${Math.round(8 * archiveScale)}px`,
        "--archive-card-padding": `${Math.round(10 * archiveScale)}px`,
        "--archive-board-dot-gap": `${Math.max(2, Math.round(3 * archiveScale))}px`,
        "--archive-board-dot-size": `${Math.max(3, Math.round(5 * archiveScale))}px`,
        "--archive-day-min-height": `${Math.round(132 * archiveScale)}px`,
        "--archive-grid-card-min": `${Math.round(148 * archiveScale)}px`,
        "--archive-grid-gap": `${Math.round(14 * archiveScale)}px`,
        "--archive-item-meta-size": `${(12 * archiveScale).toFixed(1)}px`,
        "--archive-item-tag-size": `${(11 * archiveScale).toFixed(1)}px`,
        "--archive-item-title-size": `${(12 * archiveScale).toFixed(1)}px`,
        "--archive-strip-card-max": `${Math.round(156 * archiveScale)}px`,
        "--archive-strip-card-min": `${Math.round(132 * archiveScale)}px`,
        "--archive-thumb-radius": `${Math.round(7 * archiveScale)}px`,
      }) as React.CSSProperties,
    [archiveScale],
  );

  const selectedItemSet = useMemo(
    () => new Set(selectedItemIds),
    [selectedItemIds],
  );

  const selectedItem = data.items.find((item) => item.id === detailItemId) ?? null;

  const clearSelection = useCallback(() => {
    setSelectedItemIds([]);
    setLastSelectedItemId(null);
    setSelectionBoardDialogOpen(false);
    setSelectionBoardTitleDraft("");
    setSelectionTagDialogOpen(false);
    setSelectionTagDraft("");
  }, []);

  const openProject = useCallback(
    (projectId: string) => {
      const project = dataRef.current.projects.find(
        (candidate) => candidate.id === projectId,
      );
      if (!project) return;

      setActiveProjectId(project.id);
      setActiveCanvasId(project.boardIds[0] ?? null);
      setArchiveMinimized(false);
      setCanvasMinimized(false);
      clearSelection();
    },
    [clearSelection],
  );

  const closeProject = useCallback(() => {
    setActiveProjectId(null);
    setActiveCanvasId(null);
    setDetailItemId(null);
    clearSelection();
  }, [clearSelection]);

  const createProjectFromHome = useCallback(
    async (title: string) => {
      setBusy(true);
      try {
        const nextData = await window.folio.createProject({ title });
        putData(nextData);
        setToast("Project created");
      } catch (error) {
        console.error(error);
        setToast("Project could not be created");
      } finally {
        setBusy(false);
      }
    },
    [putData],
  );

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
    setBusy(true);
    try {
      const imported = await chooseAndImportItems(activeProjectId);
      if (!imported.length) return;

      putData(
        mergeImportedItemsIntoProject(
          dataRef.current,
          imported,
          activeProjectId,
        ),
      );
      setToast(`${formatCount(imported.length, "item")} added to today`);
    } catch (error) {
      console.error(error);
      setToast(getImportFailureMessage(error, "Import failed"));
    } finally {
      setBusy(false);
    }
  }, [activeProjectId, putData]);

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

  const handlePaste = useCallback(
    async (event: ClipboardEvent) => {
      if (!activeProjectId || !event.clipboardData) return;

      const files = Array.from(event.clipboardData.files).filter((file) => {
        const filePath = window.folio.getPathForFile(file);
        return IMAGE_FILE_PATTERN.test(filePath || file.name) ||
          file.type.startsWith("image/");
      });
      if (!files.length) return;

      const filePaths: string[] = [];
      const sources: ImportSource[] = [];

      for (const file of files) {
        const filePath = window.folio.getPathForFile(file);
        if (filePath) {
          filePaths.push(filePath);
          continue;
        }

        if (file.type.startsWith("image/")) {
          sources.push({
            kind: "buffer",
            data: await file.arrayBuffer(),
            ext: clipboardImageExtension(file),
            filename: file.name || "pasted-image",
          });
        }
      }

      if (!filePaths.length && !sources.length) return;

      event.preventDefault();
      setBusy(true);
      try {
        const importedFromPaths = filePaths.length && window.folio.copyToProject
          ? await window.folio.copyToProject(activeProjectId, filePaths)
          : [];
        const importedFromSources =
          sources.length && window.folio.importSourcesToProject
            ? await window.folio.importSourcesToProject(activeProjectId, sources)
            : [];
        const imported = [...importedFromPaths, ...importedFromSources];

        if (!imported.length) {
          setToast("No new items added");
          return;
        }

        putData(
          mergeImportedItemsIntoProject(
            dataRef.current,
            imported,
            activeProjectId,
          ),
        );
        setToast(`${formatCount(imported.length, "item")} pasted`);
      } catch (error) {
        console.error(error);
        setToast(getImportFailureMessage(error, "Paste failed"));
      } finally {
        setBusy(false);
      }
    },
    [activeProjectId, putData],
  );

  useEffect(() => {
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

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

  const addTagToSelection = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      let taggedCount = 0;
      commitData((current) => {
        const selectedSet = new Set(selectedItemIds);
        const validSelectedIds = new Set(
          current.items
            .filter((item) => selectedSet.has(item.id))
            .map((item) => item.id),
        );
        taggedCount = validSelectedIds.size;
        if (!taggedCount) return current;

        const existingTag = current.tags.find(
          (tag) => tag.text.toLowerCase() === trimmed.toLowerCase(),
        );
        const tag = existingTag ?? { id: createId("tag"), text: trimmed };

        return {
          ...current,
          tags: existingTag ? current.tags : [...current.tags, tag],
          items: current.items.map((item) =>
            validSelectedIds.has(item.id)
              ? {
                  ...item,
                  tagIds: item.tagIds.includes(tag.id)
                    ? item.tagIds
                    : [...item.tagIds, tag.id],
                }
              : item,
          ),
        };
      }, `${formatCount(taggedCount || selectedItemIds.length, "item")} tagged`);

      if (taggedCount) {
        setSelectionTagDialogOpen(false);
        setSelectionTagDraft("");
      }
    },
    [commitData, selectedItemIds],
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
        const savedAt = new Date().toISOString();
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
              ? markCanvasSaved(addItemToCanvas(canvas, itemId), savedAt)
              : canvas,
          ),
        };
      }, createdCanvas ? "Board created" : "Added to board");

      if (targetCanvasId) {
        setActiveCanvasId(targetCanvasId);
        setCanvasMinimized(false);
        setCanvasDetailRequestId((current) => current + 1);
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
      setCanvasDetailRequestId((current) => current + 1);
    }
  }, [commitData]);

  const openSelectedOnNewCanvas = useCallback((title?: string) => {
    const itemIds = [...selectedItemIds];
    if (!itemIds.length) return;

    let boardId: string | null = null;
    commitData(
      (current) => {
        const savedAt = new Date().toISOString();
        const knownItemIds = new Set(current.items.map((item) => item.id));
        const validItemIds = itemIds.filter((itemId) => knownItemIds.has(itemId));
        if (!validItemIds.length) return current;

        const board = markCanvasSaved(
          addItemsToCanvas(
            createCanvas(current.canvases.length, title),
            validItemIds,
          ),
          savedAt,
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
      setCanvasDetailRequestId((current) => current + 1);
      clearSelection();
    } else {
      setToast("No selected items found");
    }
  }, [clearSelection, commitData, selectedItemIds]);

  const deleteSelectedItems = useCallback(async () => {
    const itemIds = [...selectedItemIds];
    const currentItemIds = new Set(dataRef.current.items.map((item) => item.id));
    const validItemIds = itemIds.filter((itemId) => currentItemIds.has(itemId));
    if (!validItemIds.length) return;

    const confirmed = window.confirm(
      `Delete ${formatCount(validItemIds.length, "selected item")}?`,
    );
    if (!confirmed) return;

    setBusy(true);
    try {
      const nextData = await window.folio.deleteItems(validItemIds);
      putData(nextData);
      setDetailItemId(null);
      clearSelection();
      setThumbUrls((current) => {
        const next = { ...current };
        validItemIds.forEach((itemId) => {
          delete next[itemId];
        });
        return next;
      });
      setToast(`${formatCount(validItemIds.length, "item")} moved to Trash`);
    } catch (error) {
      console.error(error);
      setToast("Delete failed");
    } finally {
      setBusy(false);
    }
  }, [clearSelection, putData, selectedItemIds]);

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

  const panelMode: WorkspacePanelMode = archiveMinimized
    ? "right"
    : canvasMinimized
    ? "left"
    : "split";
  const dividerHidden = archiveMinimized || canvasMinimized;
  const studioGridTemplateColumns = archiveMinimized
    ? `0px 0px minmax(${CANVAS_DOCK_MIN_WIDTH}px, 1fr)`
    : canvasMinimized
    ? `minmax(${ARCHIVE_PANEL_MIN_WIDTH}px, 1fr) 0px 0px`
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

      {activeProject ? (
      <main className="app-main">
        <div className="workspace-panel-mode-bar">
          <button
            className="secondary-action project-back-button"
            type="button"
            onClick={closeProject}
          >
            <ButtonIcon icon={ArrowLeft} />
            Projects
          </button>
          <strong className="active-project-title">{activeProject.title}</strong>
          <span className="active-project-surface">All Images</span>
          <div
            className="view-tabs workspace-panel-mode-control"
            aria-label="Workspace panel view"
          >
            <button
              className={panelMode === "left" ? "active" : ""}
              type="button"
              aria-label="Left only panel view"
              aria-pressed={panelMode === "left"}
              title="Left only"
              onClick={showLeftOnlyPanel}
            >
              <ButtonIcon icon={PanelLeft} size={16} />
            </button>
            <button
              className={panelMode === "split" ? "active" : ""}
              type="button"
              aria-label="Split panel view"
              aria-pressed={panelMode === "split"}
              title="Split"
              onClick={showSplitPanel}
            >
              <ButtonIcon icon={Columns2} size={16} />
            </button>
            <button
              className={panelMode === "right" ? "active" : ""}
              type="button"
              aria-label="Right only panel view"
              aria-pressed={panelMode === "right"}
              title="Right only"
              onClick={showRightOnlyPanel}
            >
              <ButtonIcon icon={PanelRight} size={16} />
            </button>
          </div>
        </div>
        <section
          ref={studioWorkspaceRef}
          className={`studio-workspace ${
            canvasMinimized ? "studio-workspace-canvas-minimized" : ""
          } ${
            archiveMinimized ? "studio-workspace-archive-minimized" : ""
          } ${
            canvasDockResizing || tagsSidebarResizing
              ? "studio-workspace-resizing"
              : ""
          }`}
          style={{ gridTemplateColumns: studioGridTemplateColumns }}
        >
          <section
            className={`archive-panel ${
              archiveMinimized ? "archive-panel-minimized" : ""
            }`}
          >
            {archiveMinimized ? (
              <div className="archive-rail" aria-hidden="true" />
            ) : (
              <>
                <ArchiveWorkspace
                  sidebarCollapsed={tagsCollapsed}
                  sidebarWidth={tagsSidebarWidth}
                  onStartSidebarResize={startTagsSidebarResize}
                  routeStyle={archiveRouteStyle}
                  sidebar={
                    <TagsSidebar
                      items={sortedItems}
                      tags={data.tags}
                      canvases={projectCanvases}
                      thumbUrls={thumbUrls}
                      setThumbUrls={setThumbUrls}
                      onOpenItem={openItemDetails}
                      collapsed={tagsCollapsed}
                      onToggleCollapsed={() =>
                        setTagsCollapsed((current) => !current)
                      }
                      tagFilter={gridTagFilter}
                      setTagFilter={setGridTagFilter}
                    />
                  }
                >
                  <SelectionBar
                    count={selectedItemIds.length}
                    newBoardDialogOpen={selectionBoardDialogOpen}
                    newBoardTitle={selectionBoardTitleDraft}
                    tagDialogOpen={selectionTagDialogOpen}
                    tagDraft={selectionTagDraft}
                    onCancelNewBoard={() => {
                      setSelectionBoardDialogOpen(false);
                      setSelectionBoardTitleDraft("");
                    }}
                    onCancelTag={() => {
                      setSelectionTagDialogOpen(false);
                      setSelectionTagDraft("");
                    }}
                    onApplyTag={() => addTagToSelection(selectionTagDraft)}
                    onClear={clearSelection}
                    onCreateNewBoard={() =>
                      openSelectedOnNewCanvas(selectionBoardTitleDraft)
                    }
                    onDeleteSelection={deleteSelectedItems}
                    onNewBoardTitleChange={setSelectionBoardTitleDraft}
                    onOpenNewBoard={() => {
                      setSelectionBoardTitleDraft("");
                      setSelectionTagDialogOpen(false);
                      setSelectionTagDraft("");
                      setSelectionBoardDialogOpen(true);
                    }}
                    onOpenTag={() => {
                      setSelectionTagDraft("");
                      setSelectionBoardDialogOpen(false);
                      setSelectionBoardTitleDraft("");
                      setSelectionTagDialogOpen(true);
                    }}
                    onTagDraftChange={setSelectionTagDraft}
                  />
                  <div className="archive-floating-actions">
                    <label className="archive-scale-control">
                      <span>Size</span>
                      <input
                        type="range"
                        min={ARCHIVE_UI_SCALE_MIN}
                        max={ARCHIVE_UI_SCALE_MAX}
                        step={ARCHIVE_UI_SCALE_STEP}
                        value={archiveUiScale}
                        aria-label="Archive item size"
                        aria-valuetext={`${archiveUiScale}%`}
                        onChange={(event) =>
                          setArchiveUiScale(Number(event.currentTarget.value))
                        }
                      />
                      <output>{archiveUiScale}%</output>
                    </label>
                    <div className="view-tabs archive-view-toggle" aria-label="Archive view">
                      <button
                        className={archiveView === "strip" ? "active" : ""}
                        type="button"
                        aria-label="Strip view"
                        title="Strip view"
                        onClick={() => setArchiveView("strip")}
                      >
                        <ButtonIcon icon={Rows3} />
                      </button>
                      <button
                        className={archiveView === "grid" ? "active" : ""}
                        type="button"
                        aria-label="Grid view"
                        title="Grid view"
                        onClick={() => setArchiveView("grid")}
                      >
                        <ButtonIcon icon={Grid3X3} />
                      </button>
                    </div>
                    <button
                      className="primary-action"
                      type="button"
                      onClick={handleOpenDialog}
                    >
                      <ButtonIcon icon={Upload} />
                      {busy ? "Importing" : "Import"}
                    </button>
                  </div>
                  {archiveView === "strip" ? (
                    <DailyStripView
                      items={visibleArchiveItems}
                      tags={data.tags}
                      canvases={projectCanvases}
                      thumbUrls={thumbUrls}
                      setThumbUrls={setThumbUrls}
                      selectedItemIds={selectedItemIds}
                      showDateGaps={gridTagFilter === "all"}
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
                      canvases={projectCanvases}
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

                <footer
                  className={`archive-heatmap-footer ${
                    heatmapMinimized ? "archive-heatmap-footer-minimized" : ""
                  }`}
                >
                  <ArchiveHeatmap
                    items={visibleArchiveItems}
                    minimized={heatmapMinimized}
                  />
                  <button
                    className="icon-button archive-heatmap-toggle"
                    type="button"
                    aria-label={
                      heatmapMinimized ? "Show heatmap" : "Minimize heatmap"
                    }
                    title={heatmapMinimized ? "Show heatmap" : "Minimize heatmap"}
                    onClick={() => setHeatmapMinimized((current) => !current)}
                  >
                    <ButtonIcon icon={heatmapMinimized ? ChevronUp : ChevronDown} />
                  </button>
                </footer>
              </>
            )}
          </section>

          <div
            className={`canvas-resize-handle ${
              dividerHidden ? "canvas-resize-handle-hidden" : ""
            }`}
            role="separator"
            aria-label="Resize open board panel"
            aria-orientation="vertical"
            aria-hidden={dividerHidden}
            tabIndex={dividerHidden ? -1 : 0}
            onKeyDown={(event) => {
              if (dividerHidden) return;
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
              if (dividerHidden) return;
              startCanvasDockResize(event);
            }}
          />

          <aside
            className={`canvas-dock ${canvasMinimized ? "canvas-dock-minimized" : ""}`}
          >
            {canvasMinimized ? (
              <div className="canvas-dock-collapsed" aria-hidden="true" />
            ) : (
              <CanvasView
                data={data}
                activeCanvasId={activeCanvasId}
                activeProjectId={activeProjectId}
                canvasDetailRequestId={canvasDetailRequestId}
                setActiveCanvasId={setActiveCanvasId}
                onOpenItem={openItemDetails}
                onCreateBoard={createBoard}
                onMinimize={showLeftOnlyPanel}
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
      ) : (
        <ProjectsView
          data={data}
          busy={busy}
          onCreateProject={createProjectFromHome}
          onOpenProject={openProject}
        />
      )}

      <StatusBar
        itemCount={activeProject ? activeProject.imageIds.length : data.items.length}
        canvasCount={activeProject ? projectCanvases.length : data.canvases.length}
        tagCount={data.tags.length}
        gapCount={getGaps(projectItems)}
      />

      <DetailDrawer
        item={selectedItem}
        tags={data.tags}
        canvases={projectCanvases}
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
