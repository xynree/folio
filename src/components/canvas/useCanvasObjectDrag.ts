import React, { useCallback, useRef } from "react";
import type { Canvas, CanvasObjectGeometry, FolioData } from "../../types";
import { markCanvasSaved } from "../folio/model";
import type { CanvasDragPreview } from "./canvasLayout";
import { moveCanvasObject, moveCanvasObjects } from "./canvasModel";
import { canvasObjectSelectionKey } from "./canvasSelection";
import type { CanvasObjectSelection } from "./canvasSelection";
import type { CanvasObjectKind, CanvasTool } from "./canvasTypes";

const CANVAS_OBJECT_DRAG_THRESHOLD = 4;

type SaveDataHandler = (data: FolioData, message?: string) => void;

type StartEdgeDragHandler = (
  event: React.PointerEvent,
  kind: CanvasObjectKind,
  objectId: string,
) => void;

type UseCanvasObjectDragOptions = {
  activeCanvas: Canvas | null;
  activeTool: CanvasTool;
  canvasZoom: number;
  data: FolioData;
  saveData: SaveDataHandler;
  selectedObjectPositions?: Map<string, CanvasObjectGeometry>;
  selectedObjects?: CanvasObjectSelection[];
  setDragPreview: React.Dispatch<React.SetStateAction<CanvasDragPreview | null>>;
  startEdgeDrag: StartEdgeDragHandler;
};

export function useCanvasObjectDrag({
  activeCanvas,
  activeTool,
  canvasZoom,
  data,
  saveData,
  selectedObjectPositions = new Map(),
  selectedObjects = [],
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
      startPosition: CanvasObjectGeometry,
    ) => {
      if (!activeCanvas) return;
      if (event.button !== 0) return;
      if (event.shiftKey || activeTool === "connect") {
        startEdgeDrag(event, kind, objectId);
        return;
      }

      const startPointer = { x: event.clientX, y: event.clientY };
      const objectSelection = { id: objectId, kind };
      const selectedObjectKey = canvasObjectSelectionKey(objectSelection);
      const shouldMoveSelection =
        selectedObjects.length > 1 && selectedObjectPositions.has(selectedObjectKey);
      const selectedDragObjects = shouldMoveSelection
        ? selectedObjects
            .map((selectedObject) => {
              const position = selectedObjectPositions.get(
                canvasObjectSelectionKey(selectedObject),
              );
              return position
                ? {
                    ...selectedObject,
                    startPosition: position,
                  }
                : null;
            })
            .filter(Boolean) as Array<
              CanvasObjectSelection & { startPosition: CanvasObjectGeometry }
            >
        : [{ ...objectSelection, startPosition }];
      const previousCursor = document.body.style.cursor;
      const previousUserSelect = document.body.style.userSelect;
      let isDragging = false;

      const deltaFromPointer = (clientX: number, clientY: number) => ({
        x: (clientX - startPointer.x) / canvasZoom,
        y: (clientY - startPointer.y) / canvasZoom,
      });

      const positionFromPointer = (
        clientX: number,
        clientY: number,
        position: CanvasObjectGeometry,
      ) => {
        const delta = deltaFromPointer(clientX, clientY);
        return {
          ...position,
          x: position.x + delta.x,
          y: position.y + delta.y,
        };
      };

      const commitPosition = (clientX: number, clientY: number) => {
        const savedAt = new Date().toISOString();
        const movePatches = selectedDragObjects.map((object) => ({
          id: object.id,
          kind: object.kind,
          position: positionFromPointer(clientX, clientY, object.startPosition),
        }));
        saveData(
          {
            ...data,
            canvases: data.canvases.map((canvas) =>
              canvas.id === activeCanvas.id
                ? markCanvasSaved(
                    shouldMoveSelection
                      ? moveCanvasObjects(canvas, movePatches)
                      : moveCanvasObject(canvas, kind, objectId, movePatches[0].position),
                    savedAt,
                  )
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
          position: positionFromPointer(
            moveEvent.clientX,
            moveEvent.clientY,
            startPosition,
          ),
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
        commitPosition(upEvent.clientX, upEvent.clientY);
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
    [
      activeCanvas,
      activeTool,
      canvasZoom,
      data,
      saveData,
      selectedObjectPositions,
      selectedObjects,
      setDragPreview,
      startEdgeDrag,
    ],
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
