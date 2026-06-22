import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  Archive,
  Brush,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  Grid3X3,
  Images,
  NotebookPen,
  PanelsTopLeft,
  Rows3,
  Upload,
} from "lucide-react";
import type {
  Canvas,
  FolioData,
  ImportSource,
  ReconciliationResult,
  ThumbnailUrls,
} from "../types";
import { ArchiveWorkspace } from "./archive/ArchiveWorkspace";
import { DailyStripView } from "./archive/DailyStripView";
import { GridView } from "./archive/GridView";
import { ArchiveHeatmap } from "./archive/HeatmapView";
import { TagsSidebar } from "./archive/TagsSidebar";
import { useItemTags } from "./archive/useItemTags";
import { CanvasView } from "./canvas/CanvasView";
import {
  createCanvasFromTemplate,
  type CanvasTemplateId,
} from "./canvas/canvasTemplates";
import { DetailDrawer } from "./details/DetailDrawer";
import {
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
  clipboardImageExtension,
  getImportFailureMessage,
} from "./folio/importing";
import {
  addItemToCanvas,
  addItemsToCanvas,
  assignBoardToProject,
  createCanvas,
  createId,
  formatCount,
  itemDisplayTitle,
  markCanvasSaved,
  mergeImportedItemsIntoProject,
  mergeItems,
  normalizeFolioData,
} from "./folio/model";
import { ReconciliationNotice } from "./layout/ReconciliationNotice";
import { SelectionBar } from "./layout/SelectionBar";
import { ProjectReviewEditorPage } from "./projects/ProjectReviewEditorPage";
import { ProjectReviewView } from "./projects/ProjectReviewView";
import { ProjectsView } from "./projects/ProjectsView";
import { useProjectReviews } from "./projects/useProjectReviews";
import { ButtonIcon } from "./shared/ButtonIcon";
import { useTagsSidebarResize } from "./useTagsSidebarResize";

const ARCHIVE_UI_SCALE_MIN = 50;
const ARCHIVE_UI_SCALE_MAX = 200;
const ARCHIVE_UI_SCALE_STEP = 5;
type ProjectSurface = "images" | "works" | "boards" | "review";

const VIEW_STATE_STORAGE_KEY = "folio:view-state";

type PersistedViewState = {
  archiveView: ArchiveViewMode;
  activeProjectId: string | null;
  projectSurface: ProjectSurface;
  activeReviewId: string | null;
  activeCanvasId: string | null;
  boardBrowserOpen: boolean;
};

function readPersistedViewState(): Partial<PersistedViewState> {
  try {
    const raw = sessionStorage.getItem(VIEW_STATE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<PersistedViewState>) : {};
  } catch {
    return {};
  }
}

export function AppShell() {
  const persistedViewRef = useRef<Partial<PersistedViewState> | null>(null);
  if (persistedViewRef.current === null) {
    persistedViewRef.current = readPersistedViewState();
  }
  const persistedView = persistedViewRef.current;

  const [data, setData] = useState<FolioData>(EMPTY_DATA);
  const dataRef = useRef<FolioData>(EMPTY_DATA);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [archiveView, setArchiveView] = useState<ArchiveViewMode>(
    persistedView.archiveView ?? "strip",
  );
  const [archiveUiScale, setArchiveUiScale] = useState(100);
  const [heatmapMinimized, setHeatmapMinimized] = useState(false);
  const [tagsCollapsed, setTagsCollapsed] = useState(true);
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
  const [activeProjectId, setActiveProjectId] = useState<string | null>(
    persistedView.activeProjectId ?? null,
  );
  const [projectSurface, setProjectSurface] = useState<ProjectSurface>(
    persistedView.projectSurface ?? "images",
  );
  const [activeReviewId, setActiveReviewId] = useState<string | null>(
    persistedView.activeReviewId ?? null,
  );
  const [activeCanvasId, setActiveCanvasId] = useState<string | null>(
    persistedView.activeCanvasId ?? null,
  );
  const [canvasBrowserOpen, setCanvasBrowserOpen] = useState<boolean>(
    persistedView.boardBrowserOpen ?? true,
  );
  // Restore the board-vs-canvas view only on the first board mount after a page
  // load. In-session navigation between surfaces keeps the existing behavior.
  const restoredBoardBrowserOpenRef = useRef<boolean | null>(
    persistedView.projectSurface === "boards" &&
      typeof persistedView.boardBrowserOpen === "boolean"
      ? persistedView.boardBrowserOpen
      : null,
  );
  const handleCanvasBrowserOpenChange = useCallback((open: boolean) => {
    restoredBoardBrowserOpenRef.current = null;
    setCanvasBrowserOpen(open);
  }, []);
  const [canvasDetailRequestId, setCanvasDetailRequestId] = useState(0);
  const [reconciliation, setReconciliation] =
    useState<ReconciliationResult | null>(null);
  const [reconciliationDismissed, setReconciliationDismissed] = useState(false);
  const dragDepth = useRef(0);

  const {
    workspaceRef: studioWorkspaceRef,
    width: tagsSidebarWidth,
    resizing: tagsSidebarResizing,
    startResize: startTagsSidebarResize,
  } = useTagsSidebarResize(tagsCollapsed);

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

        // Drop any restored view that points at data which no longer exists.
        const restored = persistedViewRef.current ?? {};
        if (restored.activeProjectId) {
          const project = (folioData.projects ?? []).find(
            (candidate) => candidate.id === restored.activeProjectId,
          );
          if (!project) {
            setActiveProjectId(null);
            setProjectSurface("images");
            setActiveReviewId(null);
            setActiveCanvasId(null);
            restoredBoardBrowserOpenRef.current = null;
          } else {
            if (
              restored.activeReviewId &&
              !project.reviews.some(
                (review) => review.id === restored.activeReviewId,
              )
            ) {
              setActiveReviewId(null);
            }
            if (
              restored.activeCanvasId &&
              !(folioData.canvases ?? []).some(
                (canvas) =>
                  canvas.id === restored.activeCanvasId &&
                  (canvas.projectId === project.id ||
                    project.boardIds.includes(canvas.id)),
              )
            ) {
              setActiveCanvasId(null);
              setCanvasBrowserOpen(true);
              restoredBoardBrowserOpenRef.current = null;
            }
          }
        }
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
    const snapshot: PersistedViewState = {
      archiveView,
      activeProjectId,
      projectSurface,
      activeReviewId,
      activeCanvasId,
      boardBrowserOpen: canvasBrowserOpen,
    };
    try {
      sessionStorage.setItem(VIEW_STATE_STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // Ignore storage write failures (e.g. quota or restricted mode).
    }
  }, [
    archiveView,
    activeProjectId,
    projectSurface,
    activeReviewId,
    activeCanvasId,
    canvasBrowserOpen,
  ]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const activeProject = useMemo(
    () =>
      (data.projects ?? []).find((project) => project.id === activeProjectId) ??
      null,
    [activeProjectId, data.projects],
  );

  const activeReview = useMemo(
    () =>
      activeProject?.reviews.find((review) => review.id === activeReviewId) ??
      null,
    [activeProject, activeReviewId],
  );

  const projectImageIdSet = useMemo(
    () => new Set(activeProject?.imageIds ?? []),
    [activeProject],
  );

  const projectWorkItemIdSet = useMemo(
    () => new Set(activeProject?.workItemIds ?? []),
    [activeProject],
  );

  const projectSurfaceItemIdSet = useMemo(
    () =>
      projectSurface === "works"
        ? projectWorkItemIdSet
        : projectImageIdSet,
    [projectImageIdSet, projectSurface, projectWorkItemIdSet],
  );

  const projectItems = useMemo(
    () =>
      activeProject
        ? data.items.filter((item) => projectSurfaceItemIdSet.has(item.id))
        : data.items,
    [activeProject, data.items, projectSurfaceItemIdSet],
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

  const projectWorkHeatmapItems = useMemo(
    () =>
      activeProject
        ? data.items.filter((item) => projectWorkItemIdSet.has(item.id))
        : [],
    [activeProject, data.items, projectWorkItemIdSet],
  );

  const visibleWorkHeatmapItems = useMemo(
    () =>
      gridTagFilter === "all"
        ? projectWorkHeatmapItems
        : projectWorkHeatmapItems.filter((item) =>
            item.tagIds.includes(gridTagFilter),
          ),
    [gridTagFilter, projectWorkHeatmapItems],
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
      setProjectSurface("images");
      setActiveReviewId(null);
      setActiveCanvasId(project.boardIds[0] ?? null);
      clearSelection();
    },
    [clearSelection],
  );

  const closeProject = useCallback(() => {
    setActiveProjectId(null);
    setProjectSurface("images");
    setActiveReviewId(null);
    setActiveCanvasId(null);
    setDetailItemId(null);
    clearSelection();
  }, [clearSelection]);

  const openFolioPath = useCallback((relativePath: string) => {
    void window.folio.openInFinder(relativePath).catch((error) => {
      console.error(error);
      setToast("Folder could not be opened");
    });
  }, []);

  const { createProjectReview, updateProjectReview, deleteProjectReview } =
    useProjectReviews({
      activeProject,
      commitData,
      activeReviewId,
      setActiveReviewId,
    });

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

  const setSelectionWorksMembership = useCallback(async () => {
    if (!activeProject || !selectedItemIds.length) return;
    const selectedProjectImageIds = selectedItemIds.filter((itemId) =>
      activeProject.imageIds.includes(itemId),
    );
    if (!selectedProjectImageIds.length) return;

    const selectedSet = new Set(selectedProjectImageIds);
    const nextWorkItemIds =
      projectSurface === "works"
        ? activeProject.workItemIds.filter((itemId) => !selectedSet.has(itemId))
        : Array.from(
            new Set([...activeProject.workItemIds, ...selectedProjectImageIds]),
          );

    setBusy(true);
    try {
      const nextData = await window.folio.setProjectWorkItems(
        activeProject.id,
        nextWorkItemIds,
      );
      putData(nextData);
      clearSelection();
      setToast(
        projectSurface === "works"
          ? `${formatCount(selectedProjectImageIds.length, "item")} unmarked`
          : `${formatCount(selectedProjectImageIds.length, "item")} marked as Works`,
      );
    } catch (error) {
      console.error(error);
      setToast("Works could not be updated");
    } finally {
      setBusy(false);
    }
  }, [activeProject, clearSelection, projectSurface, putData, selectedItemIds]);

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

  const { patchItem, addTagToItem, addTagToSelection, removeTagFromItem } =
    useItemTags({
      commitData,
      selectedItemIds,
      onSelectionTagged: useCallback(() => {
        setSelectionTagDialogOpen(false);
        setSelectionTagDraft("");
      }, []),
    });

  const addItemToActiveCanvas = useCallback(
    (itemId: string) => {
      let targetCanvasId = activeCanvasId;
      let createdCanvas: Canvas | null = null;

      commitData((current) => {
        const savedAt = new Date().toISOString();
        let canvases = [...current.canvases];
        const targetCanvas = targetCanvasId
          ? canvases.find((canvas) => canvas.id === targetCanvasId)
          : null;
        const activeProject = activeProjectId
          ? current.projects.find((project) => project.id === activeProjectId)
          : null;
        const targetBelongsToActiveProject =
          !activeProjectId ||
          targetCanvas?.projectId === activeProjectId ||
          Boolean(activeProject?.boardIds.includes(targetCanvasId ?? ""));

        if (!targetCanvas || !targetBelongsToActiveProject) {
          createdCanvas = {
            ...createCanvas(canvases.length),
            projectId: activeProjectId ?? undefined,
          };
          targetCanvasId = createdCanvas.id;
          canvases = [createdCanvas, ...canvases];
        }

        return {
          ...current,
          projects: createdCanvas
            ? assignBoardToProject(
                current.projects,
                activeProjectId,
                createdCanvas.id,
                savedAt,
              )
            : current.projects,
          canvases: canvases.map((canvas) =>
            canvas.id === targetCanvasId
              ? markCanvasSaved(addItemToCanvas(canvas, itemId), savedAt)
              : canvas,
          ),
        };
      }, createdCanvas ? "Board created" : "Added to board");

      if (targetCanvasId) {
        setActiveCanvasId(targetCanvasId);
        setProjectSurface("boards");
        setCanvasDetailRequestId((current) => current + 1);
      }
    },
    [activeCanvasId, activeProjectId, commitData],
  );

  const createBoard = useCallback((templateId: CanvasTemplateId = "blank") => {
    let boardId: string | null = null;

    commitData(
      (current) => {
        const savedAt = new Date().toISOString();
        const board = markCanvasSaved(
          createCanvasFromTemplate({
            index: current.canvases.length,
            projectId: activeProjectId ?? undefined,
            templateId,
            createId,
          }),
          savedAt,
        );
        boardId = board.id;
        return {
          ...current,
          projects: assignBoardToProject(
            current.projects,
            activeProjectId,
            board.id,
            savedAt,
          ),
          canvases: [board, ...current.canvases],
        };
      },
      "Board created",
    );

    if (boardId) {
      setActiveCanvasId(boardId);
      setProjectSurface("boards");
      setCanvasDetailRequestId((current) => current + 1);
    }
  }, [activeProjectId, commitData]);

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
            {
              ...createCanvas(current.canvases.length, title),
              projectId: activeProjectId ?? undefined,
            },
            validItemIds,
          ),
          savedAt,
        );
        boardId = board.id;

        return {
          ...current,
          projects: assignBoardToProject(
            current.projects,
            activeProjectId,
            board.id,
            savedAt,
          ),
          canvases: [board, ...current.canvases],
        };
      },
      "Selection opened on new board",
    );

    if (boardId) {
      setActiveCanvasId(boardId);
      setProjectSurface("boards");
      setCanvasDetailRequestId((current) => current + 1);
      clearSelection();
    } else {
      setToast("No selected items found");
    }
  }, [activeProjectId, clearSelection, commitData, selectedItemIds]);

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

      const confirmed = window.confirm(`Delete "${itemDisplayTitle(item)}"?`);
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

      {activeProject && activeReview ? (
        <ProjectReviewEditorPage
          project={activeProject}
          review={activeReview}
          items={data.items}
          thumbUrls={thumbUrls}
          setThumbUrls={setThumbUrls}
          onBackToProjectReview={() => {
            setActiveReviewId(null);
            setProjectSurface("review");
          }}
          onUpdateReview={updateProjectReview}
          onDeleteReview={deleteProjectReview}
        />
      ) : activeProject ? (
      <main className="app-main">
        <div className="workspace-panel-mode-bar" aria-hidden="true" />
        <div className="project-workspace-shell">
          <aside className="project-action-sidebar" aria-label="Project action bar">
            <div className="project-action-sidebar-header">
              <button
                className="secondary-action project-sidebar-back-button"
                type="button"
                onClick={closeProject}
              >
                <ButtonIcon icon={ArrowLeft} />
                Projects
              </button>
              <strong className="project-sidebar-title">{activeProject.title}</strong>
            </div>

            <section
              className="project-action-group project-library-group"
              aria-labelledby="project-library-heading"
            >
              <div
                className="project-sidebar-section-heading"
                id="project-library-heading"
              >
                <ButtonIcon icon={Images} size={14} />
                <span>Library</span>
              </div>
              <nav className="project-surface-tabs" aria-label="Project library">
                <button
                  className={projectSurface === "images" ? "active" : ""}
                  type="button"
                  aria-pressed={projectSurface === "images"}
                  onClick={() => {
                    setProjectSurface("images");
                    clearSelection();
                  }}
                >
                  <ButtonIcon icon={Images} size={15} />
                  <span>All Images</span>
                </button>
              </nav>
            </section>

            <section
              className="project-action-group project-views-group"
              aria-labelledby="project-views-heading"
            >
              <div className="project-sidebar-section-heading" id="project-views-heading">
                <ButtonIcon icon={Archive} size={14} />
                <span>Views</span>
              </div>
              <nav className="project-surface-tabs" aria-label="Project views">
                <button
                  className={projectSurface === "works" ? "active" : ""}
                  type="button"
                  aria-pressed={projectSurface === "works"}
                  onClick={() => {
                    setProjectSurface("works");
                    clearSelection();
                  }}
                >
                  <ButtonIcon icon={Brush} size={15} />
                  <span>Works</span>
                </button>
                <button
                  className={projectSurface === "boards" ? "active" : ""}
                  type="button"
                  aria-pressed={projectSurface === "boards"}
                  onClick={() => {
                    setProjectSurface("boards");
                    setActiveReviewId(null);
                    clearSelection();
                  }}
                >
                  <ButtonIcon icon={PanelsTopLeft} size={15} />
                  <span>Boards</span>
                </button>
                <button
                  className={projectSurface === "review" ? "active" : ""}
                  type="button"
                  aria-pressed={projectSurface === "review"}
                  onClick={() => {
                    setProjectSurface("review");
                    clearSelection();
                  }}
                >
                  <ButtonIcon icon={NotebookPen} size={15} />
                  <span>Review</span>
                </button>
              </nav>
            </section>

            <section
              className="project-action-group project-folder-group"
              aria-labelledby="project-folder-heading"
            >
              <div
                className="project-sidebar-section-heading"
                id="project-folder-heading"
              >
                <ButtonIcon icon={FolderOpen} size={14} />
                <span>Project</span>
              </div>
              <div className="project-folder-actions" aria-label="Project folders">
                <button
                  className="icon-button"
                  type="button"
                  aria-label="Open project folder"
                  title="Open project folder"
                  onClick={() => openFolioPath(activeProject.folderPath)}
                >
                  <ButtonIcon icon={FolderOpen} />
                </button>
              </div>
            </section>
          </aside>

          <section
            ref={studioWorkspaceRef}
            className={`studio-workspace ${
              tagsSidebarResizing ? "studio-workspace-resizing" : ""
            }`}
          >
            {projectSurface === "boards" ? (
              <CanvasView
                data={data}
                activeCanvasId={activeCanvasId}
                activeProjectId={activeProjectId}
                canvasDetailRequestId={canvasDetailRequestId}
                initialBoardBrowserOpen={restoredBoardBrowserOpenRef.current}
                onBoardBrowserOpenChange={handleCanvasBrowserOpenChange}
                setActiveCanvasId={setActiveCanvasId}
                onOpenItem={openItemDetails}
                onCreateBoard={createBoard}
                thumbUrls={thumbUrls}
                setThumbUrls={setThumbUrls}
                commitData={commitData}
                saveData={saveData}
                clearDragState={() => {
                  dragDepth.current = 0;
                  setDragging(false);
                }}
              />
            ) : (
              <section className="archive-panel">
                {projectSurface === "review" && activeProject ? (
                  <ProjectReviewView
                    project={activeProject}
                    items={data.items}
                    canvases={projectCanvases}
                    thumbUrls={thumbUrls}
                    setThumbUrls={setThumbUrls}
                    onCreateReview={createProjectReview}
                    onOpenItem={openItemDetails}
                    onOpenReview={setActiveReviewId}
                  />
                ) : (
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
                      workActionLabel={
                        activeProject
                          ? projectSurface === "works"
                            ? "Unmark Work"
                            : "Mark Work"
                          : undefined
                      }
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
                      onToggleWorks={
                        activeProject ? setSelectionWorksMembership : undefined
                      }
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
                      <div
                        className="view-tabs archive-view-toggle"
                        aria-label="Archive view"
                      >
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
                        workItemIds={
                          projectSurface === "images"
                            ? activeProject?.workItemIds ?? []
                            : []
                        }
                        onBackgroundClick={clearSelection}
                        onDragStart={startArchiveItemDrag}
                        onItemOpen={handleItemOpen}
                        onEditItem={(itemId) => openItemDetails(itemId, "details")}
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
                        workItemIds={
                          projectSurface === "images"
                            ? activeProject?.workItemIds ?? []
                            : []
                        }
                        onBackgroundClick={clearSelection}
                        onDragStart={startArchiveItemDrag}
                        onItemOpen={handleItemOpen}
                        onEditItem={(itemId) => openItemDetails(itemId, "details")}
                      />
                    )}
                  </ArchiveWorkspace>
                )}

                {projectSurface === "works" ? (
                  <footer
                    className={`archive-heatmap-footer ${
                      heatmapMinimized ? "archive-heatmap-footer-minimized" : ""
                    }`}
                  >
                    <ArchiveHeatmap
                      items={visibleWorkHeatmapItems}
                      minimized={heatmapMinimized}
                      ariaLabel="Project Works heatmap"
                      unitLabel="work"
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
                ) : null}
              </section>
            )}
          </section>
        </div>
      </main>
      ) : (
        <ProjectsView
          data={data}
          busy={busy}
          thumbUrls={thumbUrls}
          setThumbUrls={setThumbUrls}
          onCreateProject={createProjectFromHome}
          onOpenProject={openProject}
          onToast={setToast}
        />
      )}

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
