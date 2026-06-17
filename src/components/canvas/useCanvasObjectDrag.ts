import React, { useCallback, useRef } from "react";
import type { Canvas, CanvasPosition, FolioData } from "../../types";
import type { CanvasDragPreview } from "./canvasLayout";
import { moveCanvasObject } from "./canvasModel";
import type { CanvasObjectKind } from "./canvasTypes";

const CANVAS_OBJECT_DRAG_THRESHOLD = 4;

type SaveDataHandler = (data: FolioData, message?: string) => void;

type StartEdgeDragHandler = (
  event: React.PointerEvent,
  kind: CanvasObjectKind,
  objectId: string,
) => void;

type UseCanvasObjectDragOptions = {
  activeCanvas: Canvas | null;
  canvasZoom: number;
  data: FolioData;
  saveData: SaveDataHandler;
  setDragPreview: React.Dispatch<React.SetStateAction<CanvasDragPreview | null>>;
  startEdgeDrag: StartEdgeDragHandler;
};

export function useCanvasObjectDrag({
  activeCanvas,
  canvasZoom,
  data,
  saveData,
  setDragPreview,
  startEdgeDrag,
}: UseCanvasObjectDragOptions) {
  const draggedObjectRef = useRef<{ kind: CanvasObjectKind; id: string } | null>(
    null,
  );

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
        saveData(
          {
            ...data,
            canvases: data.canvases.map((canvas) =>
              canvas.id === activeCanvas.id
                ? moveCanvasObject(canvas, kind, objectId, finalPosition)
                : canvas,
            ),
          },
          "Position saved",
        );
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
    [activeCanvas, canvasZoom, data, saveData, setDragPreview, startEdgeDrag],
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

  return {
    startDrag,
    suppressClickAfterDrag,
  };
}
