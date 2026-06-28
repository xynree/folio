import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Canvas,
  CanvasLink,
  CanvasNote,
  CanvasObjectGeometry,
  CanvasPosition,
  CanvasSection,
  CanvasTextElement,
  FolioData,
  FolioItem,
  Note,
  ThumbnailUrls,
} from "../../types";
import {
  CANVAS_COLORS,
  CANVAS_MAX_ZOOM,
  CANVAS_MIN_ZOOM,
  CANVAS_WORLD_ORIGIN,
  ITEM_DRAG_MIME,
} from "../folio/constants";
import type { DataUpdater, ItemDetailsOpenHandler } from "../folio/types";
import {
  addItemToCanvas,
  addItemsToCanvas,
  clampNumber,
  createId,
  formatCount,
  itemDisplayTitle,
  markCanvasSaved,
  mergeImportedItemsIntoProject,
  mergeItems,
} from "../folio/model";
import { chooseAndImportItems } from "../folio/importing";
import { BoardBrowser } from "./BoardBrowser";
import { CanvasBoardHeader } from "./CanvasBoardHeader";
import { CanvasEdgeLabels } from "./CanvasEdgeLabels";
import { CanvasInkLayer } from "./CanvasInkLayer";
import { CanvasMinimap } from "./CanvasMinimap";
import { CanvasObjectLayer } from "./CanvasObjectLayer";
import { CanvasSelectionBar } from "./CanvasSelectionBar";
import { CanvasToolCursor } from "./CanvasToolCursor";
import { CanvasLinkPrompt } from "./CanvasLinkPrompt";
import {
  canvasObjectBounds,
  type ArrangeableCanvasObject,
} from "./canvasArrangement";
import { edgeRenderModelsFromLayouts } from "./canvasGeometry";
import {
  boardPreviewItemIds as collectBoardPreviewItemIds,
  buildCanvasObjectLayouts,
  canvasKindForItem,
  itemsByIdFromItems,
  itemsForCanvas,
  positionForCanvasItem,
  positionForCanvasLink,
  positionForCanvasNote,
  positionForCanvasProjectNote,
  positionForCanvasSection,
  positionForCanvasText,
  projectNotesForCanvas,
} from "./canvasLayout";
import type { CanvasDragPreview } from "./canvasLayout";
import {
  addCanvasLink,
  addCanvasTextElement,
  deleteCanvasObjects,
  duplicateCanvasObjects,
  removeItemFromCanvas,
  updateCanvasLink,
  updateCanvasViewport,
} from "./canvasModel";
import { canvasObjectViews } from "./canvasObjects";
import { createCanvasLinkFromUrl, normalizeCanvasLinkUrl } from "./canvasLinks";
import type { CanvasTemplateId } from "./canvasTemplates";
import { CanvasViewport } from "./CanvasViewport";
import { LazyThumbnail } from "../shared/LazyThumbnail";
import {
  canvasObjectSelectionKey,
  normalizedSelectionRectangle,
  selectCanvasObjectsInRectangle,
  selectionSetFromObjects,
  toggleCanvasObjectSelection,
} from "./canvasSelection";
import type {
  CanvasObjectSelection,
  CanvasSelectionRectangle,
} from "./canvasSelection";
import { useCanvasDrawingTools } from "./useCanvasDrawingTools";
import { useCanvasEdges } from "./useCanvasEdges";
import { useCanvasObjectDrag } from "./useCanvasObjectDrag";
import { useCanvasObjectResize } from "./useCanvasObjectResize";
import { useCanvasObjectMutations } from "./useCanvasObjectMutations";
import { useCanvasKeyboardShortcuts } from "./useCanvasKeyboardShortcuts";

const BOARD_BROWSER_PREVIEW_LIMIT = 3;

export function CanvasView({
  data,
  activeCanvasId,
  activeProjectId,
  canvasDetailRequestId,
  initialBoardBrowserOpen,
  onBoardBrowserOpenChange,
  setActiveCanvasId,
  onOpenItem,
  onOpenNote,
  onCreateBoard,
  thumbUrls,
  setThumbUrls,
  commitData,
  saveData,
  clearDragState,
}: {
  data: FolioData;
  activeCanvasId: string | null;
  activeProjectId?: string | null;
  canvasDetailRequestId: number;
  initialBoardBrowserOpen?: boolean | null;
  onBoardBrowserOpenChange?: (open: boolean) => void;
  setActiveCanvasId: React.Dispatch<React.SetStateAction<string | null>>;
  onOpenItem: ItemDetailsOpenHandler;
  onOpenNote?: (noteId: string) => void;
  onCreateBoard: (templateId?: CanvasTemplateId) => void;
  thumbUrls: ThumbnailUrls;
  setThumbUrls: React.Dispatch<React.SetStateAction<ThumbnailUrls>>;
  commitData: (updater: DataUpdater, message?: string) => void;
  saveData: (data: FolioData, message?: string) => void;
  clearDragState: () => void;
}) {
  const activeProject = useMemo(
    () =>
      activeProjectId
        ? data.projects.find((project) => project.id === activeProjectId) ?? null
        : null,
    [activeProjectId, data.projects],
  );
  const projectBoardIdSet = useMemo(
    () => new Set(activeProject?.boardIds ?? []),
    [activeProject],
  );
  const projectImageIdSet = useMemo(
    () => new Set(activeProject?.imageIds ?? []),
    [activeProject],
  );
  const scopedCanvases = useMemo(
    () =>
      activeProject
        ? data.canvases.filter(
            (canvas) =>
              canvas.projectId === activeProject.id || projectBoardIdSet.has(canvas.id),
          )
        : data.canvases,
    [activeProject, data.canvases, projectBoardIdSet],
  );
  const activeCanvas =
    scopedCanvases.find((canvas) => canvas.id === activeCanvasId) ??
    scopedCanvases[0] ??
    null;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const [dragPreview, setDragPreview] = useState<CanvasDragPreview | null>(null);
  const [boardToolsOpen, setBoardToolsOpen] = useState(false);
  const [projectImagePickerOpen, setProjectImagePickerOpen] = useState(false);
  const [projectImageColumns, setProjectImageColumns] = useState(2);
  const [linkPromptOpen, setLinkPromptOpen] = useState(false);
  const [boardBrowserOpen, setBoardBrowserOpen] = useState(() =>
    typeof initialBoardBrowserOpen === "boolean"
      ? initialBoardBrowserOpen
      : canvasDetailRequestId === 0,
  );
  const [boardMenuCanvasId, setBoardMenuCanvasId] = useState<string | null>(null);
  const [browserEditCanvasId, setBrowserEditCanvasId] = useState<string | null>(
    null,
  );
  const [boardDropCanvasId, setBoardDropCanvasId] = useState<string | null>(null);
  const [boardTitleDraft, setBoardTitleDraft] = useState("");
  const [boardColorDraft, setBoardColorDraft] = useState(CANVAS_COLORS[0]);
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [boardSearchQuery, setBoardSearchQuery] = useState("");
  const [selectedObjects, setSelectedObjects] = useState<CanvasObjectSelection[]>([]);
  const [selectionMarquee, setSelectionMarquee] =
    useState<CanvasSelectionRectangle | null>(null);
  const canvasZoomRef = useRef(1);
  const viewportSaveTimerRef = useRef<number | null>(null);
  const restoringViewportRef = useRef(false);
  const spaceHeldRef = useRef(false);
  const lastCanvasDetailRequestIdRef = useRef(canvasDetailRequestId);

  const focusCanvasView = useCallback((canvas: Canvas | null) => {
    const scroll = scrollRef.current;
    if (!scroll) return;

    if (canvas?.viewport) {
      const zoom = canvas.viewport.zoom;
      restoringViewportRef.current = true;
      canvasZoomRef.current = zoom;
      setCanvasZoom(zoom);
      scroll.scrollLeft = canvas.viewport.x * zoom;
      scroll.scrollTop = canvas.viewport.y * zoom;
      window.requestAnimationFrame(() => {
        restoringViewportRef.current = false;
      });
      return;
    }

    const zoom = canvasZoomRef.current;
    restoringViewportRef.current = true;
    scroll.scrollLeft = CANVAS_WORLD_ORIGIN * zoom - 80 * zoom;
    scroll.scrollTop = CANVAS_WORLD_ORIGIN * zoom - 80 * zoom;
    window.requestAnimationFrame(() => {
      restoringViewportRef.current = false;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (viewportSaveTimerRef.current !== null) {
        window.clearTimeout(viewportSaveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" && event.key !== " ") return;
      const target = event.target;
      if (
        target instanceof Element
        && target.closest("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }
      spaceHeldRef.current = true;
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space" && event.key !== " ") return;
      spaceHeldRef.current = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    if (activeCanvas && activeCanvas.id !== activeCanvasId) {
      setActiveCanvasId(activeCanvas.id);
    }
  }, [activeCanvas, activeCanvasId, setActiveCanvasId]);

  useEffect(() => {
    onBoardBrowserOpenChange?.(boardBrowserOpen);
  }, [boardBrowserOpen, onBoardBrowserOpenChange]);

  useEffect(() => {
    setBoardTitleDraft(activeCanvas?.title ?? "");
    setBoardColorDraft(activeCanvas?.color ?? CANVAS_COLORS[0]);
    setBoardToolsOpen(false);
    setBoardSearchQuery("");
    setSelectedObjects([]);
    setSelectionMarquee(null);
  }, [activeCanvas?.color, activeCanvas?.id, activeCanvas?.title]);

  useEffect(() => {
    if (canvasDetailRequestId === lastCanvasDetailRequestIdRef.current) {
      return;
    }
    lastCanvasDetailRequestIdRef.current = canvasDetailRequestId;
    setBoardBrowserOpen(false);
  }, [canvasDetailRequestId]);

  useEffect(() => {
    if (!boardMenuCanvasId) return undefined;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest(".canvas-board-menu")) return;
      setBoardMenuCanvasId(null);
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [boardMenuCanvasId]);

  useEffect(() => {
    if (!activeCanvas || boardBrowserOpen) return undefined;
    const frames: number[] = [];
    const timeouts: number[] = [];

    focusCanvasView(activeCanvas);
    frames.push(window.requestAnimationFrame(() => focusCanvasView(activeCanvas)));
    frames.push(
      window.requestAnimationFrame(() => {
        frames.push(window.requestAnimationFrame(() => focusCanvasView(activeCanvas)));
      }),
    );
    [120, 280].forEach((delay) => {
      timeouts.push(window.setTimeout(() => focusCanvasView(activeCanvas), delay));
    });

    return () => {
      frames.forEach((frame) => window.cancelAnimationFrame(frame));
      timeouts.forEach((timeout) => window.clearTimeout(timeout));
    };
  }, [activeCanvas?.id, boardBrowserOpen, focusCanvasView]);

  const itemsById = useMemo(() => itemsByIdFromItems(data.items), [data.items]);

  const activeItems = useMemo(
    () => itemsForCanvas(activeCanvas, itemsById),
    [activeCanvas, itemsById],
  );
  const notesById = useMemo(
    () => new Map(data.notes.map((note) => [note.id, note])),
    [data.notes],
  );
  const activeProjectNotes = useMemo(
    () => projectNotesForCanvas(activeCanvas, notesById),
    [activeCanvas, notesById],
  );
  const projectImages = useMemo(() => {
    const items = activeProject
      ? data.items.filter((item) => projectImageIdSet.has(item.id))
      : data.items;

    return [...items].sort((first, second) => {
      const byDate = second.date.localeCompare(first.date);
      if (byDate !== 0) return byDate;
      return itemDisplayTitle(first).localeCompare(itemDisplayTitle(second));
    });
  }, [activeProject, data.items, projectImageIdSet]);
  const activeCanvasItemIds = useMemo(
    () => new Set(activeCanvas?.itemIds ?? []),
    [activeCanvas?.itemIds],
  );
  const activeNotes = activeCanvas?.notes ?? [];
  const activeEdges = activeCanvas?.edges ?? [];
  const activeStrokes = activeCanvas?.strokes ?? [];
  const activeTexts = activeCanvas?.texts ?? [];
  const activeLinks = activeCanvas?.links ?? [];
  const activeSections = activeCanvas?.sections ?? [];

  const browserEditCanvas =
    data.canvases.find((canvas) => canvas.id === browserEditCanvasId) ?? null;

  const boardPreviewItemIds = useMemo(
    () =>
      boardBrowserOpen
        ? collectBoardPreviewItemIds(scopedCanvases, BOARD_BROWSER_PREVIEW_LIMIT)
        : [],
    [boardBrowserOpen, scopedCanvases],
  );

  useEffect(() => {
    if (!boardPreviewItemIds.length) return undefined;

    const missingIds = boardPreviewItemIds.filter((itemId) => !thumbUrls[itemId]);
    if (!missingIds.length) return undefined;

    let cancelled = false;
    window.folio
      .ensureThumbnails(missingIds)
      .then((urls) => {
        if (cancelled) return;
        setThumbUrls((current) => ({ ...current, ...urls }));
      })
      .catch((error) => console.error(error));

    return () => {
      cancelled = true;
    };
  }, [boardPreviewItemIds, setThumbUrls, thumbUrls]);

  const updateCanvas = useCallback(
    (canvasId: string, updater: (canvas: Canvas) => Canvas, message?: string) => {
      const savedAt = new Date().toISOString();
      commitData(
        (current) => ({
          ...current,
          canvases: current.canvases.map((canvas) =>
            canvas.id === canvasId
              ? markCanvasSaved(updater(canvas), savedAt)
              : canvas,
          ),
        }),
        message,
      );
    },
    [commitData],
  );

  const {
    addNote,
    removeItem,
    removeProjectNote,
    updateNote,
    updateNoteSize,
    updateLink,
    deleteLink,
    updateSection,
    deleteSection,
    deleteNote,
    updateTextElement,
    updateTextElementSize,
    deleteTextElement,
  } = useCanvasObjectMutations({ activeCanvas, updateCanvas });

  const saveViewportState = useCallback(
    (viewport: { x: number; y: number; zoom: number }) => {
      if (!activeCanvas || boardBrowserOpen || restoringViewportRef.current) return;

      if (viewportSaveTimerRef.current !== null) {
        window.clearTimeout(viewportSaveTimerRef.current);
      }

      viewportSaveTimerRef.current = window.setTimeout(() => {
        viewportSaveTimerRef.current = null;
        updateCanvas(activeCanvas.id, (canvas) =>
          updateCanvasViewport(canvas, {
            ...viewport,
            updatedAt: new Date().toISOString(),
          }),
        );
      }, 450);
    },
    [activeCanvas, boardBrowserOpen, updateCanvas],
  );

  const applyCanvasZoom = useCallback(
    (nextZoomValue: number) => {
      const scroll = scrollRef.current;
      const nextZoom = clampNumber(nextZoomValue, CANVAS_MIN_ZOOM, CANVAS_MAX_ZOOM);
      const currentZoom = canvasZoomRef.current;

      if (!scroll) {
        canvasZoomRef.current = nextZoom;
        setCanvasZoom(nextZoom);
        return;
      }

      const rect = scroll.getBoundingClientRect();
      const width = scroll.clientWidth || rect.width || 1;
      const height = scroll.clientHeight || rect.height || 1;
      const centerX = (scroll.scrollLeft + width / 2) / currentZoom;
      const centerY = (scroll.scrollTop + height / 2) / currentZoom;

      canvasZoomRef.current = nextZoom;
      setCanvasZoom(nextZoom);
      window.requestAnimationFrame(() => {
        scroll.scrollLeft = centerX * nextZoom - width / 2;
        scroll.scrollTop = centerY * nextZoom - height / 2;
        saveViewportState({
          x: scroll.scrollLeft / nextZoom,
          y: scroll.scrollTop / nextZoom,
          zoom: nextZoom,
        });
      });
    },
    [saveViewportState],
  );

  const zoomIn = useCallback(() => {
    applyCanvasZoom(canvasZoomRef.current * 1.18);
  }, [applyCanvasZoom]);

  const zoomOut = useCallback(() => {
    applyCanvasZoom(canvasZoomRef.current / 1.18);
  }, [applyCanvasZoom]);

  const resetZoom = useCallback(() => {
    applyCanvasZoom(1);
  }, [applyCanvasZoom]);

  const addDroppedItems = useCallback(
    (itemIds: string[], position: CanvasPosition) => {
      if (!activeCanvas || !itemIds.length) return;
      const knownItemIds = new Set(data.items.map((item) => item.id));
      const validItemIds = itemIds.filter(
        (itemId) =>
          knownItemIds.has(itemId) &&
          (!activeProjectId || projectImageIdSet.has(itemId)),
      );
      if (!validItemIds.length) return;

      updateCanvas(
        activeCanvas.id,
        (canvas) => addItemsToCanvas(canvas, validItemIds, position),
        "Selection added to board",
      );
    },
    [activeCanvas, activeProjectId, data.items, projectImageIdSet, updateCanvas],
  );

  const importToBoard = useCallback(async () => {
    if (!activeCanvas) return;

    try {
      const imported = await chooseAndImportItems(activeProjectId);
      if (!imported.length) return;

      const dataWithImports = mergeImportedItemsIntoProject(
        {
          ...data,
          items: mergeItems(data.items, imported),
        },
        imported,
        activeProjectId,
      );
      const nextCanvas = imported.reduce(
        (canvas, item) => addItemToCanvas(canvas, item.id),
        activeCanvas,
      );
      const savedAt = new Date().toISOString();

      saveData(
        {
          ...dataWithImports,
          canvases: dataWithImports.canvases.map((canvas) =>
            canvas.id === activeCanvas.id
              ? markCanvasSaved(nextCanvas, savedAt)
              : canvas,
          ),
        },
        `${formatCount(imported.length, "item")} added to board`,
      );
    } catch (error) {
      console.error(error);
    }
  }, [activeCanvas, activeProjectId, data, saveData]);

  const deleteBoardById = useCallback(
    (canvasId: string) => {
      const canvasToDelete = data.canvases.find((canvas) => canvas.id === canvasId);
      if (!canvasToDelete) return;

      const confirmed = window.confirm(`Delete board "${canvasToDelete.title}"?`);
      if (!confirmed) return;

      let nextActiveCanvasId: string | null = null;
      commitData(
        (current) => {
          const boardIndex = scopedCanvases.findIndex(
            (canvas) => canvas.id === canvasId,
          );
          if (boardIndex === -1) return current;

          const nextCanvases = current.canvases.filter(
            (canvas) => canvas.id !== canvasId,
          );
          const nextScopedCanvases = scopedCanvases.filter(
            (canvas) => canvas.id !== canvasId,
          );
          nextActiveCanvasId = nextScopedCanvases.some(
            (canvas) => canvas.id === activeCanvasId,
          )
            ? activeCanvasId
            : nextScopedCanvases[
                Math.min(boardIndex, nextScopedCanvases.length - 1)
              ]?.id ??
              null;
          const savedAt = new Date().toISOString();

          return {
            ...current,
            canvases: nextCanvases,
            projects: current.projects.map((project) =>
              project.boardIds.includes(canvasId)
                ? {
                    ...project,
                    boardIds: project.boardIds.filter((id) => id !== canvasId),
                    updatedAt: savedAt,
                  }
                : project,
            ),
          };
        },
        "Board deleted",
      );

      setActiveCanvasId(nextActiveCanvasId);
      setBoardToolsOpen(false);
      setBoardMenuCanvasId(null);
      if (boardBrowserOpen || !nextActiveCanvasId) {
        setBoardBrowserOpen(true);
      }
    },
    [
      activeCanvasId,
      boardBrowserOpen,
      commitData,
      data.canvases,
      scopedCanvases,
      setActiveCanvasId,
    ],
  );

  const deleteBoard = useCallback(() => {
    if (!activeCanvas) return;
    deleteBoardById(activeCanvas.id);
  }, [activeCanvas, deleteBoardById]);

  const positionForItem = useCallback(
    (item: FolioItem, index: number): CanvasObjectGeometry => {
      return positionForCanvasItem(item, index, activeCanvas, dragPreview);
    },
    [activeCanvas, dragPreview],
  );

  const positionForNote = useCallback(
    (note: CanvasNote): CanvasObjectGeometry => {
      return positionForCanvasNote(note, dragPreview);
    },
    [dragPreview],
  );

  const positionForProjectNote = useCallback(
    (note: Note, index: number): CanvasObjectGeometry => {
      return positionForCanvasProjectNote(
        note.id,
        index,
        activeCanvas,
        dragPreview,
      );
    },
    [activeCanvas, dragPreview],
  );

  const positionForLink = useCallback(
    (link: CanvasLink): CanvasObjectGeometry => {
      return positionForCanvasLink(link, dragPreview);
    },
    [dragPreview],
  );

  const positionForSection = useCallback(
    (section: CanvasSection): CanvasObjectGeometry => {
      return positionForCanvasSection(section, dragPreview);
    },
    [dragPreview],
  );

  const positionForText = useCallback(
    (textElement: CanvasTextElement): CanvasObjectGeometry => {
      return positionForCanvasText(textElement, dragPreview);
    },
    [dragPreview],
  );

  const canvasObjectLayouts = useMemo(
    () =>
      buildCanvasObjectLayouts({
        activeCanvas,
        activeItems,
        activeProjectNotes,
        activeLinks,
        activeNotes,
        activeSections,
        activeTexts,
        dragPreview,
      }),
    [
      activeCanvas,
      activeItems,
      activeProjectNotes,
      activeLinks,
      activeNotes,
      activeSections,
      activeTexts,
      dragPreview,
    ],
  );

  const edgeRenderModels = useMemo(
    () => edgeRenderModelsFromLayouts(activeEdges, canvasObjectLayouts),
    [activeEdges, canvasObjectLayouts],
  );

  const objectViews = useMemo(
    () =>
      canvasObjectViews({
        canvas: activeCanvas,
        items: activeItems,
        projectNotes: activeProjectNotes,
        links: activeLinks,
        notes: activeNotes,
        sections: activeSections,
        texts: activeTexts,
        dragPreview,
      }),
    [
      activeCanvas,
      activeItems,
      activeProjectNotes,
      activeLinks,
      activeNotes,
      activeSections,
      activeTexts,
      dragPreview,
    ],
  );

  const selectedObjectKeySet = useMemo(
    () => selectionSetFromObjects(selectedObjects),
    [selectedObjects],
  );

  const selectedObjectPositions = useMemo(() => {
    return new Map(
      objectViews
        .filter((object) => selectedObjectKeySet.has(canvasObjectSelectionKey(object)))
        .map((object) => [canvasObjectSelectionKey(object), object.geometry]),
    );
  }, [objectViews, selectedObjectKeySet]);

  const selectedArrangeableObjects = useMemo<ArrangeableCanvasObject[]>(() => {
    return objectViews
      .filter((object) => selectedObjectKeySet.has(canvasObjectSelectionKey(object)))
      .map((object) => ({
        id: object.id,
        kind: object.kind,
        geometry: object.geometry,
      }));
  }, [objectViews, selectedObjectKeySet]);

  const matchedObjectKeys = useMemo(() => {
    const query = boardSearchQuery.trim().toLowerCase();
    if (!query) return new Set<string>();

    return new Set(
      objectViews
        .filter((object) => object.title.toLowerCase().includes(query))
        .map(canvasObjectSelectionKey),
    );
  }, [boardSearchQuery, objectViews]);

  const matchedEdgeIds = useMemo(() => {
    const query = boardSearchQuery.trim().toLowerCase();
    if (!query) return new Set<string>();

    return new Set(
      activeEdges
        .filter((edge) => (edge.label ?? "").toLowerCase().includes(query))
        .map((edge) => edge.id),
    );
  }, [activeEdges, boardSearchQuery]);

  const fitCanvasContent = useCallback(() => {
    const scroll = scrollRef.current;
    const layouts = Array.from(canvasObjectLayouts.values());
    if (!scroll || !layouts.length) {
      focusCanvasView(activeCanvas);
      return;
    }

    const rect = scroll.getBoundingClientRect();
    const viewportWidth = scroll.clientWidth || rect.width || 1;
    const viewportHeight = scroll.clientHeight || rect.height || 1;
    const padding = 72;
    const minX = Math.min(
      ...layouts.map((layout) => layout.center.x - layout.size.width / 2),
    );
    const maxX = Math.max(
      ...layouts.map((layout) => layout.center.x + layout.size.width / 2),
    );
    const minY = Math.min(
      ...layouts.map((layout) => layout.center.y - layout.size.height / 2),
    );
    const maxY = Math.max(
      ...layouts.map((layout) => layout.center.y + layout.size.height / 2),
    );
    const contentWidth = Math.max(1, maxX - minX);
    const contentHeight = Math.max(1, maxY - minY);
    const nextZoom = clampNumber(
      Math.min(
        1,
        (viewportWidth - padding) / contentWidth,
        (viewportHeight - padding) / contentHeight,
      ),
      CANVAS_MIN_ZOOM,
      CANVAS_MAX_ZOOM,
    );

    canvasZoomRef.current = nextZoom;
    setCanvasZoom(nextZoom);
    window.requestAnimationFrame(() => {
      scroll.scrollLeft = minX * nextZoom - padding / 2;
      scroll.scrollTop = minY * nextZoom - padding / 2;
      saveViewportState({
        x: scroll.scrollLeft / nextZoom,
        y: scroll.scrollTop / nextZoom,
        zoom: nextZoom,
      });
    });
  }, [activeCanvas, canvasObjectLayouts, focusCanvasView, saveViewportState]);

  const focusMinimapViewport = useCallback(
    (x: number, y: number) => {
      const scroll = scrollRef.current;
      if (!scroll) return;
      scroll.scrollLeft = x * canvasZoomRef.current;
      scroll.scrollTop = y * canvasZoomRef.current;
      saveViewportState({
        x,
        y,
        zoom: canvasZoomRef.current,
      });
    },
    [saveViewportState],
  );

  const deleteSelectedObjects = useCallback(() => {
    if (!activeCanvas || !selectedObjects.length) return;
    updateCanvas(
      activeCanvas.id,
      (canvas) => deleteCanvasObjects(canvas, selectedObjects),
      "Selection deleted",
    );
    setSelectedObjects([]);
  }, [activeCanvas, selectedObjects, updateCanvas]);

  const duplicateSelectedObjects = useCallback(() => {
    if (!activeCanvas || !selectedObjects.length) return;
    const result = duplicateCanvasObjects(
      activeCanvas,
      selectedObjects,
      (kind) => createId(kind),
    );
    if (!result.duplicatedObjects.length) return;

    updateCanvas(activeCanvas.id, () => result.canvas, "Selection duplicated");
    setSelectedObjects(result.duplicatedObjects);
  }, [activeCanvas, selectedObjects, updateCanvas]);

  const zoomToSelection = useCallback(() => {
    const scroll = scrollRef.current;
    const bounds = canvasObjectBounds(selectedArrangeableObjects);
    if (!scroll || !bounds) return;

    const rect = scroll.getBoundingClientRect();
    const viewportWidth = scroll.clientWidth || rect.width || 1;
    const viewportHeight = scroll.clientHeight || rect.height || 1;
    const padding = 96;
    const nextZoom = clampNumber(
      Math.min(
        1.4,
        (viewportWidth - padding) / Math.max(1, bounds.width),
        (viewportHeight - padding) / Math.max(1, bounds.height),
      ),
      CANVAS_MIN_ZOOM,
      CANVAS_MAX_ZOOM,
    );

    canvasZoomRef.current = nextZoom;
    setCanvasZoom(nextZoom);
    window.requestAnimationFrame(() => {
      scroll.scrollLeft = bounds.x * nextZoom - padding / 2;
      scroll.scrollTop = bounds.y * nextZoom - padding / 2;
      saveViewportState({
        x: scroll.scrollLeft / nextZoom,
        y: scroll.scrollTop / nextZoom,
        zoom: nextZoom,
      });
    });
  }, [saveViewportState, selectedArrangeableObjects]);

  const surfacePointFromClient = useCallback(
    (clientX: number, clientY: number): CanvasPosition => {
      const surface = surfaceRef.current;
      if (!surface) return { x: CANVAS_WORLD_ORIGIN + 120, y: CANVAS_WORLD_ORIGIN + 120 };
      const rect = surface.getBoundingClientRect();
      return {
        x: (clientX - rect.left) / canvasZoom,
        y: (clientY - rect.top) / canvasZoom,
      };
    },
    [canvasZoom],
  );

  const {
    activeTool,
    handleSurfacePointerDown,
    handleSurfacePointerMove,
    hideToolCursor,
    setActiveTool,
    strokePreview,
    toolCursorPosition,
    undoLastStroke,
  } = useCanvasDrawingTools({
    activeCanvas,
    activeStrokes,
    surfacePointFromClient,
    updateCanvas,
  });

  const {
    deleteEdge,
    edgeDraft,
    edgeLabelDraft,
    editingEdgeId,
    reverseEdgeDirection,
    saveEdgeLabel,
    selectedEdgeId,
    setEdgeLabelDraft,
    setSelectedEdgeId,
    startConnectorDrag,
    startEdgeDrag,
    startEdgeLabelEdit,
    stopEdgeLabelEdit,
    updateEdgeDirection,
  } = useCanvasEdges({
    activeCanvas,
    canvasObjectLayouts,
    surfacePointFromClient,
    updateCanvas,
  });

  const { startDrag, suppressClickAfterDrag } = useCanvasObjectDrag({
    activeCanvas,
    activeTool,
    canvasZoom,
    data,
    objectViews,
    saveData,
    selectedObjectPositions,
    selectedObjects,
    setDragPreview,
    startEdgeDrag,
  });

  const { startResize } = useCanvasObjectResize({
    activeCanvas,
    canvasZoom,
    data,
    saveData,
    setDragPreview,
  });

  const relativeCanvasPointFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const point = surfacePointFromClient(clientX, clientY);
      return {
        x: point.x - CANVAS_WORLD_ORIGIN,
        y: point.y - CANVAS_WORLD_ORIGIN,
      };
    },
    [surfacePointFromClient],
  );

  const selectCanvasObject = useCallback(
    (event: React.PointerEvent, kind: CanvasObjectSelection["kind"], id: string) => {
      if (activeTool !== "select" || event.button !== 0) return;
      const target = event.target;
      if (
        target instanceof Element
        && target.closest("button, input, textarea, select, a")
      ) {
        return;
      }

      const selection = { id, kind };
      setSelectedEdgeId(null);
      setSelectedObjects((current) =>
        event.metaKey || event.ctrlKey || event.shiftKey
          ? toggleCanvasObjectSelection(current, selection)
          : [selection],
      );
    },
    [activeTool, setSelectedEdgeId],
  );

  const startMarqueeSelection = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return false;
      // Space + drag pans the canvas, so it should not start a marquee.
      if (spaceHeldRef.current) return false;
      const target = event.target;
      if (target !== surfaceRef.current) return false;

      event.preventDefault();
      event.stopPropagation();
      const startPoint = relativeCanvasPointFromClient(event.clientX, event.clientY);
      const appendSelection = event.metaKey || event.ctrlKey || event.shiftKey;
      setSelectionMarquee({ x: startPoint.x, y: startPoint.y, width: 0, height: 0 });

      const onPointerMove = (moveEvent: PointerEvent) => {
        moveEvent.preventDefault();
        const currentPoint = relativeCanvasPointFromClient(
          moveEvent.clientX,
          moveEvent.clientY,
        );
        setSelectionMarquee(
          normalizedSelectionRectangle(startPoint, currentPoint),
        );
      };

      const onPointerUp = (upEvent: PointerEvent) => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        const currentPoint = relativeCanvasPointFromClient(
          upEvent.clientX,
          upEvent.clientY,
        );
        const rectangle = normalizedSelectionRectangle(startPoint, currentPoint);
        const objectsInRectangle = selectCanvasObjectsInRectangle(
          objectViews.filter((object) => object.selectable),
          rectangle,
        );

        setSelectionMarquee(null);
        setSelectedEdgeId(null);
        setSelectedObjects((current) => {
          if (!appendSelection) return objectsInRectangle;
          const currentKeys = selectionSetFromObjects(current);
          const appended = objectsInRectangle.filter(
            (selection) => !currentKeys.has(canvasObjectSelectionKey(selection)),
          );
          return [...current, ...appended];
        });
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      return true;
    },
    [objectViews, relativeCanvasPointFromClient, setSelectedEdgeId],
  );

  const handleCanvasSurfacePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (activeTool === "select") {
        const target = event.target;
        if (target === surfaceRef.current && event.button === 0) {
          // A plain drag on empty canvas draws a selection box; modifier keys
          // extend the current selection. Either way a marquee starts here.
          if (startMarqueeSelection(event)) return;
        }
      }

      handleSurfacePointerDown(event);
    },
    [
      activeTool,
      handleSurfacePointerDown,
      startMarqueeSelection,
    ],
  );

  const centerPositionForCurrentViewport = useCallback((): CanvasPosition => {
    const scroll = scrollRef.current;
    if (!scroll) return { x: 120, y: 120 };
    const rect = scroll.getBoundingClientRect();
    const width = scroll.clientWidth || rect.width;
    const height = scroll.clientHeight || rect.height;
    if (!width || !height) return { x: 120, y: 120 };
    return {
      x: (scroll.scrollLeft + width / 2) / canvasZoom - CANVAS_WORLD_ORIGIN,
      y: (scroll.scrollTop + height / 2) / canvasZoom - CANVAS_WORLD_ORIGIN,
    };
  }, [canvasZoom]);

  const toggleProjectImageOnBoard = useCallback(
    (itemId: string) => {
      if (!activeCanvas) return;

      if (activeCanvas.itemIds.includes(itemId)) {
        updateCanvas(
          activeCanvas.id,
          (canvas) => removeItemFromCanvas(canvas, itemId),
          "Item removed from board",
        );
        setSelectedObjects((current) =>
          current.filter(
            (selection) =>
              selection.id !== itemId
              || (selection.kind !== "item" && selection.kind !== "document"),
          ),
        );
        return;
      }

      updateCanvas(
        activeCanvas.id,
        (canvas) =>
          addItemsToCanvas(canvas, [itemId], centerPositionForCurrentViewport()),
        "Item added to board",
      );
    },
    [activeCanvas, centerPositionForCurrentViewport, updateCanvas],
  );

  const addLinkAtPosition = useCallback(
    (rawUrl: string, point: CanvasPosition) => {
      if (!activeCanvas) return false;
      const link = createCanvasLinkFromUrl(rawUrl, point);
      if (!link) return false;

      const canvasId = activeCanvas.id;
      updateCanvas(
        canvasId,
        (canvas) => addCanvasLink(canvas, link),
        "Link added to board",
      );

      void window.folio
        .fetchLinkMetadata(link.url)
        .then((metadata) => {
          const patch = {
            title: metadata.title ?? link.title,
            description: metadata.description,
            sourceDomain: metadata.sourceDomain ?? link.sourceDomain,
            imageUrl: metadata.imageUrl,
            faviconUrl: metadata.faviconUrl,
          };
          updateCanvas(canvasId, (canvas) =>
            updateCanvasLink(canvas, link.id, patch),
          );
        })
        .catch(() => undefined);

      return true;
    },
    [activeCanvas, updateCanvas],
  );

  const addLinkToBoard = useCallback(() => {
    setLinkPromptOpen(true);
  }, []);

  const submitLinkPrompt = useCallback(
    (rawUrl: string) => {
      if (!addLinkAtPosition(rawUrl, centerPositionForCurrentViewport())) {
        return false;
      }
      setLinkPromptOpen(false);
      setActiveTool("select");
      return true;
    },
    [addLinkAtPosition, centerPositionForCurrentViewport, setActiveTool],
  );

  const addTextAtPosition = useCallback(
    (text: string, point: CanvasPosition) => {
      if (!activeCanvas) return false;
      const trimmedText = text.trim();
      if (!trimmedText) return false;
      const now = new Date().toISOString();

      updateCanvas(
        activeCanvas.id,
        (canvas) =>
          addCanvasTextElement(canvas, {
            id: createId("text"),
            text: trimmedText,
            size: "md",
            x: point.x,
            y: point.y,
            width: 280,
            height: 140,
            createdAt: now,
            updatedAt: now,
          }),
        "Text added to board",
      );
      return true;
    },
    [activeCanvas, updateCanvas],
  );

  useCanvasKeyboardShortcuts({
    activeCanvas,
    activeStrokeCount: activeStrokes.length,
    editingEdgeId,
    selectedEdgeId,
    selectedObjectCount: selectedObjects.length,
    setActiveTool,
    clearSelectedObjects: () => setSelectedObjects([]),
    setSelectedEdgeId,
    undoLastStroke,
    duplicateSelectedObjects,
    deleteSelectedObjects,
    deleteEdge,
    resetZoom,
    fitCanvasContent,
    zoomToSelection,
  });

  const canvasPointFromEvent = useCallback((event: React.DragEvent) => {
    const surface = surfaceRef.current;
    if (!surface) return { x: 120, y: 120 };
    const rect = surface.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / canvasZoom - CANVAS_WORLD_ORIGIN,
      y: (event.clientY - rect.top) / canvasZoom - CANVAS_WORLD_ORIGIN,
    };
  }, [canvasZoom]);

  const addProjectFilesAtPosition = useCallback(
    async (filePaths: string[], point: CanvasPosition) => {
      if (!activeCanvas || !activeProjectId || !window.folio.copyToProject) return false;
      const uniquePaths = Array.from(new Set(filePaths.filter(Boolean)));
      if (!uniquePaths.length) return false;

      const imported = await window.folio.copyToProject(activeProjectId, uniquePaths);
      if (!imported.length) return true;

      const dataWithImports = mergeImportedItemsIntoProject(
        data,
        imported,
        activeProjectId,
      );
      const nextCanvas = addItemsToCanvas(
        activeCanvas,
        imported.map((item) => item.id),
        point,
      );
      const savedAt = new Date().toISOString();

      saveData(
        {
          ...dataWithImports,
          canvases: dataWithImports.canvases.map((canvas) =>
            canvas.id === activeCanvas.id
              ? markCanvasSaved(nextCanvas, savedAt)
              : canvas,
          ),
        },
        `${formatCount(imported.length, "item")} added to board`,
      );
      return true;
    },
    [activeCanvas, activeProjectId, data, saveData],
  );

  const handleBoardDrop = useCallback(
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

      const uriList = event.dataTransfer
        .getData("text/uri-list")
        .split(/\r?\n/)
        .find((line) => line.trim() && !line.startsWith("#"));
      const plainText = event.dataTransfer.getData("text/plain");
      const droppedText = uriList || plainText;
      if (droppedText && addLinkAtPosition(droppedText, canvasPointFromEvent(event))) {
        return;
      }

      const filePaths = Array.from(event.dataTransfer.files)
        .map((file) => window.folio.getPathForFile(file))
        .filter(Boolean);
      if (!filePaths.length) return;

      if (await addProjectFilesAtPosition(filePaths, canvasPointFromEvent(event))) {
        return;
      }
    },
    [
      activeCanvas,
      addDroppedItems,
      addLinkAtPosition,
      addProjectFilesAtPosition,
      canvasPointFromEvent,
      clearDragState,
    ],
  );

  const handleBoardDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  useEffect(() => {
    if (!activeCanvas || boardBrowserOpen) return undefined;

    const handlePaste = (event: ClipboardEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        Boolean(target.closest("input, textarea, select, [contenteditable='true']"))
      ) {
        return;
      }

      const point = centerPositionForCurrentViewport();
      const filePaths = Array.from(event.clipboardData?.files ?? [])
        .map((file) => window.folio.getPathForFile(file))
        .filter(Boolean);

      if (filePaths.length) {
        event.preventDefault();
        void addProjectFilesAtPosition(filePaths, point);
        return;
      }

      const text = event.clipboardData?.getData("text/plain")?.trim();
      if (!text) return;

      if (normalizeCanvasLinkUrl(text)) {
        event.preventDefault();
        addLinkAtPosition(text, point);
        return;
      }

      event.preventDefault();
      addTextAtPosition(text, point);
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [
    activeCanvas,
    addLinkAtPosition,
    addProjectFilesAtPosition,
    addTextAtPosition,
    boardBrowserOpen,
    centerPositionForCurrentViewport,
  ]);

  const saveBoardSettingsForCanvas = useCallback((canvasToSave: Canvas | null) => {
    if (!canvasToSave) return;
    const trimmed = boardTitleDraft.trim();
    const nextTitle = trimmed || canvasToSave.title;
    const nextColor =
      boardColorDraft || canvasToSave.color || CANVAS_COLORS[0];
    const currentColor = canvasToSave.color ?? CANVAS_COLORS[0];

    setBoardTitleDraft(nextTitle);
    setBoardColorDraft(nextColor);

    if (nextTitle === canvasToSave.title && nextColor === currentColor) return;

    updateCanvas(
      canvasToSave.id,
      (canvas) => ({
        ...canvas,
        title: nextTitle,
        color: nextColor,
      }),
      "Board updated",
    );
  }, [boardColorDraft, boardTitleDraft, updateCanvas]);

  const openCanvas = useCallback(
    (canvasId: string) => {
      setActiveCanvasId(canvasId);
      setBoardBrowserOpen(false);
    },
    [setActiveCanvasId],
  );

  const editCanvasFromBrowser = useCallback(
    (canvasId: string) => {
      const canvasToEdit = scopedCanvases.find((canvas) => canvas.id === canvasId);
      if (!canvasToEdit) return;

      setBoardMenuCanvasId(null);
      setBoardTitleDraft(canvasToEdit.title);
      setBoardColorDraft(canvasToEdit.color ?? CANVAS_COLORS[0]);
      setBrowserEditCanvasId(canvasId);
    },
    [scopedCanvases],
  );

  const createBoardFromBrowser = useCallback((templateId?: CanvasTemplateId) => {
    onCreateBoard(templateId);
    setBoardBrowserOpen(false);
  }, [onCreateBoard]);

  const hasDraggedItems = useCallback((event: React.DragEvent) => {
    return Array.from(event.dataTransfer.types).includes(ITEM_DRAG_MIME);
  }, []);

  const addDraggedItemsToBoard = useCallback(
    (event: React.DragEvent<HTMLElement>, canvasId: string) => {
      const itemPayload = event.dataTransfer.getData(ITEM_DRAG_MIME);
      if (!itemPayload) return;

      event.preventDefault();
      event.stopPropagation();
      setBoardDropCanvasId(null);
      clearDragState();

      try {
        const itemIds = JSON.parse(itemPayload) as string[];
        const knownItemIds = new Set(data.items.map((item) => item.id));
        const validItemIds = itemIds.filter(
          (itemId) =>
            knownItemIds.has(itemId) &&
            (!activeProjectId || projectImageIdSet.has(itemId)),
        );
        if (!validItemIds.length) return;
        const savedAt = new Date().toISOString();

        commitData(
          (current) => ({
            ...current,
            canvases: current.canvases.map((canvas) =>
              canvas.id === canvasId
                ? markCanvasSaved(
                    addItemsToCanvas(canvas, validItemIds),
                    savedAt,
                  )
                : canvas,
            ),
          }),
          `${formatCount(validItemIds.length, "item")} added to board`,
        );
      } catch (error) {
        console.error(error);
      }
    },
    [activeProjectId, clearDragState, commitData, data.items, projectImageIdSet],
  );

  const handleBoardTileDragOver = useCallback(
    (event: React.DragEvent<HTMLElement>, canvasId: string) => {
      if (!hasDraggedItems(event)) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "copy";
      setBoardDropCanvasId(canvasId);
    },
    [hasDraggedItems],
  );

  const handleBoardTileDragLeave = useCallback(
    (event: React.DragEvent<HTMLElement>, canvasId: string) => {
      const relatedTarget = event.relatedTarget;
      if (relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget)) {
        return;
      }
      setBoardDropCanvasId((current) => (current === canvasId ? null : current));
    },
    [],
  );

  if (!activeCanvas || boardBrowserOpen) {
    return (
      <BoardBrowser
        activeCanvasId={activeCanvas?.id ?? null}
        boardColorDraft={boardColorDraft}
        boardDropCanvasId={boardDropCanvasId}
        boardMenuCanvasId={boardMenuCanvasId}
        boardTitleDraft={boardTitleDraft}
        browserEditCanvas={browserEditCanvas}
        canvases={scopedCanvases}
        itemsById={itemsById}
        thumbUrls={thumbUrls}
        setThumbUrls={setThumbUrls}
        onAddDraggedItemsToBoard={addDraggedItemsToBoard}
        onBoardColorDraftChange={setBoardColorDraft}
        onBoardTileDragLeave={handleBoardTileDragLeave}
        onBoardTileDragOver={handleBoardTileDragOver}
        onBoardTitleDraftChange={setBoardTitleDraft}
        onCloseBrowserEditCanvas={() => setBrowserEditCanvasId(null)}
        onCreateBoard={createBoardFromBrowser}
        onDeleteBoardById={deleteBoardById}
        onEditCanvas={editCanvasFromBrowser}
        onOpenCanvas={openCanvas}
        onSaveBoardSettings={saveBoardSettingsForCanvas}
        onToggleBoardMenu={(canvasId) =>
          setBoardMenuCanvasId((current) =>
            current === canvasId ? null : canvasId,
          )
        }
      />
    );
  }

  return (
    <section className="canvas-workspace canvas-board-detail-workspace">
      <div className="canvas-panel" key={activeCanvas.id}>
        <div className="canvas-board-top">
          <CanvasBoardHeader
            activeCanvas={activeCanvas}
            activeStrokeCount={activeStrokes.length}
            activeTool={activeTool}
            boardColorDraft={boardColorDraft}
            boardSearchQuery={boardSearchQuery}
            boardTitleDraft={boardTitleDraft}
            boardToolsOpen={boardToolsOpen}
            canvasZoom={canvasZoom}
            projectImageCount={projectImages.length}
            projectImagePickerOpen={projectImagePickerOpen}
            onActiveToolChange={setActiveTool}
            onAddLink={addLinkToBoard}
            onAddNote={addNote}
            onBackToBoards={() => setBoardBrowserOpen(true)}
            onBoardColorDraftChange={setBoardColorDraft}
            onBoardSearchQueryChange={setBoardSearchQuery}
            onBoardTitleDraftChange={setBoardTitleDraft}
            onCreateBoard={() => createBoardFromBrowser()}
            onDeleteBoard={deleteBoard}
            onFitContent={fitCanvasContent}
            onImportImages={importToBoard}
            onResetZoom={resetZoom}
            onSaveBoardSettings={saveBoardSettingsForCanvas}
            onToggleBoardTools={() => setBoardToolsOpen((current) => !current)}
            onToggleProjectImages={() =>
              setProjectImagePickerOpen((current) => !current)
            }
            onUndoStroke={undoLastStroke}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
          />

          {projectImagePickerOpen ? (
            <section
              className="canvas-project-image-tray"
              id="canvas-project-image-picker"
              aria-label="Project images"
            >
              {projectImages.length ? (
                <>
                  <div
                    className="canvas-project-image-grid-control"
                    role="group"
                    aria-label="Image grid size"
                  >
                    {[
                      { columns: 3, label: "S" },
                      { columns: 2, label: "M" },
                      { columns: 1, label: "L" },
                    ].map((option) => (
                      <button
                        className={
                          projectImageColumns === option.columns
                            ? "canvas-project-image-grid-active"
                            : ""
                        }
                        key={option.columns}
                        type="button"
                        aria-label={`${option.label} image grid`}
                        aria-pressed={projectImageColumns === option.columns}
                        onClick={() => setProjectImageColumns(option.columns)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <div
                    className="canvas-project-image-list"
                    style={{
                      gridTemplateColumns: `repeat(${projectImageColumns}, minmax(0, 1fr))`,
                    }}
                  >
                  {projectImages.map((item) => {
                    const itemTitle = itemDisplayTitle(item);
                    const alreadyAdded = activeCanvasItemIds.has(item.id);
                    const itemKind = canvasKindForItem(item);
                    const actionLabel = alreadyAdded
                      ? `Remove ${itemTitle} from board`
                      : item.missing
                        ? `${itemTitle} is missing`
                        : `Add ${itemTitle} to board`;

                    return (
                      <article
                        className={`canvas-project-image-card ${
                          alreadyAdded ? "canvas-project-image-card-added" : ""
                        } ${
                          item.missing ? "canvas-project-image-card-missing" : ""
                        }`}
                        key={item.id}
                      >
                        <button
                          className="canvas-project-image-preview"
                          type="button"
                          aria-label={actionLabel}
                          aria-pressed={alreadyAdded}
                          title={itemTitle}
                          disabled={item.missing}
                          onClick={() => toggleProjectImageOnBoard(item.id)}
                        >
                          <LazyThumbnail
                            item={item}
                            thumbUrls={thumbUrls}
                            setThumbUrls={setThumbUrls}
                          />
                          {itemKind === "document" ? (
                            <span className="canvas-project-image-type">Doc</span>
                          ) : null}
                        </button>
                      </article>
                    );
                  })}
                  </div>
                </>
              ) : (
                <p className="canvas-project-image-empty">
                  Import files to this project to add them to boards.
                </p>
              )}
            </section>
          ) : null}
        </div>

        <CanvasSelectionBar
          selectedCount={selectedObjects.length}
          onDelete={deleteSelectedObjects}
          onDuplicate={duplicateSelectedObjects}
        />

        {linkPromptOpen ? (
          <CanvasLinkPrompt
            onCancel={() => setLinkPromptOpen(false)}
            onSubmit={submitLinkPrompt}
          />
        ) : null}

        <CanvasViewport
          zoom={canvasZoom}
          zoomRef={canvasZoomRef}
          onZoomChange={setCanvasZoom}
          scrollRef={scrollRef}
          surfaceRef={surfaceRef}
          surfaceClassName={
            activeTool === "pen" || activeTool === "eraser"
              ? "canvas-surface-tool-active"
              : ""
          }
          onDrop={handleBoardDrop}
          onDragOver={handleBoardDragOver}
          onSurfacePointerDown={handleCanvasSurfacePointerDown}
          onSurfacePointerMove={handleSurfacePointerMove}
          onSurfacePointerLeave={hideToolCursor}
          onViewportChange={saveViewportState}
        >
          <CanvasInkLayer
            activeStrokes={activeStrokes}
            activeTool={activeTool}
            canvasObjectLayouts={canvasObjectLayouts}
            edgeDraft={edgeDraft}
            edgeRenderModels={edgeRenderModels}
            selectedEdgeId={selectedEdgeId}
            strokePreview={strokePreview}
            onSelectEdge={setSelectedEdgeId}
            onStartEdgeLabelEdit={startEdgeLabelEdit}
          />

          <CanvasEdgeLabels
            edgeLabelDraft={edgeLabelDraft}
            edgeRenderModels={edgeRenderModels}
            editingEdgeId={editingEdgeId}
            matchedEdgeIds={matchedEdgeIds}
            selectedEdgeId={selectedEdgeId}
            onDeleteEdge={deleteEdge}
            onEdgeLabelDraftChange={setEdgeLabelDraft}
            onReverseEdgeDirection={reverseEdgeDirection}
            onSaveEdgeLabel={saveEdgeLabel}
            onSelectEdge={setSelectedEdgeId}
            onStartEdgeLabelEdit={startEdgeLabelEdit}
            onStopEdgeLabelEdit={stopEdgeLabelEdit}
            onUpdateEdgeDirection={updateEdgeDirection}
          />

          <CanvasToolCursor
            activeTool={activeTool}
            position={toolCursorPosition}
          />

          {selectionMarquee ? (
            <div
              className="canvas-selection-marquee"
              style={{
                height: selectionMarquee.height,
                transform: `translate(${
                  selectionMarquee.x + CANVAS_WORLD_ORIGIN
                }px, ${selectionMarquee.y + CANVAS_WORLD_ORIGIN}px)`,
                width: selectionMarquee.width,
              }}
            />
          ) : null}

          <CanvasObjectLayer
            activeItems={activeItems}
            activeProjectNotes={activeProjectNotes}
            activeLinks={activeLinks}
            activeNotes={activeNotes}
            activeSections={activeSections}
            activeTexts={activeTexts}
            matchedObjectKeys={matchedObjectKeys}
            selectedObjectKeys={selectedObjectKeySet}
            thumbUrls={thumbUrls}
            setThumbUrls={setThumbUrls}
            positionForLink={positionForLink}
            positionForItem={positionForItem}
            positionForProjectNote={positionForProjectNote}
            positionForNote={positionForNote}
            positionForSection={positionForSection}
            positionForText={positionForText}
            onDeleteLink={deleteLink}
            onDeleteNote={deleteNote}
            onDeleteSection={deleteSection}
            onDeleteTextElement={deleteTextElement}
            onOpenItem={onOpenItem}
            onOpenProjectNote={onOpenNote}
            onRemoveItem={removeItem}
            onRemoveProjectNote={removeProjectNote}
            onSelectObject={selectCanvasObject}
            onStartConnectorDrag={startConnectorDrag}
            onStartDrag={startDrag}
            onStartResize={startResize}
            onSuppressClickAfterDrag={suppressClickAfterDrag}
            onUpdateLink={updateLink}
            onUpdateNote={updateNote}
            onUpdateNoteSize={updateNoteSize}
            onUpdateSection={updateSection}
            onUpdateTextElement={updateTextElement}
            onUpdateTextElementSize={updateTextElementSize}
          />

        </CanvasViewport>

        <CanvasMinimap
          objectViews={objectViews}
          scrollRef={scrollRef}
          zoom={canvasZoom}
          onFocusViewport={focusMinimapViewport}
        />
      </div>
    </section>
  );
}
