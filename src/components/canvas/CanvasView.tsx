import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  Edit3,
  Ellipsis,
  Eraser,
  ImagePlus,
  Link2,
  Minimize2,
  Minus,
  Paperclip,
  PenLine,
  Plus,
  Save,
  StickyNote,
  Trash2,
  Type,
  Undo2,
  X,
} from "lucide-react";
import type {
  Canvas,
  CanvasConnectionSide,
  CanvasEdge,
  CanvasEdgeDirection,
  CanvasNote,
  CanvasPosition,
  CanvasReference,
  CanvasStroke,
  CanvasTextElement,
  FolioData,
  FolioItem,
  ThumbnailUrls,
} from "../../types";
import {
  CANVAS_COLORS,
  CANVAS_WORLD_HEIGHT,
  CANVAS_WORLD_ORIGIN,
  CANVAS_WORLD_WIDTH,
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
import {
  CanvasItemCard,
  CanvasNoteCard,
  CanvasTextCard,
  ReferenceCard,
} from "./CanvasCards";
import { CanvasViewport } from "./CanvasViewport";

type CanvasObjectKind = "item" | "reference" | "note" | "text";
type CanvasTool = "select" | "pen" | "eraser" | "text";

const CANVAS_OBJECT_DRAG_THRESHOLD = 4;
const BOARD_BROWSER_PREVIEW_LIMIT = 3;
const STROKE_POINT_MIN_DISTANCE = 2;
const CANVAS_CONNECTION_SIDES: CanvasConnectionSide[] = [
  "top",
  "right",
  "bottom",
  "left",
];

const CANVAS_OBJECT_SIZES: Record<
  CanvasObjectKind,
  { width: number; height: number }
> = {
  item: { width: 162, height: 190 },
  reference: { width: 162, height: 214 },
  note: { width: 220, height: 150 },
  text: { width: 220, height: 96 },
};

type CanvasObjectLayout = {
  id: string;
  kind: CanvasObjectKind;
  center: CanvasPosition;
  sides: Record<CanvasConnectionSide, CanvasPosition>;
};

type EdgeRenderModel = {
  edge: CanvasEdge;
  path: string;
  labelPosition: CanvasPosition;
  direction: CanvasEdgeDirection;
};

type CanvasObjectTarget = {
  id: string;
  kind: CanvasObjectKind;
  side?: CanvasConnectionSide;
};

function buildPolylinePath(points: CanvasPosition[]) {
  if (!points.length) return "";
  const [first, ...rest] = points;
  return [
    `M ${Math.round(first.x)} ${Math.round(first.y)}`,
    ...rest.map((point) => `L ${Math.round(point.x)} ${Math.round(point.y)}`),
  ].join(" ");
}

function connectionVector(side: CanvasConnectionSide) {
  if (side === "top") return { x: 0, y: -1 };
  if (side === "right") return { x: 1, y: 0 };
  if (side === "bottom") return { x: 0, y: 1 };
  return { x: -1, y: 0 };
}

function isCanvasConnectionSide(value: string | undefined): value is CanvasConnectionSide {
  return Boolean(
    value
      && CANVAS_CONNECTION_SIDES.includes(value as CanvasConnectionSide),
  );
}

function edgeDirection(edge: CanvasEdge): CanvasEdgeDirection {
  return edge.direction ?? "none";
}

function bestConnectionSide(
  source: CanvasPosition,
  target: CanvasPosition,
): CanvasConnectionSide {
  const deltaX = target.x - source.x;
  const deltaY = target.y - source.y;
  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return deltaX >= 0 ? "right" : "left";
  }
  return deltaY >= 0 ? "bottom" : "top";
}

function sidePointFromPosition(
  position: CanvasPosition,
  kind: CanvasObjectKind,
  side: CanvasConnectionSide,
) {
  const size = CANVAS_OBJECT_SIZES[kind];
  const absoluteX = position.x + CANVAS_WORLD_ORIGIN;
  const absoluteY = position.y + CANVAS_WORLD_ORIGIN;
  if (side === "top") {
    return { x: absoluteX + size.width / 2, y: absoluteY };
  }
  if (side === "right") {
    return { x: absoluteX + size.width, y: absoluteY + size.height / 2 };
  }
  if (side === "bottom") {
    return { x: absoluteX + size.width / 2, y: absoluteY + size.height };
  }
  return { x: absoluteX, y: absoluteY + size.height / 2 };
}

function objectLayoutFromPosition(
  id: string,
  kind: CanvasObjectKind,
  position: CanvasPosition,
): CanvasObjectLayout {
  const size = CANVAS_OBJECT_SIZES[kind];
  const absoluteX = position.x + CANVAS_WORLD_ORIGIN;
  const absoluteY = position.y + CANVAS_WORLD_ORIGIN;

  return {
    id,
    kind,
    center: {
      x: absoluteX + size.width / 2,
      y: absoluteY + size.height / 2,
    },
    sides: {
      top: sidePointFromPosition(position, kind, "top"),
      right: sidePointFromPosition(position, kind, "right"),
      bottom: sidePointFromPosition(position, kind, "bottom"),
      left: sidePointFromPosition(position, kind, "left"),
    },
  };
}

function buildEdgePath(
  from: CanvasPosition,
  to: CanvasPosition,
  fromSide: CanvasConnectionSide,
  toSide: CanvasConnectionSide,
) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const controlOffset = Math.min(180, Math.max(48, distance * 0.32));
  const fromVector = connectionVector(fromSide);
  const toVector = connectionVector(toSide);
  const firstControl = {
    x: from.x + fromVector.x * controlOffset,
    y: from.y + fromVector.y * controlOffset,
  };
  const secondControl = {
    x: to.x + toVector.x * controlOffset,
    y: to.y + toVector.y * controlOffset,
  };

  return [
    `M ${Math.round(from.x)} ${Math.round(from.y)}`,
    `C ${Math.round(firstControl.x)} ${Math.round(firstControl.y)}`,
    `${Math.round(secondControl.x)} ${Math.round(secondControl.y)}`,
    `${Math.round(to.x)} ${Math.round(to.y)}`,
  ].join(" ");
}

function edgeLabelPosition(from: CanvasPosition, to: CanvasPosition) {
  return {
    x: (from.x + to.x) / 2,
    y: (from.y + to.y) / 2,
  };
}

function objectTargetFromElement(element: Element | null): CanvasObjectTarget | null {
  const objectElement = element?.closest<HTMLElement>("[data-canvas-object-id]");
  if (!objectElement?.dataset.canvasObjectId) return null;

  const connectorElement = element?.closest<HTMLElement>("[data-connector-side]");
  const connectorSide = connectorElement?.dataset.connectorSide;
  return {
    id: objectElement.dataset.canvasObjectId,
    kind: objectElement.dataset.canvasObjectKind as CanvasObjectKind,
    side: isCanvasConnectionSide(connectorSide) ? connectorSide : undefined,
  };
}

function objectTargetFromEvent(event: PointerEvent): CanvasObjectTarget | null {
  const directTarget =
    event.target instanceof Element ? objectTargetFromElement(event.target) : null;
  if (directTarget) return directTarget;

  const elementAtPoint = document.elementFromPoint(event.clientX, event.clientY);
  return objectTargetFromElement(elementAtPoint);
}

export function CanvasView({
  data,
  activeCanvasId,
  canvasDetailRequestId,
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
  canvasDetailRequestId: number;
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
    kind: CanvasObjectKind;
    position: CanvasPosition;
  } | null>(null);
  const [edgeDraft, setEdgeDraft] = useState<{
    fromId: string;
    fromSide: CanvasConnectionSide;
    toPoint: CanvasPosition;
  } | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);
  const [edgeLabelDraft, setEdgeLabelDraft] = useState("");
  const [activeTool, setActiveTool] = useState<CanvasTool>("select");
  const [strokePreview, setStrokePreview] = useState<CanvasStroke | null>(null);
  const [boardToolsOpen, setBoardToolsOpen] = useState(false);
  const [boardBrowserOpen, setBoardBrowserOpen] = useState(true);
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
  const draggedObjectRef = useRef<{ kind: CanvasObjectKind; id: string } | null>(
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
    setEdgeDraft(null);
    setSelectedEdgeId(null);
    setEditingEdgeId(null);
    setStrokePreview(null);
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
      if (boardBrowserOpen || !nextActiveCanvasId) {
        setBoardBrowserOpen(true);
      }
    },
    [activeCanvasId, boardBrowserOpen, commitData, data.canvases, setActiveCanvasId],
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

  const positionForText = useCallback(
    (textElement: CanvasTextElement): CanvasPosition => {
      if (
        dragPreview?.kind === "text"
        && dragPreview.id === textElement.id
      ) {
        return dragPreview.position;
      }
      return { x: textElement.x, y: textElement.y };
    },
    [dragPreview],
  );

  const canvasObjectLayouts = useMemo(() => {
    const layouts = new Map<string, CanvasObjectLayout>();

    activeItems.forEach((item, index) => {
      const position = positionForItem(item, index);
      layouts.set(item.id, objectLayoutFromPosition(item.id, "item", position));
    });

    activeReferences.forEach((reference) => {
      const position = positionForReference(reference);
      layouts.set(reference.id, {
        ...objectLayoutFromPosition(reference.id, "reference", position),
      });
    });

    activeNotes.forEach((note) => {
      const position = positionForNote(note);
      layouts.set(note.id, objectLayoutFromPosition(note.id, "note", position));
    });

    activeTexts.forEach((textElement) => {
      const position = positionForText(textElement);
      layouts.set(
        textElement.id,
        objectLayoutFromPosition(textElement.id, "text", position),
      );
    });

    return layouts;
  }, [
    activeItems,
    activeNotes,
    activeReferences,
    activeTexts,
    positionForItem,
    positionForNote,
    positionForReference,
    positionForText,
  ]);

  const edgeRenderModels = useMemo(
    () =>
      activeEdges
        .map((edge): EdgeRenderModel | null => {
          const from = canvasObjectLayouts.get(edge.fromId);
          const to = canvasObjectLayouts.get(edge.toId);
          if (!from || !to) return null;
          const fromSide =
            edge.fromSide ?? bestConnectionSide(from.center, to.center);
          const toSide = edge.toSide ?? bestConnectionSide(to.center, from.center);
          const fromPoint = from.sides[fromSide];
          const toPoint = to.sides[toSide];
          return {
            edge,
            path: buildEdgePath(fromPoint, toPoint, fromSide, toSide),
            labelPosition: edgeLabelPosition(fromPoint, toPoint),
            direction: edgeDirection(edge),
          };
        })
        .filter(Boolean) as EdgeRenderModel[],
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

  const saveEdgeLabel = useCallback(() => {
    if (!activeCanvas || !editingEdgeId) return;
    const trimmed = edgeLabelDraft.trim();
    updateCanvas(activeCanvas.id, (canvas) => ({
      ...canvas,
      edges: (canvas.edges ?? []).map((edge) =>
        edge.id === editingEdgeId
          ? { ...edge, label: trimmed || undefined }
          : edge,
      ),
    }), "Edge updated");
    setEditingEdgeId(null);
    setEdgeLabelDraft("");
  }, [activeCanvas, edgeLabelDraft, editingEdgeId, updateCanvas]);

  const startEdgeLabelEdit = useCallback((edge: CanvasEdge) => {
    setSelectedEdgeId(edge.id);
    setEditingEdgeId(edge.id);
    setEdgeLabelDraft(edge.label ?? "");
  }, []);

  const updateEdgeDirection = useCallback(
    (edgeId: string, direction: CanvasEdgeDirection) => {
      if (!activeCanvas) return;
      updateCanvas(activeCanvas.id, (canvas) => ({
        ...canvas,
        edges: (canvas.edges ?? []).map((edge) =>
          edge.id === edgeId ? { ...edge, direction } : edge,
        ),
      }), "Edge direction updated");
    },
    [activeCanvas, updateCanvas],
  );

  const startEdgeDrag = useCallback(
    (
      event: React.PointerEvent,
      kind: CanvasObjectKind,
      objectId: string,
      preferredFromSide?: CanvasConnectionSide,
    ) => {
      if (!activeCanvas) return;
      if (event.button !== 0) return;

      event.preventDefault();
      event.stopPropagation();

      const source = canvasObjectLayouts.get(objectId);
      const initialFromSide =
        preferredFromSide
        ?? (source ? bestConnectionSide(source.center, {
          x: surfacePointFromClient(event.clientX, event.clientY).x,
          y: surfacePointFromClient(event.clientX, event.clientY).y,
        }) : "right");
      const startPoint =
        source?.sides[initialFromSide]
        ?? surfacePointFromClient(event.clientX, event.clientY);
      const previousCursor = document.body.style.cursor;
      const previousUserSelect = document.body.style.userSelect;
      document.body.style.cursor = "crosshair";
      document.body.style.userSelect = "none";
      setSelectedEdgeId(null);
      setEditingEdgeId(null);
      setEdgeDraft({
        fromId: objectId,
        fromSide: initialFromSide,
        toPoint: startPoint,
      });

      const onPointerMove = (moveEvent: PointerEvent) => {
        moveEvent.preventDefault();
        setEdgeDraft({
          fromId: objectId,
          fromSide: initialFromSide,
          toPoint: surfacePointFromClient(moveEvent.clientX, moveEvent.clientY),
        });
      };

      const onPointerUp = (upEvent: PointerEvent) => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        setEdgeDraft(null);

        const target = objectTargetFromEvent(upEvent);
        const latestSource = canvasObjectLayouts.get(objectId);
        const latestTarget = target ? canvasObjectLayouts.get(target.id) : null;
        if (!target || target.id === objectId || !latestSource || !latestTarget) {
          return;
        }

        const fromSide =
          preferredFromSide
          ?? bestConnectionSide(latestSource.center, latestTarget.center);
        const toSide =
          target.side ?? bestConnectionSide(latestTarget.center, latestSource.center);
        const edgeId = createId("edge");
        updateCanvas(
          activeCanvas.id,
          (canvas) => {
            const edges = canvas.edges ?? [];
            const alreadyConnected = edges.some(
              (edge) =>
                (edge.fromId === objectId && edge.toId === target.id)
                || (edge.fromId === target.id && edge.toId === objectId),
            );
            if (alreadyConnected) return canvas;
            return {
              ...canvas,
              edges: [
                ...edges,
                {
                  id: edgeId,
                  fromId: objectId,
                  toId: target.id,
                  fromSide,
                  toSide,
                  direction: "forward",
                },
              ],
            };
          },
          `${kind === "text" ? "Text" : "Canvas object"} linked`,
        );
        setSelectedEdgeId(edgeId);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [activeCanvas, canvasObjectLayouts, surfacePointFromClient, updateCanvas],
  );

  const startConnectorDrag = useCallback(
    (
      event: React.PointerEvent<HTMLButtonElement>,
      objectId: string,
      fromSide: CanvasConnectionSide,
    ) => {
      const source = canvasObjectLayouts.get(objectId);
      if (!source) return;
      startEdgeDrag(event, source.kind, objectId, fromSide);
    },
    [canvasObjectLayouts, startEdgeDrag],
  );

  const undoLastStroke = useCallback(() => {
    if (!activeCanvas || !activeStrokes.length) return;
    updateCanvas(activeCanvas.id, (canvas) => ({
      ...canvas,
      strokes: (canvas.strokes ?? []).slice(0, -1),
    }), "Stroke removed");
  }, [activeCanvas, activeStrokes.length, updateCanvas]);

  const removeStroke = useCallback(
    (strokeId: string) => {
      if (!activeCanvas) return;
      updateCanvas(activeCanvas.id, (canvas) => ({
        ...canvas,
        strokes: (canvas.strokes ?? []).filter((stroke) => stroke.id !== strokeId),
      }), "Stroke erased");
    },
    [activeCanvas, updateCanvas],
  );

  const addTextAtPoint = useCallback(
    (point: CanvasPosition) => {
      if (!activeCanvas) return;
      const textElement: CanvasTextElement = {
        id: createId("text"),
        text: "Text",
        x: point.x - CANVAS_WORLD_ORIGIN,
        y: point.y - CANVAS_WORLD_ORIGIN,
      };
      updateCanvas(activeCanvas.id, (canvas) => ({
        ...canvas,
        texts: [...(canvas.texts ?? []), textElement],
      }), "Text added");
      setActiveTool("select");
    },
    [activeCanvas, updateCanvas],
  );

  const handleSurfacePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (activeTool === "select" || !activeCanvas) return;
      if (event.button !== 0) return;
      const target = event.target;
      if (
        target instanceof Element
        && target.closest(
          ".canvas-card, .canvas-note, .canvas-text-card, .canvas-edge-label, button, input, textarea, select",
        )
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (activeTool === "text") {
        addTextAtPoint(surfacePointFromClient(event.clientX, event.clientY));
        return;
      }

      if (activeTool === "eraser") return;

      const strokeId = createId("stroke");
      const color = activeCanvas.color ?? CANVAS_COLORS[0];
      const points = [surfacePointFromClient(event.clientX, event.clientY)];
      const previousCursor = document.body.style.cursor;
      const previousUserSelect = document.body.style.userSelect;
      document.body.style.cursor = "crosshair";
      document.body.style.userSelect = "none";
      setStrokePreview({ id: strokeId, path: buildPolylinePath(points), color });

      const onPointerMove = (moveEvent: PointerEvent) => {
        moveEvent.preventDefault();
        const point = surfacePointFromClient(moveEvent.clientX, moveEvent.clientY);
        const lastPoint = points[points.length - 1];
        if (
          Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y)
          < STROKE_POINT_MIN_DISTANCE
        ) {
          return;
        }
        points.push(point);
        setStrokePreview({
          id: strokeId,
          path: buildPolylinePath(points),
          color,
        });
      };

      const onPointerUp = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        setStrokePreview(null);
        if (points.length < 2) return;

        const stroke: CanvasStroke = {
          id: strokeId,
          path: buildPolylinePath(points),
          color,
        };
        updateCanvas(activeCanvas.id, (canvas) => ({
          ...canvas,
          strokes: [...(canvas.strokes ?? []), stroke],
        }), "Stroke added");
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [activeCanvas, activeTool, addTextAtPoint, surfacePointFromClient, updateCanvas],
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
      updateCanvas(activeCanvas.id, (canvas) => ({
        ...canvas,
        edges: (canvas.edges ?? []).filter((edge) => edge.id !== selectedEdgeId),
      }), "Edge deleted");
      setSelectedEdgeId(null);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    activeCanvas,
    activeStrokes.length,
    editingEdgeId,
    selectedEdgeId,
    undoLastStroke,
    updateCanvas,
  ]);

  const startDrag = useCallback(
    (
      event: React.PointerEvent,
      kind: CanvasObjectKind,
      objectId: string,
      startPosition: CanvasPosition,
    ) => {
      if (!activeCanvas) return;
      if (event.button !== 0) return;
      if (event.shiftKey) {
        startEdgeDrag(event, kind, objectId);
        return;
      }

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
            if (kind === "text") {
              return {
                ...canvas,
                texts: (canvas.texts ?? []).map((textElement) =>
                  textElement.id === objectId
                    ? { ...textElement, ...finalPosition }
                    : textElement,
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
    [activeCanvas, canvasZoom, data, saveData, startEdgeDrag],
  );

  const suppressClickAfterDrag = useCallback(
    (
      event: React.MouseEvent,
      kind: CanvasObjectKind,
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
                ? {
                    ...canvas,
                    references: [...(canvas.references ?? []), ...placed],
                  }
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

      await addReferencesAtPosition(filePaths, canvasPointFromEvent(event));
    },
    [
      activeCanvas,
      addDroppedItems,
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
        edges: (canvas.edges ?? []).filter(
          (edge) => edge.fromId !== noteId && edge.toId !== noteId,
        ),
      }), "Note deleted");
    },
    [activeCanvas, updateCanvas],
  );

  const updateTextElement = useCallback(
    (textElementId: string, text: string) => {
      if (!activeCanvas) return;
      updateCanvas(activeCanvas.id, (canvas) => ({
        ...canvas,
        texts: (canvas.texts ?? []).map((textElement) =>
          textElement.id === textElementId ? { ...textElement, text } : textElement,
        ),
      }));
    },
    [activeCanvas, updateCanvas],
  );

  const deleteTextElement = useCallback(
    (textElementId: string) => {
      if (!activeCanvas) return;
      updateCanvas(activeCanvas.id, (canvas) => ({
        ...canvas,
        texts: (canvas.texts ?? []).filter(
          (textElement) => textElement.id !== textElementId,
        ),
        edges: (canvas.edges ?? []).filter(
          (edge) => edge.fromId !== textElementId && edge.toId !== textElementId,
        ),
      }), "Text deleted");
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
        edges: (canvas.edges ?? []).filter(
          (edge) => edge.fromId !== referenceId && edge.toId !== referenceId,
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
              aria-label="Add reference"
              title="Add reference"
              onClick={importReferencesToBoard}
            >
              <ButtonIcon icon={Paperclip} />
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
              className={`canvas-board-action-button ${
                activeTool === "pen" ? "canvas-board-action-active" : ""
              }`}
              type="button"
              aria-label="Pen tool"
              aria-pressed={activeTool === "pen"}
              title="Pen tool"
              onClick={() =>
                setActiveTool((current) => (current === "pen" ? "select" : "pen"))
              }
            >
              <ButtonIcon icon={PenLine} />
            </button>
            <button
              className={`canvas-board-action-button ${
                activeTool === "eraser" ? "canvas-board-action-active" : ""
              }`}
              type="button"
              aria-label="Eraser tool"
              aria-pressed={activeTool === "eraser"}
              title="Eraser tool"
              onClick={() =>
                setActiveTool((current) =>
                  current === "eraser" ? "select" : "eraser",
                )
              }
            >
              <ButtonIcon icon={Eraser} />
            </button>
            <button
              className={`canvas-board-action-button ${
                activeTool === "text" ? "canvas-board-action-active" : ""
              }`}
              type="button"
              aria-label="Text tool"
              aria-pressed={activeTool === "text"}
              title="Text tool"
              onClick={() =>
                setActiveTool((current) => (current === "text" ? "select" : "text"))
              }
            >
              <ButtonIcon icon={Type} />
            </button>
            <button
              className="canvas-board-action-button"
              type="button"
              aria-label="Undo stroke"
              title="Undo stroke"
              disabled={!activeStrokes.length}
              onClick={undoLastStroke}
            >
              <ButtonIcon icon={Undo2} />
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
          onSurfacePointerDown={handleSurfacePointerDown}
        >
          <svg
            className="canvas-ink-layer"
            width={CANVAS_WORLD_WIDTH}
            height={CANVAS_WORLD_HEIGHT}
            viewBox={`0 0 ${CANVAS_WORLD_WIDTH} ${CANVAS_WORLD_HEIGHT}`}
            aria-hidden="true"
          >
            <defs>
              <marker
                id="canvas-edge-arrow"
                markerHeight="8"
                markerWidth="8"
                orient="auto-start-reverse"
                refX="7"
                refY="4"
                viewBox="0 0 8 8"
              >
                <path d="M 0 0 L 8 4 L 0 8 z" />
              </marker>
            </defs>
            {activeStrokes.map((stroke) => (
              <path
                className={`canvas-stroke-path ${
                  activeTool === "eraser" ? "canvas-stroke-erasable" : ""
                }`}
                d={stroke.path}
                key={stroke.id}
                stroke={stroke.color}
                onPointerDown={(event) => {
                  if (activeTool !== "eraser") return;
                  event.preventDefault();
                  event.stopPropagation();
                  removeStroke(stroke.id);
                }}
              />
            ))}
            {strokePreview ? (
              <path
                className="canvas-stroke-path canvas-stroke-preview"
                d={strokePreview.path}
                stroke={strokePreview.color}
              />
            ) : null}
            {edgeRenderModels.map((model) => (
              <g
                className={`canvas-edge ${
                  selectedEdgeId === model.edge.id ? "canvas-edge-selected" : ""
                }`}
                data-edge-id={model.edge.id}
                key={model.edge.id}
              >
                <path
                  className="canvas-edge-hit-area"
                  d={model.path}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedEdgeId(model.edge.id);
                  }}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    startEdgeLabelEdit(model.edge);
                  }}
                />
                <path
                  className="canvas-edge-path"
                  d={model.path}
                  markerEnd={
                    model.direction === "forward"
                    || model.direction === "bidirectional"
                      ? "url(#canvas-edge-arrow)"
                      : undefined
                  }
                  markerStart={
                    model.direction === "bidirectional"
                      ? "url(#canvas-edge-arrow)"
                      : undefined
                  }
                />
              </g>
            ))}
            {edgeDraft && canvasObjectLayouts.get(edgeDraft.fromId) ? (
              <path
                className="canvas-edge-path canvas-edge-draft"
                d={(() => {
                  const source = canvasObjectLayouts.get(edgeDraft.fromId);
                  if (!source) return "";
                  return buildEdgePath(
                    source.sides[edgeDraft.fromSide],
                    edgeDraft.toPoint,
                    edgeDraft.fromSide,
                    bestConnectionSide(edgeDraft.toPoint, source.center),
                  );
                })()}
              />
            ) : null}
          </svg>

          <div className="canvas-edge-label-layer" aria-live="polite">
            {edgeRenderModels.map((model) => {
              const editing = editingEdgeId === model.edge.id;
              return (
                <span
                  className={`canvas-edge-label ${
                    selectedEdgeId === model.edge.id
                      ? "canvas-edge-label-selected"
                      : ""
                  }`}
                  key={model.edge.id}
                  style={{
                    transform: `translate(${model.labelPosition.x}px, ${model.labelPosition.y}px)`,
                  }}
                >
                  {editing ? (
                    <input
                      aria-label="Edge label"
                      autoFocus
                      value={edgeLabelDraft}
                      onBlur={saveEdgeLabel}
                      onChange={(event) => setEdgeLabelDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          saveEdgeLabel();
                        }
                        if (event.key === "Escape") {
                          event.preventDefault();
                          setEditingEdgeId(null);
                          setEdgeLabelDraft("");
                        }
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      aria-label={`Edge label: ${model.edge.label || "Link"}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedEdgeId(model.edge.id);
                      }}
                      onDoubleClick={(event) => {
                        event.stopPropagation();
                        startEdgeLabelEdit(model.edge);
                      }}
                    >
                      <ButtonIcon icon={Link2} size={12} />
                      <span>{model.edge.label || "Link"}</span>
                    </button>
                  )}
                  {selectedEdgeId === model.edge.id && !editing ? (
                    <span
                      className="canvas-edge-direction-bar"
                      role="toolbar"
                      aria-label="Edge direction"
                    >
                      <button
                        className={
                          model.direction === "none"
                            ? "canvas-edge-direction-active"
                            : ""
                        }
                        type="button"
                        aria-label="No direction"
                        aria-pressed={model.direction === "none"}
                        title="No direction"
                        onClick={(event) => {
                          event.stopPropagation();
                          updateEdgeDirection(model.edge.id, "none");
                        }}
                      >
                        <ButtonIcon icon={Minus} size={12} />
                      </button>
                      <button
                        className={
                          model.direction === "forward"
                            ? "canvas-edge-direction-active"
                            : ""
                        }
                        type="button"
                        aria-label="Single direction"
                        aria-pressed={model.direction === "forward"}
                        title="Single direction"
                        onClick={(event) => {
                          event.stopPropagation();
                          updateEdgeDirection(model.edge.id, "forward");
                        }}
                      >
                        <ButtonIcon icon={ArrowRight} size={12} />
                      </button>
                      <button
                        className={
                          model.direction === "bidirectional"
                            ? "canvas-edge-direction-active"
                            : ""
                        }
                        type="button"
                        aria-label="Bidirectional"
                        aria-pressed={model.direction === "bidirectional"}
                        title="Bidirectional"
                        onClick={(event) => {
                          event.stopPropagation();
                          updateEdgeDirection(model.edge.id, "bidirectional");
                        }}
                      >
                        <ButtonIcon icon={ArrowLeftRight} size={12} />
                      </button>
                    </span>
                  ) : null}
                </span>
              );
            })}
          </div>

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
                onConnectorPointerDown={(event, side) =>
                  startConnectorDrag(event, item.id, side)
                }
                onPointerDown={(event) =>
                  startDrag(event, "item", item.id, position)
                }
                onClickCapture={(event) =>
                  suppressClickAfterDrag(event, "item", item.id)
                }
              />
            );
          })}

          {activeReferences.map((reference) => {
            const position = positionForReference(reference);
            return (
              <ReferenceCard
                key={reference.id}
                reference={reference}
                position={position}
                onRemove={removeReference}
                onConnectorPointerDown={(event, side) =>
                  startConnectorDrag(event, reference.id, side)
                }
                onPointerDown={(event) =>
                  startDrag(event, "reference", reference.id, position)
                }
                onClickCapture={(event) =>
                  suppressClickAfterDrag(event, "reference", reference.id)
                }
              />
            );
          })}

          {activeNotes.map((note) => (
            <CanvasNoteCard
              key={note.id}
              note={{ ...note, ...positionForNote(note) }}
              onChange={updateNote}
              onDelete={deleteNote}
              onConnectorPointerDown={(event, side) =>
                startConnectorDrag(event, note.id, side)
              }
              onPointerDown={(event) =>
                startDrag(event, "note", note.id, positionForNote(note))
              }
              onClickCapture={(event) =>
                suppressClickAfterDrag(event, "note", note.id)
              }
            />
          ))}

          {activeTexts.map((textElement) => {
            const position = positionForText(textElement);
            return (
              <CanvasTextCard
                key={textElement.id}
                textElement={{ ...textElement, ...position }}
                onChange={updateTextElement}
                onDelete={deleteTextElement}
                onConnectorPointerDown={(event, side) =>
                  startConnectorDrag(event, textElement.id, side)
                }
                onPointerDown={(event) =>
                  startDrag(event, "text", textElement.id, position)
                }
                onClickCapture={(event) =>
                  suppressClickAfterDrag(event, "text", textElement.id)
                }
              />
            );
          })}
        </CanvasViewport>
      </div>
    </section>
  );
}
