import React, { useCallback, useEffect, useState } from "react";
import type {
  Canvas,
  CanvasConnectionSide,
  CanvasEdge,
  CanvasEdgeDirection,
  CanvasPosition,
} from "../../types";
import { createId } from "../folio/model";
import { objectTargetFromEvent } from "./canvasDom";
import { bestConnectionSide } from "./canvasGeometry";
import {
  deleteCanvasEdge,
  reverseCanvasEdgeDirection,
  updateCanvasEdgeDirection,
  updateCanvasEdgeLabel,
} from "./canvasModel";
import type { CanvasObjectKind, CanvasObjectLayout } from "./canvasTypes";

export type CanvasEdgeDraft = {
  fromId: string;
  fromSide: CanvasConnectionSide;
  toPoint: CanvasPosition;
};

type UpdateCanvasHandler = (
  canvasId: string,
  updater: (canvas: Canvas) => Canvas,
  message?: string,
) => void;

type UseCanvasEdgesOptions = {
  activeCanvas: Canvas | null;
  canvasObjectLayouts: Map<string, CanvasObjectLayout>;
  surfacePointFromClient: (clientX: number, clientY: number) => CanvasPosition;
  updateCanvas: UpdateCanvasHandler;
};

export function useCanvasEdges({
  activeCanvas,
  canvasObjectLayouts,
  surfacePointFromClient,
  updateCanvas,
}: UseCanvasEdgesOptions) {
  const [edgeDraft, setEdgeDraft] = useState<CanvasEdgeDraft | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);
  const [edgeLabelDraft, setEdgeLabelDraft] = useState("");

  useEffect(() => {
    setEdgeDraft(null);
    setSelectedEdgeId(null);
    setEditingEdgeId(null);
    setEdgeLabelDraft("");
  }, [activeCanvas?.id]);

  const saveEdgeLabel = useCallback(() => {
    if (!activeCanvas || !editingEdgeId) return;
    updateCanvas(
      activeCanvas.id,
      (canvas) => updateCanvasEdgeLabel(canvas, editingEdgeId, edgeLabelDraft),
      "Edge updated",
    );
    setEditingEdgeId(null);
    setEdgeLabelDraft("");
  }, [activeCanvas, edgeLabelDraft, editingEdgeId, updateCanvas]);

  const startEdgeLabelEdit = useCallback((edge: CanvasEdge) => {
    setSelectedEdgeId(edge.id);
    setEditingEdgeId(edge.id);
    setEdgeLabelDraft(edge.label ?? "");
  }, []);

  const stopEdgeLabelEdit = useCallback(() => {
    setEditingEdgeId(null);
    setEdgeLabelDraft("");
  }, []);

  const updateEdgeDirection = useCallback(
    (edgeId: string, direction: CanvasEdgeDirection) => {
      if (!activeCanvas) return;
      updateCanvas(
        activeCanvas.id,
        (canvas) => updateCanvasEdgeDirection(canvas, edgeId, direction),
        "Edge direction updated",
      );
    },
    [activeCanvas, updateCanvas],
  );

  const reverseEdgeDirection = useCallback(
    (edgeId: string) => {
      if (!activeCanvas) return;
      updateCanvas(
        activeCanvas.id,
        (canvas) => reverseCanvasEdgeDirection(canvas, edgeId),
        "Edge direction reversed",
      );
    },
    [activeCanvas, updateCanvas],
  );

  const deleteEdge = useCallback(
    (edgeId: string) => {
      if (!activeCanvas) return;
      updateCanvas(
        activeCanvas.id,
        (canvas) => deleteCanvasEdge(canvas, edgeId),
        "Edge deleted",
      );
      setSelectedEdgeId((current) => (current === edgeId ? null : current));
      setEditingEdgeId((current) => (current === edgeId ? null : current));
      setEdgeLabelDraft("");
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
      const eventPoint = surfacePointFromClient(event.clientX, event.clientY);
      const initialFromSide =
        preferredFromSide ??
        (source ? bestConnectionSide(source.center, eventPoint) : "right");
      const startPoint = source?.sides[initialFromSide] ?? eventPoint;
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
        if (
          !target ||
          target.id === objectId ||
          !latestSource ||
          !latestTarget
        ) {
          return;
        }

        const fromSide =
          preferredFromSide ??
          bestConnectionSide(latestSource.center, latestTarget.center);
        const toSide =
          target.side ??
          bestConnectionSide(latestTarget.center, latestSource.center);
        const edgeId = createId("edge");
        const createdAt = new Date().toISOString();
        updateCanvas(
          activeCanvas.id,
          (canvas) => {
            const edges = canvas.edges ?? [];
            const alreadyConnected = edges.some(
              (edge) =>
                (edge.fromId === objectId && edge.toId === target.id) ||
                (edge.fromId === target.id && edge.toId === objectId),
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
                  relationshipType: "related",
                  createdAt,
                  updatedAt: createdAt,
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

  return {
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
  };
}
