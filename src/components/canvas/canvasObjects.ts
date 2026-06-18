import type {
  Canvas,
  CanvasLink,
  CanvasNote,
  CanvasObjectGeometry,
  CanvasSection,
  CanvasTextElement,
  FolioItem,
} from "../../types";
import { itemDisplayTitle } from "../folio/model";
import {
  canvasKindForItem,
  positionForCanvasItem,
  positionForCanvasLink,
  positionForCanvasNote,
  positionForCanvasSection,
  positionForCanvasText,
  type CanvasDragPreview,
} from "./canvasLayout";
import type { CanvasObjectKind } from "./canvasTypes";

export type CanvasObjectView = {
  id: string;
  kind: CanvasObjectKind;
  geometry: CanvasObjectGeometry;
  title: string;
  connectable: boolean;
  selectable: boolean;
};

export function canvasObjectViews({
  canvas,
  items,
  notes,
  texts,
  links,
  sections,
  dragPreview,
}: {
  canvas: Canvas | null;
  items: FolioItem[];
  notes: CanvasNote[];
  texts: CanvasTextElement[];
  links: CanvasLink[];
  sections: CanvasSection[];
  dragPreview: CanvasDragPreview | null;
}): CanvasObjectView[] {
  const itemViews = items.map((item, index) => ({
    id: item.id,
    kind: canvasKindForItem(item),
    geometry: positionForCanvasItem(item, index, canvas, dragPreview),
    title: itemDisplayTitle(item),
    connectable: true,
    selectable: true,
  }));

  const noteViews = notes.map((note) => ({
    id: note.id,
    kind: "note" as const,
    geometry: positionForCanvasNote(note, dragPreview),
    title: note.text.trim() || "Note",
    connectable: true,
    selectable: true,
  }));

  const textViews = texts.map((textElement) => ({
    id: textElement.id,
    kind: "text" as const,
    geometry: positionForCanvasText(textElement, dragPreview),
    title: textElement.text.trim() || "Text",
    connectable: true,
    selectable: true,
  }));

  const linkViews = links.map((link) => ({
    id: link.id,
    kind: "link" as const,
    geometry: positionForCanvasLink(link, dragPreview),
    title: link.title || link.url,
    connectable: true,
    selectable: true,
  }));

  const sectionViews = sections.map((section) => ({
    id: section.id,
    kind: "section" as const,
    geometry: positionForCanvasSection(section, dragPreview),
    title: section.title || "Section",
    connectable: true,
    selectable: true,
  }));

  return [
    ...sectionViews,
    ...itemViews,
    ...linkViews,
    ...noteViews,
    ...textViews,
  ];
}
