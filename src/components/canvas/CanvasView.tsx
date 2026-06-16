import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Edit3,
  Ellipsis,
  ImagePlus,
  Minimize2,
  Plus,
  Save,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import type {
  Canvas,
  CanvasNote,
  CanvasPosition,
  CanvasReference,
  FolioData,
  FolioItem,
  ThumbnailUrls,
} from "../../types";
import {
  CANVAS_COLORS,
  CANVAS_WORLD_ORIGIN,
  ITEM_DRAG_MIME,
} from "../folio/constants";
import type { DataUpdater, ItemDetailsOpenHandler } from "../folio/types";
import {
  addItemToCanvas,
  addItemsToCanvas,
  createId,
  formatCount,
  mergeItems,
} from "../folio/model";
import { chooseAndImportItems } from "../folio/importing";
import { ButtonIcon } from "../shared/ButtonIcon";
import { LazyThumbnail } from "../shared/LazyThumbnail";
import { CanvasItemCard, CanvasNoteCard, ReferenceCard } from "./CanvasCards";
import { CanvasViewport } from "./CanvasViewport";

type CanvasDragKind = "item" | "reference" | "note";
const CANVAS_OBJECT_DRAG_THRESHOLD = 4;
const BOARD_BROWSER_PREVIEW_LIMIT = 3;

export function CanvasView({
  data,
  activeCanvasId,
  setActiveCanvasId,
  onOpenItem,
  onCreateBoard,
  onMinimize,
  thumbUrls,
  setThumbUrls,
  commitData,
  saveData,
  clearDragState,
}: {
  data: FolioData;
  activeCanvasId: string | null;
  setActiveCanvasId: React.Dispatch<React.SetStateAction<string | null>>;
  onOpenItem: ItemDetailsOpenHandler;
  onCreateBoard: () => void;
  onMinimize: () => void;
  thumbUrls: ThumbnailUrls;
  setThumbUrls: React.Dispatch<React.SetStateAction<ThumbnailUrls>>;
  commitData: (updater: DataUpdater, message?: string) => void;
  saveData: (data: FolioData, message?: string) => void;
  clearDragState: () => void;
}) {
  const activeCanvas =
    data.canvases.find((canvas) => canvas.id === activeCanvasId) ??
    data.canvases[0] ??
    null;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const [dragPreview, setDragPreview] = useState<{
    id: string;
    kind: CanvasDragKind;
    position: CanvasPosition;
  } | null>(null);
  const [boardToolsOpen, setBoardToolsOpen] = useState(false);
  const [boardBrowserOpen, setBoardBrowserOpen] = useState(false);
  const [boardMenuCanvasId, setBoardMenuCanvasId] = useState<string | null>(null);
  const [browserEditCanvasId, setBrowserEditCanvasId] = useState<string | null>(
    null,
  );
  const [boardDropCanvasId, setBoardDropCanvasId] = useState<string | null>(null);
  const [boardTitleDraft, setBoardTitleDraft] = useState("");
  const [boardColorDraft, setBoardColorDraft] = useState(CANVAS_COLORS[0]);
  const [canvasZoom, setCanvasZoom] = useState(1);
  const canvasZoomRef = useRef(1);
  const draggedObjectRef = useRef<{ kind: CanvasDragKind; id: string } | null>(
    null,
  );

  const focusCanvasOrigin = useCallback(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const zoom = canvasZoomRef.current;
    scroll.scrollLeft = CANVAS_WORLD_ORIGIN * zoom - 80 * zoom;
    scroll.scrollTop = CANVAS_WORLD_ORIGIN * zoom - 80 * zoom;
  }, []);

  useEffect(() => {
    if (!activeCanvas && data.canvases[0]) {
      setActiveCanvasId(data.canvases[0].id);
    }
  }, [activeCanvas, data.canvases, setActiveCanvasId]);

  useEffect(() => {
    setBoardTitleDraft(activeCanvas?.title ?? "");
    setBoardColorDraft(activeCanvas?.color ?? CANVAS_COLORS[0]);
    setBoardToolsOpen(false);
  }, [activeCanvas?.color, activeCanvas?.id, activeCanvas?.title]);

  useEffect(() => {
    setBoardBrowserOpen(false);
  }, [activeCanvas?.id]);

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
    if (!activeCanvas) return undefined;
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
  }, [activeCanvas?.id, focusCanvasOrigin]);

  const itemsById = useMemo(
    () => new Map(data.items.map((item) => [item.id, item])),
    [data.items],
  );

  const activeItems = useMemo(
    () =>
      activeCanvas
        ? activeCanvas.itemIds
            .map((itemId) => itemsById.get(itemId))
            .filter(Boolean) as FolioItem[]
        : [],
    [activeCanvas, itemsById],
  );

  const browserEditCanvas =
    data.canvases.find((canvas) => canvas.id === browserEditCanvasId) ?? null;

  const boardPreviewItemIds = useMemo(
    () =>
      boardBrowserOpen
        ? Array.from(
            new Set(
              data.canvases.flatMap((canvas) =>
                canvas.itemIds.slice(0, BOARD_BROWSER_PREVIEW_LIMIT),
              ),
            ),
          )
        : [],
    [boardBrowserOpen, data.canvases],
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

    try {
      const imported = await chooseAndImportItems();
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

  const deleteBoardById = useCallback(
    (canvasId: string) => {
      const canvasToDelete = data.canvases.find((canvas) => canvas.id === canvasId);
      if (!canvasToDelete) return;

      const confirmed = window.confirm(`Delete board "${canvasToDelete.title}"?`);
      if (!confirmed) return;

      let nextActiveCanvasId: string | null = null;
      commitData(
        (current) => {
          const boardIndex = current.canvases.findIndex(
            (canvas) => canvas.id === canvasId,
          );
          if (boardIndex === -1) return current;

          const nextCanvases = current.canvases.filter(
            (canvas) => canvas.id !== canvasId,
          );
          nextActiveCanvasId = nextCanvases.some(
            (canvas) => canvas.id === activeCanvasId,
          )
            ? activeCanvasId
            : nextCanvases[Math.min(boardIndex, nextCanvases.length - 1)]?.id ??
              null;

          return {
            ...current,
            canvases: nextCanvases,
          };
        },
        "Board deleted",
      );

      setActiveCanvasId(nextActiveCanvasId);
      setBoardToolsOpen(false);
      setBoardMenuCanvasId(null);
      if (!nextActiveCanvasId) {
        setBoardBrowserOpen(true);
      }
    },
    [activeCanvasId, commitData, data.canvases, setActiveCanvasId],
  );

  const deleteBoard = useCallback(() => {
    if (!activeCanvas) return;
    deleteBoardById(activeCanvas.id);
  }, [activeCanvas, deleteBoardById]);

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

  const positionForNote = useCallback(
    (note: CanvasNote): CanvasPosition => {
      if (dragPreview?.kind === "note" && dragPreview.id === note.id) {
        return dragPreview.position;
      }
      return { x: note.x, y: note.y };
    },
    [dragPreview],
  );

  const startDrag = useCallback(
    (
      event: React.PointerEvent,
      kind: CanvasDragKind,
      objectId: string,
      startPosition: CanvasPosition,
    ) => {
      if (!activeCanvas) return;
      if (event.button !== 0) return;

      const startPointer = { x: event.clientX, y: event.clientY };
      const previousCursor = document.body.style.cursor;
      const previousUserSelect = document.body.style.userSelect;
      let isDragging = false;

      const positionFromPointer = (clientX: number, clientY: number) => ({
        x: startPosition.x + (clientX - startPointer.x) / canvasZoom,
        y: startPosition.y + (clientY - startPointer.y) / canvasZoom,
      });

      const commitPosition = (finalPosition: CanvasPosition) => {
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
            if (kind === "reference") {
              return {
                ...canvas,
                references: canvas.references.map((reference) =>
                  reference.id === objectId
                    ? { ...reference, ...finalPosition }
                    : reference,
                ),
              };
            }
            return {
              ...canvas,
              notes: canvas.notes.map((note) =>
                note.id === objectId ? { ...note, ...finalPosition } : note,
              ),
            };
          }),
        };

        saveData(nextData, "Position saved");
      };

      const onPointerMove = (moveEvent: PointerEvent) => {
        const deltaX = moveEvent.clientX - startPointer.x;
        const deltaY = moveEvent.clientY - startPointer.y;
        if (!isDragging) {
          const distance = Math.hypot(deltaX, deltaY);
          if (distance < CANVAS_OBJECT_DRAG_THRESHOLD) return;

          isDragging = true;
          draggedObjectRef.current = { kind, id: objectId };
          document.body.style.cursor = "grabbing";
          document.body.style.userSelect = "none";
        }

        moveEvent.preventDefault();
        setDragPreview({
          id: objectId,
          kind,
          position: positionFromPointer(moveEvent.clientX, moveEvent.clientY),
        });
      };

      const onPointerUp = (upEvent: PointerEvent) => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);

        if (!isDragging) return;

        upEvent.preventDefault();
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        setDragPreview(null);
        commitPosition(positionFromPointer(upEvent.clientX, upEvent.clientY));
        window.setTimeout(() => {
          if (
            draggedObjectRef.current?.kind === kind
            && draggedObjectRef.current.id === objectId
          ) {
            draggedObjectRef.current = null;
          }
        }, 0);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [activeCanvas, canvasZoom, data, saveData],
  );

  const suppressClickAfterDrag = useCallback(
    (
      event: React.MouseEvent,
      kind: CanvasDragKind,
      objectId: string,
    ) => {
      if (
        draggedObjectRef.current?.kind !== kind
        || draggedObjectRef.current.id !== objectId
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      draggedObjectRef.current = null;
    },
    [],
  );

  const canvasPointFromEvent = useCallback((event: React.DragEvent) => {
    const surface = surfaceRef.current;
    if (!surface) return { x: 120, y: 120 };
    const rect = surface.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / canvasZoom - CANVAS_WORLD_ORIGIN,
      y: (event.clientY - rect.top) / canvasZoom - CANVAS_WORLD_ORIGIN,
    };
  }, [canvasZoom]);

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
      const canvasToEdit = data.canvases.find((canvas) => canvas.id === canvasId);
      if (!canvasToEdit) return;

      setBoardMenuCanvasId(null);
      setBoardTitleDraft(canvasToEdit.title);
      setBoardColorDraft(canvasToEdit.color ?? CANVAS_COLORS[0]);
      setBrowserEditCanvasId(canvasId);
    },
    [data.canvases],
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
        const validItemIds = itemIds.filter((itemId) => knownItemIds.has(itemId));
        if (!validItemIds.length) return;

        commitData(
          (current) => ({
            ...current,
            canvases: current.canvases.map((canvas) =>
              canvas.id === canvasId
                ? addItemsToCanvas(canvas, validItemIds)
                : canvas,
            ),
          }),
          `${formatCount(validItemIds.length, "item")} added to board`,
        );
      } catch (error) {
        console.error(error);
      }
    },
    [clearDragState, commitData, data.items],
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

  const renderBoardEditDialog = (
    canvasToEdit: Canvas,
    {
      className = "",
      onClose,
      onDelete,
    }: {
      className?: string;
      onClose: () => void;
      onDelete: () => void;
    },
  ) => (
    <div
      className={`board-edit-popover ${className}`.trim()}
      role="dialog"
      aria-label="Edit board"
    >
      <div className="board-edit-popover-header">
        <strong>Edit board</strong>
        <button
          className="icon-button board-edit-close"
          type="button"
          onClick={onClose}
          aria-label="Close board tools"
          title="Close board tools"
        >
          <ButtonIcon icon={X} />
        </button>
      </div>
      <label>
        <span>Board name</span>
        <input
          value={boardTitleDraft}
          onChange={(event) => setBoardTitleDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              saveBoardSettingsForCanvas(canvasToEdit);
            }
          }}
        />
      </label>
      <label className="board-color-field">
        <span>Board color</span>
        <span className="board-color-control">
          <input
            type="color"
            aria-label="Board color"
            value={boardColorDraft}
            onChange={(event) => setBoardColorDraft(event.target.value)}
          />
          <small>{boardColorDraft}</small>
        </span>
      </label>
      <div
        className="board-edit-action-bar"
        role="toolbar"
        aria-label="Board actions"
      >
        <button
          className="board-edit-save"
          type="button"
          onClick={() => saveBoardSettingsForCanvas(canvasToEdit)}
        >
          <ButtonIcon icon={Save} />
          Save board
        </button>
        <button
          className="board-edit-action board-edit-delete"
          type="button"
          onClick={onDelete}
          aria-label="Delete board"
          title="Delete board"
        >
          <ButtonIcon icon={Trash2} />
        </button>
      </div>
    </div>
  );

  const renderBoardBrowser = () => (
    <section className="canvas-workspace canvas-board-browser">
      <header className="canvas-board-browser-header">
        <div className="canvas-board-browser-copy">
          <strong>Boards</strong>
          <span>{formatCount(data.canvases.length, "board")}</span>
        </div>
        <div className="canvas-board-browser-actions">
          <button
            className="secondary-action canvas-board-new-button"
            type="button"
            onClick={createBoardFromBrowser}
          >
            <ButtonIcon icon={Plus} />
            New board
          </button>
          <button
            className="icon-button canvas-board-minimize-button"
            type="button"
            aria-label="Minimize board panel"
            title="Minimize board panel"
            onClick={onMinimize}
          >
            <ButtonIcon icon={Minimize2} />
          </button>
        </div>
      </header>

      {data.canvases.length ? (
        <div className="canvas-board-grid">
          {data.canvases.map((canvas) => {
            const memberItems = canvas.itemIds
              .map((itemId) => itemsById.get(itemId))
              .filter(Boolean) as FolioItem[];
            const previewItems = memberItems.slice(0, BOARD_BROWSER_PREVIEW_LIMIT);
            const previewCount = Math.min(
              previewItems.length,
              BOARD_BROWSER_PREVIEW_LIMIT,
            );
            return (
              <article
                className={`canvas-board-tile ${
                  canvas.id === activeCanvas?.id ? "active" : ""
                } ${
                  boardDropCanvasId === canvas.id ? "canvas-board-tile-drop-target" : ""
                }`}
                key={canvas.id}
                onDragOver={(event) => handleBoardTileDragOver(event, canvas.id)}
                onDragLeave={(event) => handleBoardTileDragLeave(event, canvas.id)}
                onDrop={(event) => addDraggedItemsToBoard(event, canvas.id)}
              >
                <button
                  className="canvas-board-open-button"
                  type="button"
                  aria-label={`Open ${canvas.title}, ${formatCount(
                    canvas.itemIds.length,
                    "item",
                  )}`}
                  onClick={() => openCanvas(canvas.id)}
                >
                  <span
                    className={`canvas-board-cover canvas-board-cover-${previewCount}`}
                  >
                    {previewItems.length ? (
                      previewItems.map((item, index) => (
                        <span
                          className={`canvas-board-cover-slot canvas-board-cover-slot-${
                            index + 1
                          }`}
                          key={item.id}
                        >
                          <LazyThumbnail
                            item={item}
                            thumbUrls={thumbUrls}
                            setThumbUrls={setThumbUrls}
                            requestThumbnail={false}
                          />
                        </span>
                      ))
                    ) : (
                      <span className="canvas-board-cover-empty">
                        <span
                          className="canvas-board-cover-dot"
                          style={{ background: canvas.color }}
                        />
                      </span>
                    )}
                  </span>
                  <span className="canvas-board-tile-meta">
                    <span className="canvas-board-tile-title">
                      <span
                        className="canvas-board-tile-dot"
                        style={{ background: canvas.color }}
                      />
                      <strong title={canvas.title}>{canvas.title}</strong>
                    </span>
                    <small>{formatCount(canvas.itemIds.length, "item")}</small>
                  </span>
                </button>
                <span
                  className={`canvas-board-menu ${
                    boardMenuCanvasId === canvas.id ? "canvas-board-menu-open" : ""
                  }`}
                >
                  <button
                    className="icon-button canvas-board-menu-button"
                    type="button"
                    aria-label={`More actions for ${canvas.title}`}
                    aria-haspopup="menu"
                    aria-expanded={boardMenuCanvasId === canvas.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      setBoardMenuCanvasId((current) =>
                        current === canvas.id ? null : canvas.id,
                      );
                    }}
                  >
                    <ButtonIcon icon={Ellipsis} />
                  </button>
                  {boardMenuCanvasId === canvas.id ? (
                    <span
                      className="canvas-board-menu-popover"
                      role="menu"
                      aria-label={`Actions for ${canvas.title}`}
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={(event) => {
                          event.stopPropagation();
                          editCanvasFromBrowser(canvas.id);
                        }}
                      >
                        <ButtonIcon icon={Edit3} />
                        Edit
                      </button>
                      <button
                        className="danger-menu-item"
                        type="button"
                        role="menuitem"
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteBoardById(canvas.id);
                        }}
                      >
                        <ButtonIcon icon={Trash2} />
                        Delete
                      </button>
                    </span>
                  ) : null}
                </span>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="canvas-empty">
          <div className="canvas-board-preview">
            <div className="board-node board-node-a" />
            <div className="board-node board-node-b" />
            <div className="board-node board-node-c" />
            <svg viewBox="0 0 460 240" aria-hidden="true">
              <path d="M116 92 C170 54, 242 70, 310 116" />
              <path d="M164 164 C226 186, 292 178, 346 142" />
            </svg>
          </div>
        </div>
      )}

      {browserEditCanvas
        ? renderBoardEditDialog(browserEditCanvas, {
            className: "board-edit-browser-dialog",
            onClose: () => setBrowserEditCanvasId(null),
            onDelete: () => {
              deleteBoardById(browserEditCanvas.id);
              setBrowserEditCanvasId(null);
            },
          })
        : null}
    </section>
  );

  if (!activeCanvas || boardBrowserOpen) {
    return renderBoardBrowser();
  }

  return (
    <section className="canvas-workspace">
      <div className="canvas-panel" key={activeCanvas.id}>
        <header className="canvas-board-header">
          <div className="canvas-board-summary">
            <button
              className="canvas-board-back-button"
              type="button"
              aria-label="Boards"
              title="Boards"
              onClick={() => setBoardBrowserOpen(true)}
            >
              <ButtonIcon icon={ArrowLeft} />
            </button>
            <span className="canvas-dot" style={{ background: activeCanvas.color }} />
            <span className="canvas-board-copy">
              <strong>{activeCanvas.title}</strong>
              <span>
                {formatCount(activeCanvas.itemIds.length, "item")} ·{" "}
                {formatCount(activeCanvas.notes.length, "note")} ·{" "}
                {formatCount(activeCanvas.references.length, "reference")}
              </span>
            </span>
          </div>
          <div className="canvas-board-actions">
            <button
              className="canvas-board-action-button"
              type="button"
              aria-label="Add note"
              title="Add note"
              onClick={addNote}
            >
              <ButtonIcon icon={StickyNote} />
            </button>
            <button
              className="canvas-board-action-button"
              type="button"
              aria-label="Import images"
              title="Import images"
              onClick={importToBoard}
            >
              <ButtonIcon icon={ImagePlus} />
            </button>
            <button
              className="canvas-board-edit-button"
              type="button"
              onClick={() => setBoardToolsOpen((current) => !current)}
              aria-expanded={boardToolsOpen}
            >
              <ButtonIcon icon={Edit3} />
              Edit
            </button>
            <button
              className="icon-button canvas-board-minimize-button"
              type="button"
              aria-label="Minimize board panel"
              title="Minimize board panel"
              onClick={onMinimize}
            >
              <ButtonIcon icon={Minimize2} />
            </button>
          </div>

          {boardToolsOpen && activeCanvas
            ? renderBoardEditDialog(activeCanvas, {
                onClose: () => setBoardToolsOpen(false),
                onDelete: deleteBoard,
              })
            : null}
        </header>

        <CanvasViewport
          zoom={canvasZoom}
          zoomRef={canvasZoomRef}
          onZoomChange={setCanvasZoom}
          scrollRef={scrollRef}
          surfaceRef={surfaceRef}
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
                onOpen={onOpenItem}
                onRemove={removeItem}
                onPointerDown={(event) =>
                  startDrag(event, "item", item.id, position)
                }
                onClickCapture={(event) =>
                  suppressClickAfterDrag(event, "item", item.id)
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
                onClickCapture={(event) =>
                  suppressClickAfterDrag(event, "reference", reference.id)
                }
              />
            );
          })}

          {activeCanvas.notes.map((note) => (
            <CanvasNoteCard
              key={note.id}
              note={{ ...note, ...positionForNote(note) }}
              onChange={updateNote}
              onDelete={deleteNote}
              onPointerDown={(event) =>
                startDrag(event, "note", note.id, positionForNote(note))
              }
              onClickCapture={(event) =>
                suppressClickAfterDrag(event, "note", note.id)
              }
            />
          ))}
        </CanvasViewport>
      </div>
    </section>
  );
}
