import type {
  Canvas,
  CanvasNote,
  CanvasObjectGeometry,
  CanvasTextElement,
  FolioItem,
} from "../../types";
import {
  objectLayoutFromPosition,
  sizeForCanvasImageObject,
} from "./canvasGeometry";
import type { CanvasObjectKind, CanvasObjectLayout } from "./canvasTypes";

export type CanvasDragPreview = {
  id: string;
  kind: CanvasObjectKind;
  position: CanvasObjectGeometry;
};

export function itemsByIdFromItems(items: FolioItem[]): Map<string, FolioItem> {
  return new Map(items.map((item) => [item.id, item]));
}

export function itemsForCanvas(
  canvas: Canvas | null,
  itemsById: Map<string, FolioItem>,
): FolioItem[] {
  if (!canvas) return [];
  return canvas.itemIds
    .map((itemId) => itemsById.get(itemId))
    .filter(Boolean) as FolioItem[];
}

export function boardPreviewItemIds(
  canvases: Canvas[],
  previewLimit: number,
): string[] {
  return Array.from(
    new Set(
      canvases.flatMap((canvas) => canvas.itemIds.slice(0, previewLimit)),
    ),
  );
}

export function positionForCanvasItem(
  item: FolioItem,
  index: number,
  canvas: Canvas | null,
  dragPreview: CanvasDragPreview | null,
): CanvasObjectGeometry {
  if (dragPreview?.kind === "item" && dragPreview.id === item.id) {
    return dragPreview.position;
  }

  const savedPosition = canvas?.positions[item.id] ?? {
    x: 80 + (index % 4) * 190,
    y: 90 + Math.floor(index / 4) * 230,
  };
  const size = sizeForCanvasImageObject("item", savedPosition, {
    width: item.mediaWidth,
    height: item.mediaHeight,
  });

  return {
    ...savedPosition,
    width: size.width,
    height: size.height,
  };
}

export function positionForCanvasNote(
  note: CanvasNote,
  dragPreview: CanvasDragPreview | null,
): CanvasObjectGeometry {
  if (dragPreview?.kind === "note" && dragPreview.id === note.id) {
    return dragPreview.position;
  }

  return { x: note.x, y: note.y, width: note.width, height: note.height };
}

export function positionForCanvasText(
  textElement: CanvasTextElement,
  dragPreview: CanvasDragPreview | null,
): CanvasObjectGeometry {
  if (dragPreview?.kind === "text" && dragPreview.id === textElement.id) {
    return dragPreview.position;
  }

  return {
    x: textElement.x,
    y: textElement.y,
    width: textElement.width,
    height: textElement.height,
  };
}

export function buildCanvasObjectLayouts({
  activeCanvas,
  activeItems,
  activeNotes,
  activeTexts,
  dragPreview,
}: {
  activeCanvas: Canvas | null;
  activeItems: FolioItem[];
  activeNotes: CanvasNote[];
  activeTexts: CanvasTextElement[];
  dragPreview: CanvasDragPreview | null;
}): Map<string, CanvasObjectLayout> {
  const layouts = new Map<string, CanvasObjectLayout>();

  activeItems.forEach((item, index) => {
    layouts.set(
      item.id,
      objectLayoutFromPosition(
        item.id,
        "item",
        positionForCanvasItem(item, index, activeCanvas, dragPreview),
      ),
    );
  });

  activeNotes.forEach((note) => {
    layouts.set(
      note.id,
      objectLayoutFromPosition(
        note.id,
        "note",
        positionForCanvasNote(note, dragPreview),
      ),
    );
  });

  activeTexts.forEach((textElement) => {
    layouts.set(
      textElement.id,
      objectLayoutFromPosition(
        textElement.id,
        "text",
        positionForCanvasText(textElement, dragPreview),
      ),
    );
  });

  return layouts;
}
