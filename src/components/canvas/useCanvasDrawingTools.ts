import React, { useCallback, useEffect, useState } from "react";
import type {
  Canvas,
  CanvasPosition,
  CanvasSection,
  CanvasStroke,
  CanvasTextElement,
} from "../../types";
import { CANVAS_COLORS, CANVAS_WORLD_ORIGIN } from "../folio/constants";
import { createId } from "../folio/model";
import { buildPolylinePath, eraseStrokePathAtPoint } from "./canvasGeometry";
import {
  addCanvasSection,
  addCanvasStroke,
  addCanvasTextElement,
  eraseCanvasStrokesAtPoint,
  removeLastCanvasStroke,
} from "./canvasModel";
import type { CanvasTool } from "./canvasTypes";

const STROKE_POINT_MIN_DISTANCE = 2;
const NON_DRAWING_TARGET_SELECTOR =
  ".canvas-card, .canvas-document-card, .canvas-note, .canvas-text-card, .canvas-link-card, .canvas-section-frame, .canvas-edge-label, button, input, textarea, select, a";

type UpdateCanvasHandler = (
  canvasId: string,
  updater: (canvas: Canvas) => Canvas,
  message?: string,
) => void;

type UseCanvasDrawingToolsOptions = {
  activeCanvas: Canvas | null;
  activeStrokes: CanvasStroke[];
  surfacePointFromClient: (clientX: number, clientY: number) => CanvasPosition;
  updateCanvas: UpdateCanvasHandler;
};

export function useCanvasDrawingTools({
  activeCanvas,
  activeStrokes,
  surfacePointFromClient,
  updateCanvas,
}: UseCanvasDrawingToolsOptions) {
  const [activeTool, setActiveTool] = useState<CanvasTool>("select");
  const [toolCursorPosition, setToolCursorPosition] =
    useState<CanvasPosition | null>(null);
  const [strokePreview, setStrokePreview] = useState<CanvasStroke | null>(null);

  useEffect(() => {
    setStrokePreview(null);
  }, [activeCanvas?.id]);

  useEffect(() => {
    if (activeTool !== "pen" && activeTool !== "eraser") {
      setToolCursorPosition(null);
    }
  }, [activeTool]);

  const undoLastStroke = useCallback(() => {
    if (!activeCanvas || !activeStrokes.length) return;
    updateCanvas(
      activeCanvas.id,
      (canvas) => removeLastCanvasStroke(canvas),
      "Stroke removed",
    );
  }, [activeCanvas, activeStrokes.length, updateCanvas]);

  const eraseStrokesAtPoint = useCallback(
    (point: CanvasPosition) => {
      if (!activeCanvas) return;
      const hasErasableInk = (activeCanvas.strokes ?? []).some((stroke) => {
        const remainingPaths = eraseStrokePathAtPoint(stroke.path, point);
        return remainingPaths.length !== 1 || remainingPaths[0] !== stroke.path;
      });

      if (!hasErasableInk) return;

      updateCanvas(
        activeCanvas.id,
        (canvas) =>
          eraseCanvasStrokesAtPoint(canvas, point, () => createId("stroke")),
        "Stroke erased",
      );
    },
    [activeCanvas, updateCanvas],
  );

  const updateToolCursor = useCallback(
    (clientX: number, clientY: number) => {
      if (activeTool !== "pen" && activeTool !== "eraser") {
        setToolCursorPosition(null);
        return null;
      }

      const point = surfacePointFromClient(clientX, clientY);
      setToolCursorPosition(point);
      return point;
    },
    [activeTool, surfacePointFromClient],
  );

  const handleSurfacePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      updateToolCursor(event.clientX, event.clientY);
    },
    [updateToolCursor],
  );

  const hideToolCursor = useCallback(() => {
    setToolCursorPosition(null);
  }, []);

  const addTextAtPoint = useCallback(
    (point: CanvasPosition) => {
      if (!activeCanvas) return;
      const textElement: CanvasTextElement = {
        id: createId("text"),
        size: "md",
        text: "Text",
        x: point.x - CANVAS_WORLD_ORIGIN,
        y: point.y - CANVAS_WORLD_ORIGIN,
      };
      updateCanvas(
        activeCanvas.id,
        (canvas) => addCanvasTextElement(canvas, textElement),
        "Text added",
      );
      setActiveTool("select");
    },
    [activeCanvas, updateCanvas],
  );

  const addSectionAtPoint = useCallback(
    (point: CanvasPosition) => {
      if (!activeCanvas) return;
      const createdAt = new Date().toISOString();
      const section: CanvasSection = {
        id: createId("section"),
        title: "Section",
        color: activeCanvas.color ?? CANVAS_COLORS[0],
        x: point.x - CANVAS_WORLD_ORIGIN,
        y: point.y - CANVAS_WORLD_ORIGIN,
        width: 520,
        height: 340,
        createdAt,
        updatedAt: createdAt,
      };
      updateCanvas(
        activeCanvas.id,
        (canvas) => addCanvasSection(canvas, section),
        "Section added",
      );
      setActiveTool("select");
    },
    [activeCanvas, updateCanvas],
  );

  const handleSurfacePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (activeTool === "select" || activeTool === "connect" || !activeCanvas)
        return;
      if (event.button !== 0) return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(NON_DRAWING_TARGET_SELECTOR)
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const startPoint = updateToolCursor(event.clientX, event.clientY);

      if (activeTool === "text") {
        addTextAtPoint(surfacePointFromClient(event.clientX, event.clientY));
        return;
      }

      if (activeTool === "section") {
        addSectionAtPoint(surfacePointFromClient(event.clientX, event.clientY));
        return;
      }

      if (activeTool === "eraser") {
        startEraserDrag({
          eraseStrokesAtPoint,
          startPoint,
          updateToolCursor,
        });
        return;
      }

      startPenDrag({
        activeCanvas,
        startPoint,
        surfacePointFromClient,
        updateCanvas,
        updateToolCursor,
        setStrokePreview,
        pointer: { clientX: event.clientX, clientY: event.clientY },
      });
    },
    [
      activeCanvas,
      activeTool,
      addSectionAtPoint,
      addTextAtPoint,
      eraseStrokesAtPoint,
      surfacePointFromClient,
      updateCanvas,
      updateToolCursor,
    ],
  );

  return {
    activeTool,
    handleSurfacePointerDown,
    handleSurfacePointerMove,
    hideToolCursor,
    setActiveTool,
    strokePreview,
    toolCursorPosition,
    undoLastStroke,
  };
}

function startEraserDrag({
  eraseStrokesAtPoint,
  startPoint,
  updateToolCursor,
}: {
  eraseStrokesAtPoint: (point: CanvasPosition) => void;
  startPoint: CanvasPosition | null;
  updateToolCursor: (clientX: number, clientY: number) => CanvasPosition | null;
}) {
  if (startPoint) {
    eraseStrokesAtPoint(startPoint);
  }

  const previousCursor = document.body.style.cursor;
  const previousUserSelect = document.body.style.userSelect;
  document.body.style.cursor = "none";
  document.body.style.userSelect = "none";

  const onPointerMove = (moveEvent: PointerEvent) => {
    moveEvent.preventDefault();
    const point = updateToolCursor(moveEvent.clientX, moveEvent.clientY);
    if (!point) return;
    eraseStrokesAtPoint(point);
  };

  const onPointerUp = () => {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    document.body.style.cursor = previousCursor;
    document.body.style.userSelect = previousUserSelect;
  };

  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
}

function startPenDrag({
  activeCanvas,
  pointer,
  setStrokePreview,
  startPoint,
  surfacePointFromClient,
  updateCanvas,
  updateToolCursor,
}: {
  activeCanvas: Canvas;
  pointer: { clientX: number; clientY: number };
  setStrokePreview: React.Dispatch<React.SetStateAction<CanvasStroke | null>>;
  startPoint: CanvasPosition | null;
  surfacePointFromClient: (clientX: number, clientY: number) => CanvasPosition;
  updateCanvas: UpdateCanvasHandler;
  updateToolCursor: (clientX: number, clientY: number) => CanvasPosition | null;
}) {
  const strokeId = createId("stroke");
  const color = activeCanvas.color ?? CANVAS_COLORS[0];
  const points = [
    startPoint ?? surfacePointFromClient(pointer.clientX, pointer.clientY),
  ];
  const previousCursor = document.body.style.cursor;
  const previousUserSelect = document.body.style.userSelect;
  document.body.style.cursor = "none";
  document.body.style.userSelect = "none";
  setStrokePreview({ id: strokeId, path: buildPolylinePath(points), color });

  const onPointerMove = (moveEvent: PointerEvent) => {
    moveEvent.preventDefault();
    const point =
      updateToolCursor(moveEvent.clientX, moveEvent.clientY) ??
      surfacePointFromClient(moveEvent.clientX, moveEvent.clientY);
    const lastPoint = points[points.length - 1];
    if (
      Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) <
      STROKE_POINT_MIN_DISTANCE
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

    updateCanvas(
      activeCanvas.id,
      (canvas) =>
        addCanvasStroke(canvas, {
          id: strokeId,
          path: buildPolylinePath(points),
          color,
        }),
      "Stroke added",
    );
  };

  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
}
