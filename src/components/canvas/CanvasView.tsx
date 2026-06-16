import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Edit3, ImagePlus, Save, StickyNote, Trash2, X } from "lucide-react";
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
  CANVAS_MIN_ZOOM,
  CANVAS_MAX_ZOOM,
  CANVAS_WORLD_HEIGHT,
  CANVAS_WORLD_ORIGIN,
  CANVAS_WORLD_WIDTH,
  ITEM_DRAG_MIME,
} from "../folio/constants";
import type { DataUpdater, ItemDetailsOpenHandler } from "../folio/types";
import {
  addItemToCanvas,
  addItemsToCanvas,
  clampNumber,
  createId,
  formatCount,
  mergeItems,
} from "../folio/model";
import { ButtonIcon } from "../shared/ButtonIcon";
import { LazyThumbnail } from "../shared/LazyThumbnail";
import { CanvasItemCard, CanvasNoteCard, ReferenceCard } from "./CanvasCards";

export function CanvasView({
  data,
  activeCanvasId,
  setActiveCanvasId,
  onOpenItem,
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
  const boardStripRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const zoomAnchorRef = useRef<{ x: number; y: number } | null>(null);
  const [dragPreview, setDragPreview] = useState<{
    id: string;
    kind: "item" | "reference";
    position: CanvasPosition;
  } | null>(null);
  const [boardToolsOpen, setBoardToolsOpen] = useState(false);
  const [boardTitleDraft, setBoardTitleDraft] = useState("");
  const [canvasZoom, setCanvasZoom] = useState(1);
  const canvasZoomRef = useRef(1);
  const [isCanvasPanning, setIsCanvasPanning] = useState(false);

  useEffect(() => {
    if (!activeCanvas && data.canvases[0]) {
      setActiveCanvasId(data.canvases[0].id);
    }
  }, [activeCanvas, data.canvases, setActiveCanvasId]);

  useEffect(() => {
    setBoardTitleDraft(activeCanvas?.title ?? "");
    setBoardToolsOpen(false);
  }, [activeCanvas?.id, activeCanvas?.title]);

  useEffect(() => {
    if (!activeCanvas) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const scroll = scrollRef.current;
      if (!scroll) return;
      scroll.scrollLeft = CANVAS_WORLD_ORIGIN * canvasZoom - 80 * canvasZoom;
      scroll.scrollTop = CANVAS_WORLD_ORIGIN * canvasZoom - 80 * canvasZoom;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeCanvas?.id]);

  const activeItems = useMemo(
    () =>
      activeCanvas
        ? activeCanvas.itemIds
            .map((itemId) => data.items.find((item) => item.id === itemId))
            .filter(Boolean) as FolioItem[]
        : [],
    [activeCanvas, data.items],
  );

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

  const deleteBoard = useCallback(() => {
    if (!activeCanvas) return;
    const confirmed = window.confirm(`Delete board "${activeCanvas.title}"?`);
    if (!confirmed) return;

    let nextActiveCanvasId: string | null = null;
    commitData(
      (current) => {
        const boardIndex = current.canvases.findIndex(
          (canvas) => canvas.id === activeCanvas.id,
        );
        if (boardIndex === -1) return current;

        const nextCanvases = current.canvases.filter(
          (canvas) => canvas.id !== activeCanvas.id,
        );
        nextActiveCanvasId =
          nextCanvases[Math.min(boardIndex, nextCanvases.length - 1)]?.id ?? null;

        return {
          ...current,
          canvases: nextCanvases,
        };
      },
      "Board deleted",
    );

    setActiveCanvasId(nextActiveCanvasId);
    setBoardToolsOpen(false);
  }, [activeCanvas, commitData, setActiveCanvasId]);

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
            x: startPosition.x + (moveEvent.clientX - startPointer.x) / canvasZoom,
            y: startPosition.y + (moveEvent.clientY - startPointer.y) / canvasZoom,
          },
        });
      };

      const onPointerUp = (upEvent: PointerEvent) => {
        const finalPosition = {
          x: startPosition.x + (upEvent.clientX - startPointer.x) / canvasZoom,
          y: startPosition.y + (upEvent.clientY - startPointer.y) / canvasZoom,
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
    [activeCanvas, canvasZoom, data, saveData],
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

  const startCanvasPan = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (
        target.closest(
          ".canvas-card, .canvas-note, button, input, textarea, select, [data-no-canvas-pan]",
        )
      ) {
        return;
      }

      const scroll = scrollRef.current;
      if (!scroll) return;

      event.preventDefault();
      const startPointer = { x: event.clientX, y: event.clientY };
      const startScroll = {
        left: scroll.scrollLeft,
        top: scroll.scrollTop,
      };
      const previousCursor = document.body.style.cursor;
      const previousUserSelect = document.body.style.userSelect;
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
      setIsCanvasPanning(true);

      const onPointerMove = (moveEvent: PointerEvent) => {
        scroll.scrollLeft = startScroll.left - (moveEvent.clientX - startPointer.x);
        scroll.scrollTop = startScroll.top - (moveEvent.clientY - startPointer.y);
      };

      const onPointerUp = () => {
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        setIsCanvasPanning(false);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [],
  );

  const rememberZoomAnchor = useCallback((clientX: number, clientY: number) => {
    const scroll = scrollRef.current;
    if (!scroll) return;

    const rect = scroll.getBoundingClientRect();
    zoomAnchorRef.current = {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }, []);

  const handleCanvasWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const wheelDelta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
      if (wheelDelta === 0) return;

      const scroll = scrollRef.current;
      if (!scroll) return;

      const currentZoom = canvasZoomRef.current;
      const rect = scroll.getBoundingClientRect();
      const eventAnchor = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      const eventIsInsideCanvas =
        event.clientX >= rect.left
        && event.clientX <= rect.right
        && event.clientY >= rect.top
        && event.clientY <= rect.bottom;
      const anchor = eventIsInsideCanvas
        ? eventAnchor
        : zoomAnchorRef.current ?? {
            x: rect.width / 2,
            y: rect.height / 2,
          };

      const pointerX = clampNumber(anchor.x, 0, rect.width);
      const pointerY = clampNumber(anchor.y, 0, rect.height);
      zoomAnchorRef.current = { x: pointerX, y: pointerY };

      const logicalX = (scroll.scrollLeft + pointerX) / currentZoom;
      const logicalY = (scroll.scrollTop + pointerY) / currentZoom;
      const zoomMultiplier = Math.exp(-wheelDelta * 0.0016);
      const nextZoom = clampNumber(
        currentZoom * zoomMultiplier,
        CANVAS_MIN_ZOOM,
        CANVAS_MAX_ZOOM,
      );

      if (nextZoom === currentZoom) return;

      canvasZoomRef.current = nextZoom;
      flushSync(() => {
        setCanvasZoom(nextZoom);
      });
      scroll.scrollLeft = logicalX * nextZoom - pointerX;
      scroll.scrollTop = logicalY * nextZoom - pointerY;
    },
    [],
  );

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

  const saveBoardTitle = useCallback(() => {
    if (!activeCanvas) return;
    const trimmed = boardTitleDraft.trim();
    if (!trimmed) {
      setBoardTitleDraft(activeCanvas.title);
      return;
    }
    renameCanvas(trimmed);
    setBoardTitleDraft(trimmed);
  }, [activeCanvas, boardTitleDraft, renameCanvas]);

  const openCanvas = useCallback(
    (canvasId: string) => {
      setActiveCanvasId(canvasId);
    },
    [setActiveCanvasId],
  );

  const handleBoardStripWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      const strip = boardStripRef.current;
      if (!strip || strip.scrollWidth <= strip.clientWidth) return;

      const horizontalDelta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY;
      if (!horizontalDelta) return;

      event.preventDefault();
      strip.scrollLeft += horizontalDelta;
    },
    [],
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
      </section>
    );
  }

  return (
    <section className="canvas-workspace">
      <div
        className="canvas-board-strip"
        ref={boardStripRef}
        onWheel={handleBoardStripWheel}
      >
        <div className="canvas-list">
          {data.canvases.map((canvas) => {
            const memberItems = canvas.itemIds
              .map((itemId) => data.items.find((item) => item.id === itemId))
              .filter(Boolean) as FolioItem[];
            return (
              <button
                className={`canvas-list-item ${
                  canvas.id === activeCanvas.id ? "active" : ""
                }`}
                key={canvas.id}
                type="button"
                onClick={() => openCanvas(canvas.id)}
              >
                <span className="canvas-row">
                  <span
                    className="canvas-row-dot"
                    style={{ background: canvas.color }}
                  />
                  <span className="canvas-row-copy">
                    <strong>{canvas.title}</strong>
                    <small>{formatCount(canvas.itemIds.length, "item")}</small>
                  </span>
                </span>
                <span className="canvas-member-grid">
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
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="canvas-panel" key={activeCanvas.id}>
        <header className="canvas-board-header">
          <div className="canvas-board-summary">
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
          <button
            className="canvas-board-edit-button"
            type="button"
            onClick={() => setBoardToolsOpen((current) => !current)}
            aria-expanded={boardToolsOpen}
          >
            <ButtonIcon icon={Edit3} />
            Edit
          </button>

          {boardToolsOpen ? (
            <div className="board-edit-popover" role="dialog" aria-label="Edit board">
              <label>
                <span>Board name</span>
                <input
                  value={boardTitleDraft}
                  onChange={(event) => setBoardTitleDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      saveBoardTitle();
                    }
                  }}
                />
              </label>
              <div className="board-edit-popover-actions">
                <button
                  className="board-edit-save"
                  type="button"
                  onClick={saveBoardTitle}
                >
                  <ButtonIcon icon={Save} />
                  Save name
                </button>
                <button type="button" onClick={addNote}>
                  <ButtonIcon icon={StickyNote} />
                  Add note
                </button>
                <button type="button" onClick={importToBoard}>
                  <ButtonIcon icon={ImagePlus} />
                  Import to board
                </button>
                <button
                  className="board-edit-delete"
                  type="button"
                  onClick={deleteBoard}
                >
                  <ButtonIcon icon={Trash2} />
                  Delete board
                </button>
                <button
                  className="icon-button board-edit-close"
                  type="button"
                  onClick={() => setBoardToolsOpen(false)}
                  aria-label="Close board tools"
                  title="Close board tools"
                >
                  <ButtonIcon icon={X} />
                </button>
              </div>
            </div>
          ) : null}
        </header>

        <div
          className={`canvas-scroll ${isCanvasPanning ? "canvas-panning" : ""}`}
          ref={scrollRef}
          onPointerDown={startCanvasPan}
          onPointerMove={(event) => rememberZoomAnchor(event.clientX, event.clientY)}
          onWheelCapture={handleCanvasWheel}
        >
          <div
            className="canvas-zoom-layer"
            style={{
              width: CANVAS_WORLD_WIDTH * canvasZoom,
              height: CANVAS_WORLD_HEIGHT * canvasZoom,
            }}
          >
            <div
              className="canvas-surface"
              ref={surfaceRef}
              style={{
                width: CANVAS_WORLD_WIDTH,
                height: CANVAS_WORLD_HEIGHT,
                transform: `scale(${canvasZoom})`,
              }}
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
      </div>
    </section>
  );
}
