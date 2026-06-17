import type {
  CanvasConnectionSide,
  CanvasEdge,
  CanvasEdgeDirection,
  CanvasObjectSize,
  CanvasPosition,
} from "../../types";

export type CanvasObjectKind = "item" | "reference" | "note" | "text";

export type CanvasTool = "select" | "pen" | "eraser" | "text";

export type CanvasObjectLayout = {
  id: string;
  kind: CanvasObjectKind;
  size: CanvasObjectSize;
  center: CanvasPosition;
  sides: Record<CanvasConnectionSide, CanvasPosition>;
};

export type EdgeRenderModel = {
  edge: CanvasEdge;
  path: string;
  labelPosition: CanvasPosition;
  direction: CanvasEdgeDirection;
};

export type CanvasObjectTarget = {
  id: string;
  kind: CanvasObjectKind;
  side?: CanvasConnectionSide;
};
