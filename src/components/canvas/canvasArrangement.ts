import type { CanvasObjectGeometry, CanvasSection } from "../../types";
import type { CanvasObjectKind } from "./canvasTypes";

export type ArrangeableCanvasObject = {
  id: string;
  kind: CanvasObjectKind;
  geometry: CanvasObjectGeometry;
};

export type CanvasObjectMovePatch = {
  id: string;
  kind: CanvasObjectKind;
  position: CanvasObjectGeometry;
};

export function tidyCanvasObjectsIntoGrid(
  objects: ArrangeableCanvasObject[],
  options: {
    columns?: number;
    gap?: number;
    origin?: { x: number; y: number };
  } = {},
): CanvasObjectMovePatch[] {
  if (!objects.length) return [];

  const columns = Math.max(
    1,
    options.columns ?? Math.ceil(Math.sqrt(objects.length)),
  );
  const gap = options.gap ?? 28;
  const origin = options.origin ?? {
    x: Math.min(...objects.map((object) => object.geometry.x)),
    y: Math.min(...objects.map((object) => object.geometry.y)),
  };
  const maxWidth = Math.max(
    ...objects.map((object) => object.geometry.width ?? 160),
  );
  const maxHeight = Math.max(
    ...objects.map((object) => object.geometry.height ?? 120),
  );

  return objects.map((object, index) => ({
    id: object.id,
    kind: object.kind,
    position: {
      ...object.geometry,
      x: origin.x + (index % columns) * (maxWidth + gap),
      y: origin.y + Math.floor(index / columns) * (maxHeight + gap),
    },
  }));
}

export function alignCanvasObjects(
  objects: ArrangeableCanvasObject[],
  alignment: "left" | "top" | "center-x" | "center-y",
): CanvasObjectMovePatch[] {
  if (!objects.length) return [];

  if (alignment === "left") {
    const x = Math.min(...objects.map((object) => object.geometry.x));
    return objects.map((object) => ({
      id: object.id,
      kind: object.kind,
      position: { ...object.geometry, x },
    }));
  }

  if (alignment === "top") {
    const y = Math.min(...objects.map((object) => object.geometry.y));
    return objects.map((object) => ({
      id: object.id,
      kind: object.kind,
      position: { ...object.geometry, y },
    }));
  }

  if (alignment === "center-x") {
    const centerX =
      objects.reduce(
        (sum, object) =>
          sum + object.geometry.x + (object.geometry.width ?? 0) / 2,
        0,
      ) / objects.length;
    return objects.map((object) => ({
      id: object.id,
      kind: object.kind,
      position: {
        ...object.geometry,
        x: centerX - (object.geometry.width ?? 0) / 2,
      },
    }));
  }

  const centerY =
    objects.reduce(
      (sum, object) =>
        sum + object.geometry.y + (object.geometry.height ?? 0) / 2,
      0,
    ) / objects.length;
  return objects.map((object) => ({
    id: object.id,
    kind: object.kind,
    position: {
      ...object.geometry,
      y: centerY - (object.geometry.height ?? 0) / 2,
    },
  }));
}

export function distributeCanvasObjects(
  objects: ArrangeableCanvasObject[],
  direction: "horizontal" | "vertical",
): CanvasObjectMovePatch[] {
  if (objects.length < 3) return [];

  const sortedObjects = [...objects].sort((first, second) =>
    direction === "horizontal"
      ? first.geometry.x - second.geometry.x
      : first.geometry.y - second.geometry.y,
  );
  const firstObject = sortedObjects[0];
  const lastObject = sortedObjects[sortedObjects.length - 1];

  if (direction === "horizontal") {
    const start = firstObject.geometry.x;
    const end = lastObject.geometry.x;
    const step = (end - start) / (sortedObjects.length - 1);

    return sortedObjects.map((object, index) => ({
      id: object.id,
      kind: object.kind,
      position: {
        ...object.geometry,
        x: start + step * index,
      },
    }));
  }

  const start = firstObject.geometry.y;
  const end = lastObject.geometry.y;
  const step = (end - start) / (sortedObjects.length - 1);

  return sortedObjects.map((object, index) => ({
    id: object.id,
    kind: object.kind,
    position: {
      ...object.geometry,
      y: start + step * index,
    },
  }));
}

export function canvasObjectBounds(objects: ArrangeableCanvasObject[]) {
  if (!objects.length) return null;

  const minX = Math.min(...objects.map((object) => object.geometry.x));
  const minY = Math.min(...objects.map((object) => object.geometry.y));
  const maxX = Math.max(
    ...objects.map(
      (object) => object.geometry.x + (object.geometry.width ?? 0),
    ),
  );
  const maxY = Math.max(
    ...objects.map(
      (object) => object.geometry.y + (object.geometry.height ?? 0),
    ),
  );

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function canvasObjectsWithinSection(
  section: ArrangeableCanvasObject,
  objects: ArrangeableCanvasObject[],
): ArrangeableCanvasObject[] {
  const left = section.geometry.x;
  const top = section.geometry.y;
  const right = left + (section.geometry.width ?? 0);
  const bottom = top + (section.geometry.height ?? 0);

  return objects.filter((object) => {
    if (object.kind === "section") return false;
    if (object.id === section.id) return false;

    const centerX = object.geometry.x + (object.geometry.width ?? 0) / 2;
    const centerY = object.geometry.y + (object.geometry.height ?? 0) / 2;
    return (
      centerX >= left && centerX <= right && centerY >= top && centerY <= bottom
    );
  });
}

export function sectionAroundCanvasObjects(
  objects: ArrangeableCanvasObject[],
  options: {
    id: string;
    title?: string;
    color?: string;
    padding?: number;
    createdAt?: string;
  },
): CanvasSection | null {
  const bounds = canvasObjectBounds(objects);
  if (!bounds) return null;

  const padding = options.padding ?? 36;
  const createdAt = options.createdAt ?? new Date().toISOString();

  return {
    id: options.id,
    title: options.title ?? "Section",
    color: options.color,
    x: bounds.x - padding,
    y: bounds.y - padding - 36,
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2 + 36,
    createdAt,
    updatedAt: createdAt,
  };
}
