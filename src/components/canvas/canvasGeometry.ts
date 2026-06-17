import type {
  CanvasConnectionSide,
  CanvasEdge,
  CanvasEdgeDirection,
  CanvasObjectGeometry,
  CanvasObjectSize,
  CanvasPosition,
  CanvasStroke,
} from "../../types";
import { CANVAS_WORLD_ORIGIN } from "../folio/constants";
import type {
  CanvasObjectKind,
  CanvasObjectLayout,
  EdgeRenderModel,
} from "./canvasTypes";

export const CANVAS_OBJECT_SIZES: Record<CanvasObjectKind, CanvasObjectSize> = {
  item: { width: 162, height: 190 },
  reference: { width: 162, height: 214 },
  note: { width: 220, height: 150 },
  text: { width: 220, height: 96 },
};

export const CANVAS_OBJECT_MIN_SIZES: Record<CanvasObjectKind, CanvasObjectSize> = {
  item: { width: 118, height: 138 },
  reference: { width: 118, height: 156 },
  note: { width: 150, height: 104 },
  text: { width: 132, height: 60 },
};

export const CANVAS_CONNECTION_SIDES: CanvasConnectionSide[] = [
  "top",
  "right",
  "bottom",
  "left",
];

export const ERASER_RADIUS = 18;
const SVG_PATH_NUMBER_PATTERN = /-?\d+(?:\.\d+)?/g;
const GEOMETRY_EPSILON = 0.001;
const MIN_REMAINING_STROKE_LENGTH = 0.5;

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

export function sizeForCanvasObject(
  kind: CanvasObjectKind,
  geometry?: Partial<CanvasObjectSize>,
): CanvasObjectSize {
  const defaultSize = CANVAS_OBJECT_SIZES[kind];
  return {
    width: geometry?.width ?? defaultSize.width,
    height: geometry?.height ?? defaultSize.height,
  };
}

export function constrainCanvasObjectSize(
  kind: CanvasObjectKind,
  size: CanvasObjectSize,
): CanvasObjectSize {
  const minSize = CANVAS_OBJECT_MIN_SIZES[kind];
  return {
    width: Math.max(minSize.width, Math.round(size.width)),
    height: Math.max(minSize.height, Math.round(size.height)),
  };
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
  position: CanvasObjectGeometry,
  kind: CanvasObjectKind,
  side: CanvasConnectionSide,
) {
  const size = sizeForCanvasObject(kind, position);
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
  position: CanvasObjectGeometry,
): CanvasObjectLayout {
  const size = sizeForCanvasObject(kind, position);
  const absoluteX = position.x + CANVAS_WORLD_ORIGIN;
  const absoluteY = position.y + CANVAS_WORLD_ORIGIN;

  return {
    id,
    kind,
    size,
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

function distanceBetweenPoints(first: CanvasPosition, second: CanvasPosition) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function pointsAreClose(first: CanvasPosition, second: CanvasPosition) {
  return distanceBetweenPoints(first, second) <= GEOMETRY_EPSILON;
}

function interpolatePoint(
  segmentStart: CanvasPosition,
  segmentEnd: CanvasPosition,
  parameter: number,
): CanvasPosition {
  return {
    x: segmentStart.x + (segmentEnd.x - segmentStart.x) * parameter,
    y: segmentStart.y + (segmentEnd.y - segmentStart.y) * parameter,
  };
}

function segmentCircleIntersections(
  segmentStart: CanvasPosition,
  segmentEnd: CanvasPosition,
  center: CanvasPosition,
  radius: number,
) {
  const segmentX = segmentEnd.x - segmentStart.x;
  const segmentY = segmentEnd.y - segmentStart.y;
  const startX = segmentStart.x - center.x;
  const startY = segmentStart.y - center.y;

  const a = segmentX * segmentX + segmentY * segmentY;
  if (a <= GEOMETRY_EPSILON) return [];

  const b = 2 * (startX * segmentX + startY * segmentY);
  const c = startX * startX + startY * startY - radius * radius;
  const discriminant = b * b - 4 * a * c;

  if (discriminant <= GEOMETRY_EPSILON) return [];

  const squareRoot = Math.sqrt(discriminant);
  return [
    (-b - squareRoot) / (2 * a),
    (-b + squareRoot) / (2 * a),
  ].filter(
    (parameter) =>
      parameter > GEOMETRY_EPSILON
      && parameter < 1 - GEOMETRY_EPSILON,
  );
}

function uniqueSortedParameters(parameters: number[]) {
  return parameters
    .map((parameter) => Math.max(0, Math.min(1, parameter)))
    .sort((first, second) => first - second)
    .filter(
      (parameter, index, sorted) =>
        index === 0 || Math.abs(parameter - sorted[index - 1]) > GEOMETRY_EPSILON,
    );
}

function segmentOutsideEraserPieces(
  segmentStart: CanvasPosition,
  segmentEnd: CanvasPosition,
  center: CanvasPosition,
  radius: number,
): [CanvasPosition, CanvasPosition][] {
  if (distanceBetweenPoints(segmentStart, segmentEnd) <= GEOMETRY_EPSILON) {
    return distanceBetweenPoints(segmentStart, center) > radius
      ? [[segmentStart, segmentEnd]]
      : [];
  }

  const bounds = uniqueSortedParameters([
    0,
    ...segmentCircleIntersections(segmentStart, segmentEnd, center, radius),
    1,
  ]);
  const pieces: [CanvasPosition, CanvasPosition][] = [];

  for (let index = 1; index < bounds.length; index += 1) {
    const startParameter = bounds[index - 1];
    const endParameter = bounds[index];
    if (endParameter - startParameter <= GEOMETRY_EPSILON) continue;

    const midpoint = interpolatePoint(
      segmentStart,
      segmentEnd,
      (startParameter + endParameter) / 2,
    );
    if (distanceBetweenPoints(midpoint, center) <= radius) continue;

    pieces.push([
      interpolatePoint(segmentStart, segmentEnd, startParameter),
      interpolatePoint(segmentStart, segmentEnd, endParameter),
    ]);
  }

  return pieces;
}

function strokeLength(points: CanvasPosition[]) {
  return points.reduce((length, point, index) => {
    if (index === 0) return length;
    return length + distanceBetweenPoints(points[index - 1], point);
  }, 0);
}

function remainingPolylinesOutsideEraser(
  points: CanvasPosition[],
  center: CanvasPosition,
  radius: number,
) {
  const polylines: CanvasPosition[][] = [];
  let currentPolyline: CanvasPosition[] = [];

  const finishCurrentPolyline = () => {
    if (
      currentPolyline.length >= 2
      && strokeLength(currentPolyline) >= MIN_REMAINING_STROKE_LENGTH
    ) {
      polylines.push(currentPolyline);
    }
    currentPolyline = [];
  };

  const appendPiece = (pieceStart: CanvasPosition, pieceEnd: CanvasPosition) => {
    if (distanceBetweenPoints(pieceStart, pieceEnd) < MIN_REMAINING_STROKE_LENGTH) {
      return;
    }

    const lastPoint = currentPolyline[currentPolyline.length - 1];
    if (!lastPoint || !pointsAreClose(lastPoint, pieceStart)) {
      finishCurrentPolyline();
      currentPolyline = [pieceStart];
    }

    if (!pointsAreClose(currentPolyline[currentPolyline.length - 1], pieceEnd)) {
      currentPolyline.push(pieceEnd);
    }
  };

  for (let index = 1; index < points.length; index += 1) {
    const pieces = segmentOutsideEraserPieces(
      points[index - 1],
      points[index],
      center,
      radius,
    );

    if (!pieces.length) {
      finishCurrentPolyline();
      continue;
    }

    pieces.forEach(([pieceStart, pieceEnd]) => {
      appendPiece(pieceStart, pieceEnd);
    });
  }

  finishCurrentPolyline();
  return polylines;
}

export function strokeIntersectsEraser(
  stroke: CanvasStroke,
  center: CanvasPosition,
  radius = ERASER_RADIUS,
) {
  const points = pointsFromStrokePath(stroke.path);

  if (points.length === 1) {
    return distanceBetweenPoints(points[0], center) <= radius;
  }

  for (let index = 1; index < points.length; index += 1) {
    if (distanceToSegment(center, points[index - 1], points[index]) <= radius) {
      return true;
    }
  }

  return false;
}

export function eraseStrokePathAtPoint(
  path: string,
  center: CanvasPosition,
  radius = ERASER_RADIUS,
) {
  const points = pointsFromStrokePath(path);
  if (!points.length) return [];

  if (points.length === 1) {
    return distanceBetweenPoints(points[0], center) <= radius ? [] : [path];
  }

  const stroke = { id: "", color: "", path };
  if (!strokeIntersectsEraser(stroke, center, radius)) {
    return [path];
  }

  const remainingPaths = remainingPolylinesOutsideEraser(points, center, radius)
    .map(buildPolylinePath)
    .filter(Boolean);

  if (remainingPaths.length === 1 && remainingPaths[0] === path) {
    return [path];
  }

  return remainingPaths;
}
