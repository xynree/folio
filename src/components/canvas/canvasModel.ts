import type {
  Canvas,
  CanvasEdge,
  CanvasEdgeDirection,
  CanvasNote,
  CanvasReference,
  CanvasStroke,
  CanvasTextElement,
} from "../../types";
import type { CanvasObjectKind } from "./canvasTypes";

export function removeEdgesForObject(
  edges: CanvasEdge[],
  objectId: string,
): CanvasEdge[] {
  return edges.filter(
    (edge) => edge.fromId !== objectId && edge.toId !== objectId,
  );
}

export function removeItemFromCanvas(canvas: Canvas, itemId: string): Canvas {
  const positions = { ...canvas.positions };
  delete positions[itemId];

  return {
    ...canvas,
    itemIds: canvas.itemIds.filter((id) => id !== itemId),
    positions,
    edges: removeEdgesForObject(canvas.edges ?? [], itemId),
  };
}

export function moveCanvasObject(
  canvas: Canvas,
  kind: CanvasObjectKind,
  objectId: string,
  position: Canvas["positions"][string],
): Canvas {
  if (kind === "item") {
    return {
      ...canvas,
      positions: {
        ...canvas.positions,
        [objectId]: position,
      },
    };
  }

  if (kind === "reference") {
    return {
      ...canvas,
      references: canvas.references.map((reference) =>
        reference.id === objectId ? { ...reference, ...position } : reference,
      ),
    };
  }

  if (kind === "text") {
    return {
      ...canvas,
      texts: (canvas.texts ?? []).map((textElement) =>
        textElement.id === objectId ? { ...textElement, ...position } : textElement,
      ),
    };
  }

  return {
    ...canvas,
    notes: canvas.notes.map((note) =>
      note.id === objectId ? { ...note, ...position } : note,
    ),
  };
}

export function updateCanvasNoteText(
  canvas: Canvas,
  noteId: string,
  text: string,
): Canvas {
  return {
    ...canvas,
    notes: canvas.notes.map((note) =>
      note.id === noteId ? { ...note, text } : note,
    ),
  };
}

export function deleteCanvasNote(canvas: Canvas, noteId: string): Canvas {
  return {
    ...canvas,
    notes: canvas.notes.filter((note) => note.id !== noteId),
    edges: removeEdgesForObject(canvas.edges ?? [], noteId),
  };
}

export function addCanvasTextElement(
  canvas: Canvas,
  textElement: CanvasTextElement,
): Canvas {
  return {
    ...canvas,
    texts: [...(canvas.texts ?? []), textElement],
  };
}

export function updateCanvasTextElementText(
  canvas: Canvas,
  textElementId: string,
  text: string,
): Canvas {
  return {
    ...canvas,
    texts: (canvas.texts ?? []).map((textElement) =>
      textElement.id === textElementId ? { ...textElement, text } : textElement,
    ),
  };
}

export function deleteCanvasTextElement(
  canvas: Canvas,
  textElementId: string,
): Canvas {
  return {
    ...canvas,
    texts: (canvas.texts ?? []).filter(
      (textElement) => textElement.id !== textElementId,
    ),
    edges: removeEdgesForObject(canvas.edges ?? [], textElementId),
  };
}

export function removeCanvasReference(
  canvas: Canvas,
  referenceId: string,
): Canvas {
  return {
    ...canvas,
    references: canvas.references.filter(
      (reference) => reference.id !== referenceId,
    ),
    edges: removeEdgesForObject(canvas.edges ?? [], referenceId),
  };
}

export function addCanvasStroke(canvas: Canvas, stroke: CanvasStroke): Canvas {
  return {
    ...canvas,
    strokes: [...(canvas.strokes ?? []), stroke],
  };
}

export function removeLastCanvasStroke(canvas: Canvas): Canvas {
  return {
    ...canvas,
    strokes: (canvas.strokes ?? []).slice(0, -1),
  };
}

export function removeCanvasStrokes(
  canvas: Canvas,
  strokeIds: Set<string>,
): Canvas {
  return {
    ...canvas,
    strokes: (canvas.strokes ?? []).filter((stroke) => !strokeIds.has(stroke.id)),
  };
}

export function updateCanvasEdgeLabel(
  canvas: Canvas,
  edgeId: string,
  label: string,
): Canvas {
  const trimmed = label.trim();

  return {
    ...canvas,
    edges: (canvas.edges ?? []).map((edge) =>
      edge.id === edgeId ? { ...edge, label: trimmed || undefined } : edge,
    ),
  };
}

export function updateCanvasEdgeDirection(
  canvas: Canvas,
  edgeId: string,
  direction: CanvasEdgeDirection,
): Canvas {
  return {
    ...canvas,
    edges: (canvas.edges ?? []).map((edge) =>
      edge.id === edgeId ? { ...edge, direction } : edge,
    ),
  };
}

export function reverseCanvasEdgeDirection(
  canvas: Canvas,
  edgeId: string,
): Canvas {
  return {
    ...canvas,
    edges: (canvas.edges ?? []).map((edge) =>
      edge.id === edgeId
        ? {
            ...edge,
            fromId: edge.toId,
            toId: edge.fromId,
            fromSide: edge.toSide,
            toSide: edge.fromSide,
            direction: "forward",
          }
        : edge,
    ),
  };
}

export function deleteCanvasEdge(canvas: Canvas, edgeId: string): Canvas {
  return {
    ...canvas,
    edges: (canvas.edges ?? []).filter((edge) => edge.id !== edgeId),
  };
}

export function replaceCanvasNote(
  canvas: Canvas,
  note: CanvasNote,
): Canvas {
  return {
    ...canvas,
    notes: canvas.notes.map((currentNote) =>
      currentNote.id === note.id ? note : currentNote,
    ),
  };
}

export function replaceCanvasReference(
  canvas: Canvas,
  reference: CanvasReference,
): Canvas {
  return {
    ...canvas,
    references: canvas.references.map((currentReference) =>
      currentReference.id === reference.id ? reference : currentReference,
    ),
  };
}
