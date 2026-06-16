import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Edit3,
  ImagePlus,
  PanelRightClose,
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
import { ButtonIcon } from "../shared/ButtonIcon";
import { LazyThumbnail } from "../shared/LazyThumbnail";
import { CanvasItemCard, CanvasNoteCard, ReferenceCard } from "./CanvasCards";
import { CanvasViewport } from "./CanvasViewport";

type CanvasDragKind = "item" | "reference" | "note";
const CANVAS_OBJECT_DRAG_THRESHOLD = 4;

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
  const [boardTitleDraft, setBoardTitleDraft] = useState("");
  const [canvasZoom, setCanvasZoom] = useState(1);
  const canvasZoomRef = useRef(1);
  const draggedObjectRef = useRef<{ kind: CanvasDragKind; id: string } | null>(
    null,
  );

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
    setBoardBrowserOpen(false);
  }, [activeCanvas?.id]);

  useEffect(() => {
    if (!activeCanvas) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const scroll = scrollRef.current;
      if (!scroll) return;
      const zoom = canvasZoomRef.current;
      scroll.scrollLeft = CANVAS_WORLD_ORIGIN * zoom - 80 * zoom;
      scroll.scrollTop = CANVAS_WORLD_ORIGIN * zoom - 80 * zoom;
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
    if (!nextActiveCanvasId) {
      setBoardBrowserOpen(true);
    }
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
      setBoardBrowserOpen(false);
    },
    [setActiveCanvasId],
  );

  const createBoardFromBrowser = useCallback(() => {
    onCreateBoard();
    setBoardBrowserOpen(false);
  }, [onCreateBoard]);

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
            <ButtonIcon icon={PanelRightClose} />
          </button>
        </div>
      </header>

      {data.canvases.length ? (
        <div className="canvas-board-grid">
          {data.canvases.map((canvas) => {
            const memberItems = canvas.itemIds
              .map((itemId) => data.items.find((item) => item.id === itemId))
              .filter(Boolean) as FolioItem[];
            return (
              <button
                className={`canvas-list-item ${
                  canvas.id === activeCanvas?.id ? "active" : ""
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
              <ButtonIcon icon={PanelRightClose} />
            </button>
          </div>

          {boardToolsOpen ? (
            <div className="board-edit-popover" role="dialog" aria-label="Edit board">
              <div className="board-edit-popover-header">
                <strong>Edit board</strong>
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
              <div
                className="board-edit-action-bar"
                role="toolbar"
                aria-label="Board actions"
              >
                <button
                  className="board-edit-save"
                  type="button"
                  onClick={saveBoardTitle}
                >
                  <ButtonIcon icon={Save} />
                  Save name
                </button>
                <button
                  className="board-edit-action board-edit-delete"
                  type="button"
                  onClick={deleteBoard}
                  aria-label="Delete board"
                  title="Delete board"
                >
                  <ButtonIcon icon={Trash2} />
                </button>
              </div>
            </div>
          ) : null}
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
