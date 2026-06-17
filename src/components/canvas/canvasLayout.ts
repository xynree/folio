import type {
  Canvas,
  CanvasNote,
  CanvasPosition,
  CanvasReference,
  CanvasTextElement,
  FolioItem,
} from "../../types";
import { objectLayoutFromPosition } from "./canvasGeometry";
import type { CanvasObjectKind, CanvasObjectLayout } from "./canvasTypes";

export type CanvasDragPreview = {
  id: string;
  kind: CanvasObjectKind;
  position: CanvasPosition;
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
): CanvasPosition {
  if (dragPreview?.kind === "item" && dragPreview.id === item.id) {
    return dragPreview.position;
  }

  return canvas?.positions[item.id] ?? {
    x: 80 + (index % 4) * 190,
    y: 90 + Math.floor(index / 4) * 230,
  };
}

export function positionForCanvasReference(
  reference: CanvasReference,
  dragPreview: CanvasDragPreview | null,
): CanvasPosition {
  if (dragPreview?.kind === "reference" && dragPreview.id === reference.id) {
    return dragPreview.position;
  }

  return { x: reference.x, y: reference.y };
}

export function positionForCanvasNote(
  note: CanvasNote,
  dragPreview: CanvasDragPreview | null,
): CanvasPosition {
  if (dragPreview?.kind === "note" && dragPreview.id === note.id) {
    return dragPreview.position;
  }

  return { x: note.x, y: note.y };
}

export function positionForCanvasText(
  textElement: CanvasTextElement,
  dragPreview: CanvasDragPreview | null,
): CanvasPosition {
  if (dragPreview?.kind === "text" && dragPreview.id === textElement.id) {
    return dragPreview.position;
  }

  return { x: textElement.x, y: textElement.y };
}

export function buildCanvasObjectLayouts({
  activeCanvas,
  activeItems,
  activeNotes,
  activeReferences,
  activeTexts,
  dragPreview,
}: {
  activeCanvas: Canvas | null;
  activeItems: FolioItem[];
  activeNotes: CanvasNote[];
  activeReferences: CanvasReference[];
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

  activeReferences.forEach((reference) => {
    layouts.set(
      reference.id,
      objectLayoutFromPosition(
        reference.id,
        "reference",
        positionForCanvasReference(reference, dragPreview),
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
