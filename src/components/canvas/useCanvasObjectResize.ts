import React, { useCallback } from "react";
import type {
  Canvas,
  CanvasObjectGeometry,
  CanvasObjectSize,
  FolioData,
} from "../../types";
import { markCanvasSaved } from "../folio/model";
import type { CanvasDragPreview } from "./canvasLayout";
import {
  constrainCanvasObjectSize,
  sizeForCanvasObject,
} from "./canvasGeometry";
import { resizeCanvasObject } from "./canvasModel";
import type { CanvasObjectKind } from "./canvasTypes";

type SaveDataHandler = (data: FolioData, message?: string) => void;

type UseCanvasObjectResizeOptions = {
  activeCanvas: Canvas | null;
  canvasZoom: number;
  data: FolioData;
  saveData: SaveDataHandler;
  setDragPreview: React.Dispatch<React.SetStateAction<CanvasDragPreview | null>>;
};

function shouldPreserveAspectRatio(kind: CanvasObjectKind) {
  return kind === "item" || kind === "reference";
}

function resizeWithAspectRatio(
  kind: CanvasObjectKind,
  startSize: CanvasObjectSize,
  proposedSize: CanvasObjectSize,
) {
  const minSize = constrainCanvasObjectSize(kind, { width: 0, height: 0 });
  const scale = Math.max(
    proposedSize.width / startSize.width,
    proposedSize.height / startSize.height,
    minSize.width / startSize.width,
    minSize.height / startSize.height,
  );

  return constrainCanvasObjectSize(kind, {
    width: startSize.width * scale,
    height: startSize.height * scale,
  });
}

export function useCanvasObjectResize({
  activeCanvas,
  canvasZoom,
  data,
  saveData,
  setDragPreview,
}: UseCanvasObjectResizeOptions) {
  const startResize = useCallback(
    (
      event: React.PointerEvent,
      kind: CanvasObjectKind,
      objectId: string,
      startGeometry: CanvasObjectGeometry,
    ) => {
      if (!activeCanvas) return;
      if (event.button !== 0) return;

      event.preventDefault();
      event.stopPropagation();

      const startPointer = { x: event.clientX, y: event.clientY };
      const startSize = sizeForCanvasObject(kind, startGeometry);
      const previousCursor = document.body.style.cursor;
      const previousUserSelect = document.body.style.userSelect;
      let moved = false;

      document.body.style.cursor = "nwse-resize";
      document.body.style.userSelect = "none";

      const sizeFromPointer = (clientX: number, clientY: number) => {
        const proposedSize = {
          width: startSize.width + (clientX - startPointer.x) / canvasZoom,
          height: startSize.height + (clientY - startPointer.y) / canvasZoom,
        };

        return shouldPreserveAspectRatio(kind)
          ? resizeWithAspectRatio(kind, startSize, proposedSize)
          : constrainCanvasObjectSize(kind, proposedSize);
      };

      const previewResize = (size: CanvasObjectSize) => {
        setDragPreview({
          id: objectId,
          kind,
          position: {
            ...startGeometry,
            width: size.width,
            height: size.height,
          },
        });
      };

      const commitSize = (size: CanvasObjectSize) => {
        const savedAt = new Date().toISOString();
        saveData(
          {
            ...data,
            canvases: data.canvases.map((canvas) =>
              canvas.id === activeCanvas.id
                ? markCanvasSaved(
                    resizeCanvasObject(canvas, kind, objectId, size),
                    savedAt,
                  )
                : canvas,
            ),
          },
          "Size saved",
        );
      };

      const onPointerMove = (moveEvent: PointerEvent) => {
        moved = true;
        moveEvent.preventDefault();
        previewResize(sizeFromPointer(moveEvent.clientX, moveEvent.clientY));
      };

      const onPointerUp = (upEvent: PointerEvent) => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        setDragPreview(null);

        if (!moved) return;

        upEvent.preventDefault();
        commitSize(sizeFromPointer(upEvent.clientX, upEvent.clientY));
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [activeCanvas, canvasZoom, data, saveData, setDragPreview],
  );

  return { startResize };
}
