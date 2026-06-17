import type {
  CanvasConnectionSide,
  CanvasEdge,
  CanvasEdgeDirection,
  CanvasPosition,
  CanvasStroke,
} from "../../types";
import { CANVAS_WORLD_ORIGIN } from "../folio/constants";
import type {
  CanvasObjectKind,
  CanvasObjectLayout,
  EdgeRenderModel,
} from "./canvasTypes";

export const CANVAS_OBJECT_SIZES: Record<
  CanvasObjectKind,
  { width: number; height: number }
> = {
  item: { width: 162, height: 190 },
  reference: { width: 162, height: 214 },
  note: { width: 220, height: 150 },
  text: { width: 220, height: 96 },
};

export const CANVAS_CONNECTION_SIDES: CanvasConnectionSide[] = [
  "top",
  "right",
  "bottom",
  "left",
];

export const ERASER_RADIUS = 18;
const STROKE_HIT_PADDING = 3;
const SVG_PATH_NUMBER_PATTERN = /-?\d+(?:\.\d+)?/g;

export function buildPolylinePath(points: CanvasPosition[]) {
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

export function isCanvasConnectionSide(
  value: string | undefined,
): value is CanvasConnectionSide {
  return Boolean(
    value
      && CANVAS_CONNECTION_SIDES.includes(value as CanvasConnectionSide),
  );
}

export function edgeDirection(edge: CanvasEdge): CanvasEdgeDirection {
  return edge.direction ?? "none";
}

export function bestConnectionSide(
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

export function sidePointFromPosition(
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

export function objectLayoutFromPosition(
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

export function buildEdgePath(
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

export function edgeLabelPosition(from: CanvasPosition, to: CanvasPosition) {
  return {
    x: (from.x + to.x) / 2,
    y: (from.y + to.y) / 2,
  };
}

export function edgeRenderModelFromLayouts(
  edge: CanvasEdge,
  layouts: Map<string, CanvasObjectLayout>,
): EdgeRenderModel | null {
  const from = layouts.get(edge.fromId);
  const to = layouts.get(edge.toId);
  if (!from || !to) return null;

  const fromSide = edge.fromSide ?? bestConnectionSide(from.center, to.center);
  const toSide = edge.toSide ?? bestConnectionSide(to.center, from.center);
  const fromPoint = from.sides[fromSide];
  const toPoint = to.sides[toSide];

  return {
    edge,
    path: buildEdgePath(fromPoint, toPoint, fromSide, toSide),
    labelPosition: edgeLabelPosition(fromPoint, toPoint),
    direction: edgeDirection(edge),
  };
}

export function edgeRenderModelsFromLayouts(
  edges: CanvasEdge[],
  layouts: Map<string, CanvasObjectLayout>,
) {
  return edges
    .map((edge) => edgeRenderModelFromLayouts(edge, layouts))
    .filter(Boolean) as EdgeRenderModel[];
}

export function pointsFromStrokePath(path: string) {
  const values = path.match(SVG_PATH_NUMBER_PATTERN)?.map(Number) ?? [];
  const points: CanvasPosition[] = [];
  for (let index = 0; index < values.length - 1; index += 2) {
    points.push({ x: values[index], y: values[index + 1] });
  }
  return points;
}

export function distanceToSegment(
  point: CanvasPosition,
  segmentStart: CanvasPosition,
  segmentEnd: CanvasPosition,
) {
  const segmentX = segmentEnd.x - segmentStart.x;
  const segmentY = segmentEnd.y - segmentStart.y;
  const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;

  if (!segmentLengthSquared) {
    return Math.hypot(point.x - segmentStart.x, point.y - segmentStart.y);
  }

  const projection = (
    ((point.x - segmentStart.x) * segmentX)
    + ((point.y - segmentStart.y) * segmentY)
  ) / segmentLengthSquared;
  const clampedProjection = Math.max(0, Math.min(1, projection));
  const closestPoint = {
    x: segmentStart.x + clampedProjection * segmentX,
    y: segmentStart.y + clampedProjection * segmentY,
  };
  return Math.hypot(point.x - closestPoint.x, point.y - closestPoint.y);
}

export function strokeIntersectsEraser(
  stroke: CanvasStroke,
  center: CanvasPosition,
) {
  const points = pointsFromStrokePath(stroke.path);
  const hitRadius = ERASER_RADIUS + STROKE_HIT_PADDING;

  if (points.length === 1) {
    return Math.hypot(points[0].x - center.x, points[0].y - center.y) <= hitRadius;
  }

  for (let index = 1; index < points.length; index += 1) {
    if (distanceToSegment(center, points[index - 1], points[index]) <= hitRadius) {
      return true;
    }
  }

  return false;
}
