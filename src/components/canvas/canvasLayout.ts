import type {
  Canvas,
  CanvasLink,
  CanvasNote,
  CanvasObjectGeometry,
  CanvasSection,
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

export function canvasKindForItem(item: FolioItem): Extract<CanvasObjectKind, "item" | "document"> {
  return ["sketch", "anim"].includes(item.type) ? "item" : "document";
}

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
  const kind = canvasKindForItem(item);
  if (
    (dragPreview?.kind === "item" || dragPreview?.kind === "document")
    && dragPreview.id === item.id
  ) {
    return dragPreview.position;
  }

  const savedPosition = canvas?.positions[item.id] ?? {
    x: 80 + (index % 4) * 190,
    y: 90 + Math.floor(index / 4) * 230,
  };
  const size =
    kind === "item"
      ? sizeForCanvasImageObject("item", savedPosition, {
          width: item.mediaWidth,
          height: item.mediaHeight,
        })
      : objectLayoutFromPosition(item.id, "document", savedPosition).size;

  return {
    ...savedPosition,
    width: size.width,
    height: size.height,
  };
}

export function positionForCanvasLink(
  link: CanvasLink,
  dragPreview: CanvasDragPreview | null,
): CanvasObjectGeometry {
  if (dragPreview?.kind === "link" && dragPreview.id === link.id) {
    return dragPreview.position;
  }

  return {
    x: link.x,
    y: link.y,
    width: link.width,
    height: link.height,
  };
}

export function positionForCanvasSection(
  section: CanvasSection,
  dragPreview: CanvasDragPreview | null,
): CanvasObjectGeometry {
  if (dragPreview?.kind === "section" && dragPreview.id === section.id) {
    return dragPreview.position;
  }

  return {
    x: section.x,
    y: section.y,
    width: section.width,
    height: section.height,
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
  activeLinks,
  activeSections,
  activeTexts,
  dragPreview,
}: {
  activeCanvas: Canvas | null;
  activeItems: FolioItem[];
  activeNotes: CanvasNote[];
  activeLinks: CanvasLink[];
  activeSections: CanvasSection[];
  activeTexts: CanvasTextElement[];
  dragPreview: CanvasDragPreview | null;
}): Map<string, CanvasObjectLayout> {
  const layouts = new Map<string, CanvasObjectLayout>();

  activeItems.forEach((item, index) => {
    layouts.set(
      item.id,
      objectLayoutFromPosition(
        item.id,
        canvasKindForItem(item),
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

  activeLinks.forEach((link) => {
    layouts.set(
      link.id,
      objectLayoutFromPosition(
        link.id,
        "link",
        positionForCanvasLink(link, dragPreview),
      ),
    );
  });

  activeSections.forEach((section) => {
    layouts.set(
      section.id,
      objectLayoutFromPosition(
        section.id,
        "section",
        positionForCanvasSection(section, dragPreview),
      ),
    );
  });

  return layouts;
}
