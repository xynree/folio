import React from "react";
import type {
  CanvasConnectionSide,
  CanvasEdge,
  CanvasPosition,
  CanvasStroke,
} from "../../types";
import { CANVAS_WORLD_HEIGHT, CANVAS_WORLD_WIDTH } from "../folio/constants";
import {
  bestConnectionSide,
  buildEdgePath,
} from "./canvasGeometry";
import type {
  CanvasObjectLayout,
  CanvasTool,
  EdgeRenderModel,
} from "./canvasTypes";

type CanvasEdgeDraft = {
  fromId: string;
  fromSide: CanvasConnectionSide;
  toPoint: CanvasPosition;
};

type CanvasInkLayerProps = {
  activeStrokes: CanvasStroke[];
  activeTool: CanvasTool;
  canvasObjectLayouts: Map<string, CanvasObjectLayout>;
  edgeDraft: CanvasEdgeDraft | null;
  edgeRenderModels: EdgeRenderModel[];
  selectedEdgeId: string | null;
  strokePreview: CanvasStroke | null;
  onSelectEdge: (edgeId: string) => void;
  onStartEdgeLabelEdit: (edge: CanvasEdge) => void;
};

export function CanvasInkLayer({
  activeStrokes,
  activeTool,
  canvasObjectLayouts,
  edgeDraft,
  edgeRenderModels,
  selectedEdgeId,
  strokePreview,
  onSelectEdge,
  onStartEdgeLabelEdit,
}: CanvasInkLayerProps) {
  return (
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
              onSelectEdge(model.edge.id);
            }}
            onDoubleClick={(event) => {
              event.stopPropagation();
              onStartEdgeLabelEdit(model.edge);
            }}
          />
          <path
            className="canvas-edge-path"
            d={model.path}
            markerEnd={
              model.direction === "forward" || model.direction === "bidirectional"
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
          d={draftEdgePath(edgeDraft, canvasObjectLayouts)}
        />
      ) : null}
    </svg>
  );
}

function draftEdgePath(
  edgeDraft: CanvasEdgeDraft,
  canvasObjectLayouts: Map<string, CanvasObjectLayout>,
): string {
  const source = canvasObjectLayouts.get(edgeDraft.fromId);
  if (!source) return "";

  return buildEdgePath(
    source.sides[edgeDraft.fromSide],
    edgeDraft.toPoint,
    edgeDraft.fromSide,
    bestConnectionSide(edgeDraft.toPoint, source.center),
  );
}
