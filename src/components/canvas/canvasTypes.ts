import type {
  CanvasConnectionSide,
  CanvasEdge,
  CanvasEdgeDirection,
  CanvasObjectSize,
  CanvasPosition,
} from "../../types";

export type CanvasObjectKind =
  | "item"
  | "document"
  | "note"
  | "text"
  | "link"
  | "section";

export type CanvasTool =
  | "select"
  | "connect"
  | "pen"
  | "eraser"
  | "text"
  | "section";

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
