import type {
  Canvas,
  CanvasEdge,
  CanvasEdgeDirection,
  CanvasLink,
  CanvasRelationshipType,
  CanvasNote,
  CanvasObjectSize,
  CanvasPosition,
  CanvasSection,
  CanvasStroke,
  CanvasTextElement,
  CanvasTextSize,
  CanvasViewportState,
} from "../../types";
import { addItemsToCanvas } from "../folio/model";
import { eraseStrokePathAtPoint } from "./canvasGeometry";
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

function updateTimestamp<T extends { updatedAt?: string }>(object: T): T {
  return { ...object, updatedAt: new Date().toISOString() };
}

export function moveCanvasObject(
  canvas: Canvas,
  kind: CanvasObjectKind,
  objectId: string,
  position: Canvas["positions"][string],
): Canvas {
  if (kind === "item" || kind === "document") {
    return {
      ...canvas,
      positions: {
        ...canvas.positions,
        [objectId]: position,
      },
    };
  }

  if (kind === "text") {
    return {
      ...canvas,
      texts: (canvas.texts ?? []).map((textElement) =>
        textElement.id === objectId
          ? updateTimestamp({ ...textElement, ...position })
          : textElement,
      ),
    };
  }

  if (kind === "link") {
    return {
      ...canvas,
      links: (canvas.links ?? []).map((link) =>
        link.id === objectId ? updateTimestamp({ ...link, ...position }) : link,
      ),
    };
  }

  if (kind === "section") {
    return {
      ...canvas,
      sections: (canvas.sections ?? []).map((section) =>
        section.id === objectId
          ? updateTimestamp({ ...section, ...position })
          : section,
      ),
    };
  }

  return {
    ...canvas,
    notes: canvas.notes.map((note) =>
      note.id === objectId ? updateTimestamp({ ...note, ...position }) : note,
    ),
  };
}

export function resizeCanvasObject(
  canvas: Canvas,
  kind: CanvasObjectKind,
  objectId: string,
  size: CanvasObjectSize,
): Canvas {
  if (kind === "item" || kind === "document") {
    const currentPosition = canvas.positions[objectId] ?? { x: 0, y: 0 };
    return {
      ...canvas,
      positions: {
        ...canvas.positions,
        [objectId]: {
          ...currentPosition,
          width: size.width,
          height: size.height,
        },
      },
    };
  }

  if (kind === "text") {
    return {
      ...canvas,
      texts: (canvas.texts ?? []).map((textElement) =>
        textElement.id === objectId
          ? updateTimestamp({ ...textElement, ...size })
          : textElement,
      ),
    };
  }

  if (kind === "link") {
    return {
      ...canvas,
      links: (canvas.links ?? []).map((link) =>
        link.id === objectId ? updateTimestamp({ ...link, ...size }) : link,
      ),
    };
  }

  if (kind === "section") {
    return {
      ...canvas,
      sections: (canvas.sections ?? []).map((section) =>
        section.id === objectId
          ? updateTimestamp({ ...section, ...size })
          : section,
      ),
    };
  }

  return {
    ...canvas,
    notes: canvas.notes.map((note) =>
      note.id === objectId ? updateTimestamp({ ...note, ...size }) : note,
    ),
  };
}

export function updateCanvasNoteText(
  canvas: Canvas,
  noteId: string,
  text: string,
): Canvas {
  const updatedAt = new Date().toISOString();
  return {
    ...canvas,
    notes: canvas.notes.map((note) =>
      note.id === noteId ? { ...note, text, updatedAt } : note,
    ),
  };
}

export function updateCanvasNoteSize(
  canvas: Canvas,
  noteId: string,
  size: CanvasTextSize,
): Canvas {
  return {
    ...canvas,
    notes: canvas.notes.map((note) =>
      note.id === noteId ? updateTimestamp({ ...note, size }) : note,
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

export function addCanvasLink(canvas: Canvas, link: CanvasLink): Canvas {
  return {
    ...canvas,
    links: [...(canvas.links ?? []), link],
  };
}

export function addDocumentToCanvas(
  canvas: Canvas,
  itemId: string,
  position?: CanvasPosition,
): Canvas {
  return addItemsToCanvas(canvas, [itemId], position);
}

export const addLinkToCanvas = addCanvasLink;

export function updateCanvasLink(
  canvas: Canvas,
  linkId: string,
  patch: Partial<
    Pick<
      CanvasLink,
      | "title"
      | "description"
      | "url"
      | "imageUrl"
      | "faviconUrl"
      | "sourceDomain"
    >
  >,
): Canvas {
  return {
    ...canvas,
    links: (canvas.links ?? []).map((link) =>
      link.id === linkId ? updateTimestamp({ ...link, ...patch }) : link,
    ),
  };
}

export function deleteCanvasLink(canvas: Canvas, linkId: string): Canvas {
  return {
    ...canvas,
    links: (canvas.links ?? []).filter((link) => link.id !== linkId),
    edges: removeEdgesForObject(canvas.edges ?? [], linkId),
  };
}

export function addCanvasSection(
  canvas: Canvas,
  section: CanvasSection,
): Canvas {
  return {
    ...canvas,
    sections: [...(canvas.sections ?? []), section],
  };
}

export const addSectionToCanvas = addCanvasSection;

export function updateCanvasSection(
  canvas: Canvas,
  sectionId: string,
  patch: Partial<Pick<CanvasSection, "title" | "color" | "collapsed">>,
): Canvas {
  return {
    ...canvas,
    sections: (canvas.sections ?? []).map((section) =>
      section.id === sectionId
        ? updateTimestamp({ ...section, ...patch })
        : section,
    ),
  };
}

export function deleteCanvasSection(canvas: Canvas, sectionId: string): Canvas {
  return {
    ...canvas,
    sections: (canvas.sections ?? []).filter(
      (section) => section.id !== sectionId,
    ),
    edges: removeEdgesForObject(canvas.edges ?? [], sectionId),
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
      textElement.id === textElementId
        ? updateTimestamp({ ...textElement, text })
        : textElement,
    ),
  };
}

export function updateCanvasTextElementSize(
  canvas: Canvas,
  textElementId: string,
  size: CanvasTextSize,
): Canvas {
  return {
    ...canvas,
    texts: (canvas.texts ?? []).map((textElement) =>
      textElement.id === textElementId
        ? updateTimestamp({ ...textElement, size })
        : textElement,
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

export function deleteCanvasObject(
  canvas: Canvas,
  kind: CanvasObjectKind,
  objectId: string,
): Canvas {
  if (kind === "item" || kind === "document") {
    return removeItemFromCanvas(canvas, objectId);
  }
  if (kind === "note") return deleteCanvasNote(canvas, objectId);
  if (kind === "text") return deleteCanvasTextElement(canvas, objectId);
  if (kind === "link") return deleteCanvasLink(canvas, objectId);
  return deleteCanvasSection(canvas, objectId);
}

export function moveCanvasObjects(
  canvas: Canvas,
  objects: Array<{
    id: string;
    kind: CanvasObjectKind;
    position: Canvas["positions"][string];
  }>,
): Canvas {
  return objects.reduce(
    (currentCanvas, object) =>
      moveCanvasObject(currentCanvas, object.kind, object.id, object.position),
    canvas,
  );
}

export function deleteCanvasObjects(
  canvas: Canvas,
  objects: Array<{ id: string; kind: CanvasObjectKind }>,
): Canvas {
  return objects.reduce(
    (currentCanvas, object) =>
      deleteCanvasObject(currentCanvas, object.kind, object.id),
    canvas,
  );
}

export type DuplicateCanvasObjectsResult = {
  canvas: Canvas;
  duplicatedObjects: Array<{ id: string; kind: CanvasObjectKind }>;
};

export function duplicateCanvasObjects(
  canvas: Canvas,
  objects: Array<{ id: string; kind: CanvasObjectKind }>,
  createDuplicateId: (kind: CanvasObjectKind) => string,
  options: { offset?: number; createdAt?: string } = {},
): DuplicateCanvasObjectsResult {
  const offset = options.offset ?? 36;
  const createdAt = options.createdAt ?? new Date().toISOString();
  const duplicatedObjects: Array<{ id: string; kind: CanvasObjectKind }> = [];

  let nextCanvas = objects.reduce((currentCanvas, object) => {
    if (object.kind === "note") {
      const source = currentCanvas.notes.find((note) => note.id === object.id);
      if (!source) return currentCanvas;
      const id = createDuplicateId("note");
      duplicatedObjects.push({ id, kind: "note" });
      return {
        ...currentCanvas,
        notes: [
          ...currentCanvas.notes,
          {
            ...source,
            id,
            x: source.x + offset,
            y: source.y + offset,
            createdAt,
            updatedAt: createdAt,
          },
        ],
      };
    }

    if (object.kind === "text") {
      const source = (currentCanvas.texts ?? []).find(
        (textElement) => textElement.id === object.id,
      );
      if (!source) return currentCanvas;
      const id = createDuplicateId("text");
      duplicatedObjects.push({ id, kind: "text" });
      return {
        ...currentCanvas,
        texts: [
          ...(currentCanvas.texts ?? []),
          {
            ...source,
            id,
            x: source.x + offset,
            y: source.y + offset,
            createdAt,
            updatedAt: createdAt,
          },
        ],
      };
    }

    if (object.kind === "link") {
      const source = (currentCanvas.links ?? []).find(
        (link) => link.id === object.id,
      );
      if (!source) return currentCanvas;
      const id = createDuplicateId("link");
      duplicatedObjects.push({ id, kind: "link" });
      return {
        ...currentCanvas,
        links: [
          ...(currentCanvas.links ?? []),
          {
            ...source,
            id,
            x: source.x + offset,
            y: source.y + offset,
            capturedAt: createdAt,
            updatedAt: createdAt,
          },
        ],
      };
    }

    if (object.kind === "section") {
      const source = (currentCanvas.sections ?? []).find(
        (section) => section.id === object.id,
      );
      if (!source) return currentCanvas;
      const id = createDuplicateId("section");
      duplicatedObjects.push({ id, kind: "section" });
      return {
        ...currentCanvas,
        sections: [
          ...(currentCanvas.sections ?? []),
          {
            ...source,
            id,
            x: source.x + offset,
            y: source.y + offset,
            createdAt,
            updatedAt: createdAt,
          },
        ],
      };
    }

    return currentCanvas;
  }, canvas);

  if (!duplicatedObjects.length) {
    nextCanvas = canvas;
  }

  return { canvas: nextCanvas, duplicatedObjects };
}

export function updateCanvasViewport(
  canvas: Canvas,
  viewport: CanvasViewportState,
): Canvas {
  return {
    ...canvas,
    viewport,
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
    strokes: (canvas.strokes ?? []).filter(
      (stroke) => !strokeIds.has(stroke.id),
    ),
  };
}

export function eraseCanvasStrokesAtPoint(
  canvas: Canvas,
  point: CanvasPosition,
  createStrokeId: () => string,
): Canvas {
  if (!canvas.strokes?.length) return canvas;

  let changed = false;
  const strokes = canvas.strokes.flatMap((stroke) => {
    const remainingPaths = eraseStrokePathAtPoint(stroke.path, point);
    if (remainingPaths.length === 1 && remainingPaths[0] === stroke.path) {
      return [stroke];
    }

    changed = true;
    return remainingPaths.map((path) => ({
      ...stroke,
      id: createStrokeId(),
      path,
    }));
  });

  return changed ? { ...canvas, strokes } : canvas;
}

export function updateCanvasEdgeLabel(
  canvas: Canvas,
  edgeId: string,
  label: string,
): Canvas {
  const trimmed = label.trim();
  const updatedAt = new Date().toISOString();

  return {
    ...canvas,
    edges: (canvas.edges ?? []).map((edge) =>
      edge.id === edgeId
        ? { ...edge, label: trimmed || undefined, updatedAt }
        : edge,
    ),
  };
}

export function updateCanvasEdgeDirection(
  canvas: Canvas,
  edgeId: string,
  direction: CanvasEdgeDirection,
): Canvas {
  const updatedAt = new Date().toISOString();
  return {
    ...canvas,
    edges: (canvas.edges ?? []).map((edge) =>
      edge.id === edgeId ? { ...edge, direction, updatedAt } : edge,
    ),
  };
}

export function updateCanvasEdgeRelationshipType(
  canvas: Canvas,
  edgeId: string,
  relationshipType: CanvasRelationshipType,
): Canvas {
  const updatedAt = new Date().toISOString();
  return {
    ...canvas,
    edges: (canvas.edges ?? []).map((edge) =>
      edge.id === edgeId ? { ...edge, relationshipType, updatedAt } : edge,
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
            updatedAt: new Date().toISOString(),
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

export function replaceCanvasNote(canvas: Canvas, note: CanvasNote): Canvas {
  return {
    ...canvas,
    notes: canvas.notes.map((currentNote) =>
      currentNote.id === note.id ? note : currentNote,
    ),
  };
}
