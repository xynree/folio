import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Plus } from "lucide-react";
import type {
  Canvas,
  CanvasNote,
  CanvasObjectGeometry,
  CanvasPosition,
  CanvasReference,
  CanvasTextElement,
  CanvasTextSize,
  FolioData,
  FolioItem,
  ThumbnailUrls,
} from "../../types";
import {
  CANVAS_COLORS,
  CANVAS_WORLD_ORIGIN,
  IMAGE_FILE_PATTERN,
  ITEM_DRAG_MIME,
} from "../folio/constants";
import type { DataUpdater, ItemDetailsOpenHandler } from "../folio/types";
import {
  addItemToCanvas,
  addItemsToCanvas,
  basename,
  createId,
  formatCount,
  markCanvasSaved,
  mergeImportedItemsIntoProject,
  mergeItems,
} from "../folio/model";
import { chooseAndImportItems } from "../folio/importing";
import { BoardBrowser } from "./BoardBrowser";
import { CanvasBoardHeader } from "./CanvasBoardHeader";
import { CanvasEdgeLabels } from "./CanvasEdgeLabels";
import { CanvasInkLayer } from "./CanvasInkLayer";
import { CanvasObjectLayer } from "./CanvasObjectLayer";
import { CanvasToolCursor } from "./CanvasToolCursor";
import { edgeRenderModelsFromLayouts } from "./canvasGeometry";
import {
  boardPreviewItemIds as collectBoardPreviewItemIds,
  buildCanvasObjectLayouts,
  itemsByIdFromItems,
  itemsForCanvas,
  positionForCanvasItem,
  positionForCanvasNote,
  positionForCanvasReference,
  positionForCanvasText,
} from "./canvasLayout";
import type { CanvasDragPreview } from "./canvasLayout";
import {
  deleteCanvasNote,
  deleteCanvasTextElement,
  removeCanvasReference,
  removeItemFromCanvas,
  updateCanvasNoteText,
  updateCanvasTextElementSize,
  updateCanvasTextElementText,
} from "./canvasModel";
import { CanvasViewport } from "./CanvasViewport";
import { ButtonIcon } from "../shared/ButtonIcon";
import { LazyThumbnail } from "../shared/LazyThumbnail";
import { useCanvasDrawingTools } from "./useCanvasDrawingTools";
import { useCanvasEdges } from "./useCanvasEdges";
import { useCanvasObjectDrag } from "./useCanvasObjectDrag";
import { useCanvasObjectResize } from "./useCanvasObjectResize";

const BOARD_BROWSER_PREVIEW_LIMIT = 3;

export function CanvasView({
  data,
  activeCanvasId,
  activeProjectId,
  canvasDetailRequestId,
  setActiveCanvasId,
  onOpenItem,
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
  setActiveCanvasId: React.Dispatch<React.SetStateAction<string | null>>;
  onOpenItem: ItemDetailsOpenHandler;
  onCreateBoard: () => void;
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
  const [boardBrowserOpen, setBoardBrowserOpen] = useState(
    () => canvasDetailRequestId === 0,
  );
  const [boardMenuCanvasId, setBoardMenuCanvasId] = useState<string | null>(null);
  const [browserEditCanvasId, setBrowserEditCanvasId] = useState<string | null>(
    null,
  );
  const [boardDropCanvasId, setBoardDropCanvasId] = useState<string | null>(null);
  const [boardTitleDraft, setBoardTitleDraft] = useState("");
  const [boardColorDraft, setBoardColorDraft] = useState(CANVAS_COLORS[0]);
  const [canvasZoom, setCanvasZoom] = useState(1);
  const canvasZoomRef = useRef(1);
  const lastCanvasDetailRequestIdRef = useRef(canvasDetailRequestId);

  const focusCanvasOrigin = useCallback(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const zoom = canvasZoomRef.current;
    scroll.scrollLeft = CANVAS_WORLD_ORIGIN * zoom - 80 * zoom;
    scroll.scrollTop = CANVAS_WORLD_ORIGIN * zoom - 80 * zoom;
  }, []);

  useEffect(() => {
    if (activeCanvas && activeCanvas.id !== activeCanvasId) {
      setActiveCanvasId(activeCanvas.id);
    }
  }, [activeCanvas, activeCanvasId, setActiveCanvasId]);

  useEffect(() => {
    setBoardTitleDraft(activeCanvas?.title ?? "");
    setBoardColorDraft(activeCanvas?.color ?? CANVAS_COLORS[0]);
    setBoardToolsOpen(false);
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

    focusCanvasOrigin();
    frames.push(window.requestAnimationFrame(focusCanvasOrigin));
    frames.push(
      window.requestAnimationFrame(() => {
        frames.push(window.requestAnimationFrame(focusCanvasOrigin));
      }),
    );
    [120, 280].forEach((delay) => {
      timeouts.push(window.setTimeout(focusCanvasOrigin, delay));
    });

    return () => {
      frames.forEach((frame) => window.cancelAnimationFrame(frame));
      timeouts.forEach((timeout) => window.clearTimeout(timeout));
    };
  }, [activeCanvas?.id, boardBrowserOpen, focusCanvasOrigin]);

  const itemsById = useMemo(() => itemsByIdFromItems(data.items), [data.items]);

  const activeItems = useMemo(
    () => itemsForCanvas(activeCanvas, itemsById),
    [activeCanvas, itemsById],
  );
  const projectImages = useMemo(() => {
    const items = activeProject
      ? data.items.filter((item) => projectImageIdSet.has(item.id))
      : data.items;

    return [...items].sort((first, second) => {
      const byDate = second.date.localeCompare(first.date);
      if (byDate !== 0) return byDate;
      return (first.title || basename(first.path)).localeCompare(
        second.title || basename(second.path),
      );
    });
  }, [activeProject, data.items, projectImageIdSet]);
  const activeCanvasItemIds = useMemo(
    () => new Set(activeCanvas?.itemIds ?? []),
    [activeCanvas?.itemIds],
  );
  const activeReferences = activeCanvas?.references ?? [];
  const activeNotes = activeCanvas?.notes ?? [];
  const activeEdges = activeCanvas?.edges ?? [];
  const activeStrokes = activeCanvas?.strokes ?? [];
  const activeTexts = activeCanvas?.texts ?? [];

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

  const removeItem = useCallback(
    (itemId: string) => {
      if (!activeCanvas) return;
      updateCanvas(
        activeCanvas.id,
        (canvas) => removeItemFromCanvas(canvas, itemId),
        "Removed",
      );
    },
    [activeCanvas, updateCanvas],
  );

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

  const addNote = useCallback(() => {
    if (!activeCanvas) return;
    const createdAt = new Date().toISOString();
    const note: CanvasNote = {
      id: createId("note"),
      text: "",
      x: 140,
      y: 120,
      createdAt,
      updatedAt: createdAt,
    };
    updateCanvas(
      activeCanvas.id,
      (canvas) => ({ ...canvas, notes: [...canvas.notes, note] }),
      "Note added",
    );
  }, [activeCanvas, updateCanvas]);

  const positionForItem = useCallback(
    (item: FolioItem, index: number): CanvasObjectGeometry => {
      return positionForCanvasItem(item, index, activeCanvas, dragPreview);
    },
    [activeCanvas, dragPreview],
  );

  const positionForReference = useCallback(
    (reference: CanvasReference): CanvasObjectGeometry => {
      return positionForCanvasReference(reference, dragPreview);
    },
    [dragPreview],
  );

  const positionForNote = useCallback(
    (note: CanvasNote): CanvasObjectGeometry => {
      return positionForCanvasNote(note, dragPreview);
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
        activeNotes,
        activeReferences,
        activeTexts,
        dragPreview,
      }),
    [
      activeCanvas,
      activeItems,
      activeNotes,
      activeReferences,
      activeTexts,
      dragPreview,
    ],
  );

  const edgeRenderModels = useMemo(
    () => edgeRenderModelsFromLayouts(activeEdges, canvasObjectLayouts),
    [activeEdges, canvasObjectLayouts],
  );

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
    updateEdgeRelationshipType,
  } = useCanvasEdges({
    activeCanvas,
    canvasObjectLayouts,
    surfacePointFromClient,
    updateCanvas,
  });

  const { startDrag, suppressClickAfterDrag } = useCanvasObjectDrag({
    activeCanvas,
    canvasZoom,
    data,
    saveData,
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

  const addProjectImageToBoard = useCallback(
    (itemId: string) => {
      if (!activeCanvas || activeCanvas.itemIds.includes(itemId)) return;

      updateCanvas(
        activeCanvas.id,
        (canvas) =>
          addItemsToCanvas(canvas, [itemId], centerPositionForCurrentViewport()),
        "Item added to board",
      );
    },
    [activeCanvas, centerPositionForCurrentViewport, updateCanvas],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const editingText =
        target instanceof Element
        && Boolean(target.closest("input, textarea, select"));
      if (editingText) return;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        if (activeStrokes.length) {
          event.preventDefault();
          undoLastStroke();
        }
        return;
      }

      if (
        !selectedEdgeId
        || editingEdgeId
        || (event.key !== "Delete" && event.key !== "Backspace")
        || !activeCanvas
      ) {
        return;
      }

      event.preventDefault();
      deleteEdge(selectedEdgeId);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    activeCanvas,
    activeStrokes.length,
    deleteEdge,
    editingEdgeId,
    selectedEdgeId,
    undoLastStroke,
  ]);

  const canvasPointFromEvent = useCallback((event: React.DragEvent) => {
    const surface = surfaceRef.current;
    if (!surface) return { x: 120, y: 120 };
    const rect = surface.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / canvasZoom - CANVAS_WORLD_ORIGIN,
      y: (event.clientY - rect.top) / canvasZoom - CANVAS_WORLD_ORIGIN,
    };
  }, [canvasZoom]);

  const addReferencesAtPosition = useCallback(
    async (
      filePaths: string[],
      point: CanvasPosition,
      message = "Reference added",
    ) => {
      if (!activeCanvas) return;
      const uniquePaths = Array.from(new Set(filePaths.filter(Boolean)));
      if (!uniquePaths.length) return;

      try {
        const references = await window.folio.copyReference(
          activeCanvas.id,
          uniquePaths,
        );
        const savedAt = new Date().toISOString();
        const placed = references.map((reference, index) => ({
          ...reference,
          capturedAt: reference.capturedAt ?? savedAt,
          updatedAt: savedAt,
          x: point.x + index * 28,
          y: point.y + index * 28,
        }));

        commitData(
          (current) => ({
            ...current,
            canvases: current.canvases.map((canvas) =>
              canvas.id === activeCanvas.id
                ? markCanvasSaved(
                    {
                      ...canvas,
                      references: [...(canvas.references ?? []), ...placed],
                    },
                    savedAt,
                  )
                : canvas,
            ),
          }),
          message,
        );
      } catch (error) {
        console.error(error);
      }
    },
    [activeCanvas, commitData],
  );

  const addProjectImagesAtPosition = useCallback(
    async (filePaths: string[], point: CanvasPosition) => {
      if (!activeCanvas || !activeProjectId || !window.folio.copyToProject) return false;
      const uniquePaths = Array.from(new Set(filePaths.filter(Boolean)));
      const imagePaths = uniquePaths.filter((filePath) =>
        IMAGE_FILE_PATTERN.test(filePath),
      );
      if (!imagePaths.length || imagePaths.length !== uniquePaths.length) return false;

      const imported = await window.folio.copyToProject(activeProjectId, imagePaths);
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

  const importReferencesToBoard = useCallback(async () => {
    if (!activeCanvas) return;
    try {
      const filePaths = await window.folio.openFileDialog();
      await addReferencesAtPosition(
        filePaths,
        centerPositionForCurrentViewport(),
        `${formatCount(filePaths.length, "reference")} added`,
      );
    } catch (error) {
      console.error(error);
    }
  }, [activeCanvas, addReferencesAtPosition, centerPositionForCurrentViewport]);

  const openBoardFolder = useCallback(() => {
    if (!activeCanvas) return;
    const boardFolder = activeProject
      ? `${activeProject.folderPath}/boards/${activeCanvas.id}`
      : `references/${activeCanvas.id}`;
    void window.folio.openInFinder(boardFolder).catch((error) => {
      console.error(error);
    });
  }, [activeCanvas, activeProject]);

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

      if (await addProjectImagesAtPosition(filePaths, canvasPointFromEvent(event))) {
        return;
      }

      await addReferencesAtPosition(filePaths, canvasPointFromEvent(event));
    },
    [
      activeCanvas,
      addDroppedItems,
      addProjectImagesAtPosition,
      addReferencesAtPosition,
      canvasPointFromEvent,
      clearDragState,
    ],
  );

  const handleReferenceDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const updateNote = useCallback(
    (noteId: string, text: string) => {
      if (!activeCanvas) return;
      updateCanvas(activeCanvas.id, (canvas) =>
        updateCanvasNoteText(canvas, noteId, text),
      );
    },
    [activeCanvas, updateCanvas],
  );

  const deleteNote = useCallback(
    (noteId: string) => {
      if (!activeCanvas) return;
      updateCanvas(
        activeCanvas.id,
        (canvas) => deleteCanvasNote(canvas, noteId),
        "Note deleted",
      );
    },
    [activeCanvas, updateCanvas],
  );

  const updateTextElement = useCallback(
    (textElementId: string, text: string) => {
      if (!activeCanvas) return;
      updateCanvas(activeCanvas.id, (canvas) =>
        updateCanvasTextElementText(canvas, textElementId, text),
      );
    },
    [activeCanvas, updateCanvas],
  );

  const updateTextElementSize = useCallback(
    (textElementId: string, size: CanvasTextSize) => {
      if (!activeCanvas) return;
      updateCanvas(
        activeCanvas.id,
        (canvas) => updateCanvasTextElementSize(canvas, textElementId, size),
        "Text size updated",
      );
    },
    [activeCanvas, updateCanvas],
  );

  const deleteTextElement = useCallback(
    (textElementId: string) => {
      if (!activeCanvas) return;
      updateCanvas(
        activeCanvas.id,
        (canvas) => deleteCanvasTextElement(canvas, textElementId),
        "Text deleted",
      );
    },
    [activeCanvas, updateCanvas],
  );

  const removeReference = useCallback(
    (referenceId: string) => {
      if (!activeCanvas) return;
      updateCanvas(
        activeCanvas.id,
        (canvas) => removeCanvasReference(canvas, referenceId),
        "Reference removed",
      );
    },
    [activeCanvas, updateCanvas],
  );

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

  const createBoardFromBrowser = useCallback(() => {
    onCreateBoard();
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
        <CanvasBoardHeader
          activeCanvas={activeCanvas}
          activeStrokeCount={activeStrokes.length}
          activeTool={activeTool}
          boardColorDraft={boardColorDraft}
          boardTitleDraft={boardTitleDraft}
          boardToolsOpen={boardToolsOpen}
          onActiveToolChange={setActiveTool}
          onAddNote={addNote}
          onBackToBoards={() => setBoardBrowserOpen(true)}
          onBoardColorDraftChange={setBoardColorDraft}
          onBoardTitleDraftChange={setBoardTitleDraft}
          onDeleteBoard={deleteBoard}
          onImportImages={importToBoard}
          onImportReferences={importReferencesToBoard}
          onOpenBoardFolder={openBoardFolder}
          onSaveBoardSettings={saveBoardSettingsForCanvas}
          onToggleBoardTools={() => setBoardToolsOpen((current) => !current)}
          onUndoStroke={undoLastStroke}
        />

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
          onDrop={handleReferenceDrop}
          onDragOver={handleReferenceDragOver}
          onSurfacePointerDown={handleSurfacePointerDown}
          onSurfacePointerMove={handleSurfacePointerMove}
          onSurfacePointerLeave={hideToolCursor}
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
            selectedEdgeId={selectedEdgeId}
            onDeleteEdge={deleteEdge}
            onEdgeLabelDraftChange={setEdgeLabelDraft}
            onReverseEdgeDirection={reverseEdgeDirection}
            onSaveEdgeLabel={saveEdgeLabel}
            onSelectEdge={setSelectedEdgeId}
            onStartEdgeLabelEdit={startEdgeLabelEdit}
            onStopEdgeLabelEdit={stopEdgeLabelEdit}
            onUpdateEdgeDirection={updateEdgeDirection}
            onUpdateEdgeRelationshipType={updateEdgeRelationshipType}
          />

          <CanvasToolCursor
            activeTool={activeTool}
            position={toolCursorPosition}
          />

          <CanvasObjectLayer
            activeItems={activeItems}
            activeNotes={activeNotes}
            activeReferences={activeReferences}
            activeTexts={activeTexts}
            thumbUrls={thumbUrls}
            setThumbUrls={setThumbUrls}
            positionForItem={positionForItem}
            positionForNote={positionForNote}
            positionForReference={positionForReference}
            positionForText={positionForText}
            onDeleteNote={deleteNote}
            onDeleteTextElement={deleteTextElement}
            onOpenItem={onOpenItem}
            onRemoveItem={removeItem}
            onRemoveReference={removeReference}
            onStartConnectorDrag={startConnectorDrag}
            onStartDrag={startDrag}
            onStartResize={startResize}
            onSuppressClickAfterDrag={suppressClickAfterDrag}
            onUpdateNote={updateNote}
            onUpdateTextElement={updateTextElement}
            onUpdateTextElementSize={updateTextElementSize}
          />
        </CanvasViewport>
      </div>
      <aside className="canvas-project-image-tray" aria-label="Project images">
        <header className="canvas-project-image-tray-header">
          <strong>Project images</strong>
          <span>{formatCount(projectImages.length, "image")}</span>
        </header>
        {projectImages.length ? (
          <div className="canvas-project-image-list">
            {projectImages.map((item) => {
              const itemTitle = item.title || basename(item.path);
              const alreadyAdded = activeCanvasItemIds.has(item.id);
              const actionLabel = alreadyAdded
                ? `${itemTitle} is already on this board`
                : item.missing
                  ? `${itemTitle} is missing`
                  : `Add ${itemTitle} to board`;

              return (
                <article
                  className={`canvas-project-image-card ${
                    alreadyAdded ? "canvas-project-image-card-added" : ""
                  }`}
                  key={item.id}
                >
                  <button
                    className="canvas-project-image-preview"
                    type="button"
                    aria-label={`Open ${itemTitle}`}
                    onDoubleClick={() => onOpenItem(item.id)}
                  >
                    <LazyThumbnail
                      item={item}
                      thumbUrls={thumbUrls}
                      setThumbUrls={setThumbUrls}
                    />
                  </button>
                  <div className="canvas-project-image-meta">
                    <strong title={itemTitle}>{itemTitle}</strong>
                    <button
                      className="secondary-action canvas-project-image-add-button"
                      type="button"
                      aria-label={actionLabel}
                      disabled={alreadyAdded || item.missing}
                      onClick={() => addProjectImageToBoard(item.id)}
                    >
                      <ButtonIcon icon={alreadyAdded ? Check : Plus} />
                      {alreadyAdded ? "Added" : item.missing ? "Missing" : "Add"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="canvas-project-image-empty">
            Import images to this project to add them to boards.
          </p>
        )}
      </aside>
    </section>
  );
}
