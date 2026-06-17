import type { CanvasObjectGeometry } from "../../types";
import type { CanvasObjectKind } from "./canvasTypes";

export type CanvasObjectSelection = {
  id: string;
  kind: CanvasObjectKind;
};

export type CanvasSelectionRectangle = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SelectableCanvasObject = CanvasObjectSelection & {
  geometry: CanvasObjectGeometry;
};

export function canvasObjectSelectionKey(selection: CanvasObjectSelection) {
  return `${selection.kind}:${selection.id}`;
}

export function selectionSetFromObjects(selections: CanvasObjectSelection[]) {
  return new Set(selections.map(canvasObjectSelectionKey));
}

export function toggleCanvasObjectSelection(
  selections: CanvasObjectSelection[],
  selection: CanvasObjectSelection,
): CanvasObjectSelection[] {
  const key = canvasObjectSelectionKey(selection);
  const selected = selectionSetFromObjects(selections);
  if (!selected.has(key)) return [...selections, selection];
  return selections.filter((current) => canvasObjectSelectionKey(current) !== key);
}

export function normalizedSelectionRectangle(
  start: { x: number; y: number },
  end: { x: number; y: number },
): CanvasSelectionRectangle {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  return {
    x,
    y,
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

function objectIntersectsRectangle(
  object: SelectableCanvasObject,
  rectangle: CanvasSelectionRectangle,
) {
  const objectWidth = object.geometry.width ?? 0;
  const objectHeight = object.geometry.height ?? 0;
  const objectLeft = object.geometry.x;
  const objectTop = object.geometry.y;
  const objectRight = objectLeft + objectWidth;
  const objectBottom = objectTop + objectHeight;
  const rectangleRight = rectangle.x + rectangle.width;
  const rectangleBottom = rectangle.y + rectangle.height;

  return (
    objectLeft <= rectangleRight
    && objectRight >= rectangle.x
    && objectTop <= rectangleBottom
    && objectBottom >= rectangle.y
  );
}

export function selectCanvasObjectsInRectangle(
  objects: SelectableCanvasObject[],
  rectangle: CanvasSelectionRectangle,
): CanvasObjectSelection[] {
  if (rectangle.width < 4 && rectangle.height < 4) return [];

  return objects
    .filter((object) => objectIntersectsRectangle(object, rectangle))
    .map(({ id, kind }) => ({ id, kind }));
}
