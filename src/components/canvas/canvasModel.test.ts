import { describe, expect, it } from "vitest";
import type { Canvas } from "../../types";
import {
  addCanvasStroke,
  addDocumentToCanvas,
  addCanvasLink,
  addCanvasSection,
  addCanvasTextElement,
  deleteCanvasLink,
  deleteCanvasEdge,
  deleteCanvasNote,
  deleteCanvasObject,
  deleteCanvasObjects,
  deleteCanvasSection,
  deleteCanvasTextElement,
  duplicateCanvasObjects,
  eraseCanvasStrokesAtPoint,
  moveCanvasObjects,
  moveCanvasObject,
  removeCanvasStrokes,
  removeItemFromCanvas,
  removeLastCanvasStroke,
  replaceCanvasNote,
  resizeCanvasObject,
  reverseCanvasEdgeDirection,
  updateCanvasEdgeDirection,
  updateCanvasEdgeLabel,
  updateCanvasEdgeRelationshipType,
  updateCanvasLink,
  updateCanvasNoteText,
  updateCanvasSection,
  updateCanvasTextElementSize,
  updateCanvasTextElementText,
  updateCanvasViewport,
} from "./canvasModel";

function canvasFixture(): Canvas {
  return {
    id: "canvas-1",
    title: "Board",
    color: "#385d56",
    itemIds: ["item-1", "item-2"],
    positions: {
      "item-1": { x: 10, y: 20 },
      "item-2": { x: 100, y: 120 },
    },
    notes: [{ id: "note-1", text: "Old", x: 20, y: 30 }],
    edges: [
      {
        id: "edge-1",
        fromId: "item-1",
        toId: "note-1",
        fromSide: "right",
        toSide: "left",
        direction: "forward",
        label: "draft",
      },
      {
        id: "edge-2",
        fromId: "item-2",
        toId: "text-1",
        fromSide: "bottom",
        toSide: "top",
      },
    ],
    strokes: [{ id: "stroke-1", color: "#111111", path: "M 0 0 L 10 10" }],
    texts: [{ id: "text-1", text: "Caption", x: 60, y: 70 }],
    links: [
      {
        id: "link-1",
        title: "Example",
        url: "https://example.com/",
        capturedAt: "2026-06-15T08:00:00.000Z",
        x: 80,
        y: 90,
      },
    ],
    sections: [
      { id: "section-1", title: "Research", x: 5, y: 6, width: 500, height: 300 },
    ],
  };
}

describe("canvas model helpers", () => {
  it("removes archive items with their positions and connected edges", () => {
    const nextCanvas = removeItemFromCanvas(canvasFixture(), "item-1");

    expect(nextCanvas.itemIds).toEqual(["item-2"]);
    expect(nextCanvas.positions).toEqual({ "item-2": { x: 100, y: 120 } });
    expect(nextCanvas.edges.map((edge) => edge.id)).toEqual(["edge-2"]);
  });

  it("updates and deletes notes while cleaning connected links", () => {
    const updatedCanvas = updateCanvasNoteText(canvasFixture(), "note-1", "New");

    expect(updatedCanvas.notes[0].text).toBe("New");
    expect(deleteCanvasNote(updatedCanvas, "note-1").edges).toEqual([
      expect.objectContaining({ id: "edge-2" }),
    ]);
  });

  it("updates and deletes text elements while cleaning connected links", () => {
    const withLinkedText: Canvas = {
      ...canvasFixture(),
      edges: [
        ...canvasFixture().edges,
        { id: "edge-3", fromId: "text-1", toId: "item-2" },
      ],
    };
    const updatedCanvas = updateCanvasTextElementText(
      withLinkedText,
      "text-1",
      "Edited",
    );

    expect(updatedCanvas.texts?.[0].text).toBe("Edited");
    expect(updatedCanvas.texts?.[0].updatedAt).toBeDefined();
    expect(
      updateCanvasTextElementSize(updatedCanvas, "text-1", "large").texts?.[0]
        .size,
    ).toBe("large");
    expect(deleteCanvasTextElement(updatedCanvas, "text-1").edges).toHaveLength(1);
  });

  it("adds, updates, and deletes link cards while cleaning connected links", () => {
    const canvas = {
      ...canvasFixture(),
      edges: [
        ...canvasFixture().edges,
        { id: "edge-3", fromId: "link-1", toId: "item-2" },
      ],
    };
    const addedCanvas = addCanvasLink(canvas, {
      id: "link-2",
      title: "Source",
      url: "https://source.test/",
      capturedAt: "2026-06-17T08:00:00.000Z",
      x: 20,
      y: 30,
    });
    const updatedCanvas = updateCanvasLink(addedCanvas, "link-1", {
      title: "Edited",
      description: "Reference",
    });

    expect(addedCanvas.links?.map((link) => link.id)).toEqual(["link-1", "link-2"]);
    expect(updatedCanvas.links?.[0]).toMatchObject({
      title: "Edited",
      description: "Reference",
    });
    expect(deleteCanvasLink(updatedCanvas, "link-1").edges.map((edge) => edge.id))
      .toEqual(["edge-1", "edge-2"]);
  });

  it("adds, updates, and deletes sections while cleaning connected links", () => {
    const canvas = {
      ...canvasFixture(),
      edges: [
        ...canvasFixture().edges,
        { id: "edge-3", fromId: "section-1", toId: "item-2" },
      ],
    };
    const addedCanvas = addCanvasSection(canvas, {
      id: "section-2",
      title: "Ideas",
      x: 20,
      y: 30,
      width: 300,
      height: 200,
    });
    const updatedCanvas = updateCanvasSection(addedCanvas, "section-1", {
      title: "Research",
      collapsed: true,
    });

    expect(addedCanvas.sections?.map((section) => section.id)).toEqual([
      "section-1",
      "section-2",
    ]);
    expect(updatedCanvas.sections?.[0]).toMatchObject({
      title: "Research",
      collapsed: true,
    });
    expect(deleteCanvasSection(updatedCanvas, "section-1").edges.map((edge) => edge.id))
      .toEqual(["edge-1", "edge-2"]);
  });

  it("adds and removes strokes", () => {
    const addedCanvas = addCanvasStroke(canvasFixture(), {
      id: "stroke-2",
      color: "#222222",
      path: "M 20 20 L 30 30",
    });

    expect(addedCanvas.strokes?.map((stroke) => stroke.id)).toEqual([
      "stroke-1",
      "stroke-2",
    ]);
    expect(removeLastCanvasStroke(addedCanvas).strokes?.map((stroke) => stroke.id))
      .toEqual(["stroke-1"]);
    expect(
      removeCanvasStrokes(addedCanvas, new Set(["stroke-1"])).strokes?.map(
        (stroke) => stroke.id,
      ),
    ).toEqual(["stroke-2"]);
  });

  it("erases only the stroke portions inside the eraser circle", () => {
    let idCounter = 0;
    const canvas: Canvas = {
      ...canvasFixture(),
      strokes: [
        { id: "stroke-1", color: "#111111", path: "M 100 100 L 200 100" },
        { id: "stroke-2", color: "#222222", path: "M 240 100 L 280 100" },
      ],
    };

    const nextCanvas = eraseCanvasStrokesAtPoint(
      canvas,
      { x: 150, y: 100 },
      () => `stroke-piece-${idCounter += 1}`,
    );

    expect(nextCanvas.strokes).toEqual([
      { id: "stroke-piece-1", color: "#111111", path: "M 100 100 L 132 100" },
      { id: "stroke-piece-2", color: "#111111", path: "M 168 100 L 200 100" },
      { id: "stroke-2", color: "#222222", path: "M 240 100 L 280 100" },
    ]);
  });

  it("updates edge labels and direction state", () => {
    const labeledCanvas = updateCanvasEdgeLabel(canvasFixture(), "edge-1", "  Final ");
    const unlabeledCanvas = updateCanvasEdgeLabel(labeledCanvas, "edge-1", " ");
    const directedCanvas = updateCanvasEdgeDirection(
      unlabeledCanvas,
      "edge-2",
      "bidirectional",
    );
    const typedCanvas = updateCanvasEdgeRelationshipType(
      directedCanvas,
      "edge-2",
      "version-of",
    );
    const reversedCanvas = reverseCanvasEdgeDirection(typedCanvas, "edge-2");
    const edge = reversedCanvas.edges.find((currentEdge) => currentEdge.id === "edge-2");

    expect(labeledCanvas.edges[0].label).toBe("Final");
    expect(unlabeledCanvas.edges[0].label).toBeUndefined();
    expect(edge).toEqual(
      expect.objectContaining({
        fromId: "text-1",
        toId: "item-2",
        fromSide: "top",
        toSide: "bottom",
        direction: "forward",
        relationshipType: "version-of",
      }),
    );
    expect(deleteCanvasEdge(reversedCanvas, "edge-2").edges.map((item) => item.id))
      .toEqual(["edge-1"]);
  });

  it("adds text elements to canvases that do not have text arrays yet", () => {
    const canvasWithoutText = { ...canvasFixture(), texts: undefined };
    const nextCanvas = addCanvasTextElement(canvasWithoutText, {
      id: "text-2",
      text: "New",
      x: 80,
      y: 90,
    });

    expect(nextCanvas.texts).toEqual([
      { id: "text-2", text: "New", x: 80, y: 90 },
    ]);
  });

  it("adds document items through a named canvas helper", () => {
    const nextCanvas = addDocumentToCanvas(canvasFixture(), "document-1", {
      x: 200,
      y: 220,
    });

    expect(nextCanvas.itemIds).toContain("document-1");
    expect(nextCanvas.positions["document-1"]).toEqual({ x: 200, y: 220 });
  });

  it("moves every supported canvas object kind", () => {
    const canvas = {
      ...canvasFixture(),
      edges: [],
    };

    expect(
      moveCanvasObject(canvas, "item", "item-1", { x: 11, y: 12 }).positions[
        "item-1"
      ],
    ).toEqual({ x: 11, y: 12 });
    expect(
      moveCanvasObject(canvas, "note", "note-1", { x: 31, y: 32 }).notes[0],
    ).toEqual(expect.objectContaining({ x: 31, y: 32 }));
    expect(
      moveCanvasObject(canvas, "text", "text-1", { x: 41, y: 42 }).texts?.[0],
    ).toEqual(expect.objectContaining({ x: 41, y: 42 }));
    expect(
      moveCanvasObject(canvas, "link", "link-1", { x: 51, y: 52 }).links?.[0],
    ).toEqual(expect.objectContaining({ x: 51, y: 52 }));
    expect(
      moveCanvasObject(canvas, "section", "section-1", { x: 61, y: 62 }).sections?.[0],
    ).toEqual(expect.objectContaining({ x: 61, y: 62 }));
  });

  it("resizes every supported canvas object kind", () => {
    const resizedItemCanvas = resizeCanvasObject(
      canvasFixture(),
      "item",
      "item-1",
      { width: 240, height: 280 },
    );
    const resizedNoteCanvas = resizeCanvasObject(
      canvasFixture(),
      "note",
      "note-1",
      { width: 280, height: 180 },
    );
    const resizedTextCanvas = resizeCanvasObject(
      canvasFixture(),
      "text",
      "text-1",
      { width: 300, height: 120 },
    );
    const resizedLinkCanvas = resizeCanvasObject(
      canvasFixture(),
      "link",
      "link-1",
      { width: 320, height: 180 },
    );
    const resizedSectionCanvas = resizeCanvasObject(
      canvasFixture(),
      "section",
      "section-1",
      { width: 620, height: 420 },
    );

    expect(resizedItemCanvas.positions["item-1"]).toMatchObject({
      x: 10,
      y: 20,
      width: 240,
      height: 280,
    });
    expect(resizedNoteCanvas.notes[0]).toMatchObject({
      width: 280,
      height: 180,
    });
    expect(resizedTextCanvas.texts?.[0]).toMatchObject({
      width: 300,
      height: 120,
    });
    expect(resizedLinkCanvas.links?.[0]).toMatchObject({
      width: 320,
      height: 180,
    });
    expect(resizedSectionCanvas.sections?.[0]).toMatchObject({
      width: 620,
      height: 420,
    });
  });

  it("supports batch object moves, deletes, and viewport updates", () => {
    const movedCanvas = moveCanvasObjects(canvasFixture(), [
      { id: "item-1", kind: "item", position: { x: 1, y: 2 } },
      { id: "link-1", kind: "link", position: { x: 3, y: 4 } },
    ]);
    const deletedCanvas = deleteCanvasObjects(movedCanvas, [
      { id: "link-1", kind: "link" },
      { id: "section-1", kind: "section" },
    ]);
    const viewportCanvas = updateCanvasViewport(deletedCanvas, {
      x: 100,
      y: 200,
      zoom: 0.8,
      updatedAt: "2026-06-17T08:00:00.000Z",
    });

    expect(movedCanvas.positions["item-1"]).toEqual({ x: 1, y: 2 });
    expect(movedCanvas.links?.[0]).toEqual(expect.objectContaining({ x: 3, y: 4 }));
    expect(deletedCanvas.links).toEqual([]);
    expect(deletedCanvas.sections).toEqual([]);
    expect(deleteCanvasObject(canvasFixture(), "document", "item-1").itemIds)
      .toEqual(["item-2"]);
    expect(viewportCanvas.viewport).toMatchObject({ x: 100, y: 200, zoom: 0.8 });
  });

  it("duplicates editable canvas objects and skips canonical project items", () => {
    const duplicated = duplicateCanvasObjects(
      canvasFixture(),
      [
        { id: "item-1", kind: "item" },
        { id: "note-1", kind: "note" },
        { id: "text-1", kind: "text" },
        { id: "link-1", kind: "link" },
        { id: "section-1", kind: "section" },
      ],
      (kind) => `${kind}-copy`,
      {
        createdAt: "2026-06-17T08:00:00.000Z",
        offset: 20,
      },
    );

    expect(duplicated.duplicatedObjects).toEqual([
      { id: "note-copy", kind: "note" },
      { id: "text-copy", kind: "text" },
      { id: "link-copy", kind: "link" },
      { id: "section-copy", kind: "section" },
    ]);
    expect(duplicated.canvas.itemIds).toEqual(["item-1", "item-2"]);
    expect(duplicated.canvas.notes[duplicated.canvas.notes.length - 1]).toMatchObject({
      id: "note-copy",
      x: 40,
      y: 50,
      createdAt: "2026-06-17T08:00:00.000Z",
    });
    expect(duplicated.canvas.texts?.[duplicated.canvas.texts.length - 1])
      .toMatchObject({
      id: "text-copy",
      x: 80,
      y: 90,
    });
    expect(duplicated.canvas.links?.[duplicated.canvas.links.length - 1])
      .toMatchObject({
      id: "link-copy",
      x: 100,
      y: 110,
      capturedAt: "2026-06-17T08:00:00.000Z",
    });
    expect(duplicated.canvas.sections?.[duplicated.canvas.sections.length - 1])
      .toMatchObject({
      id: "section-copy",
      x: 25,
      y: 26,
    });
  });

  it("keeps the original canvas when no editable objects can be duplicated", () => {
    const canvas = canvasFixture();
    const duplicated = duplicateCanvasObjects(
      canvas,
      [{ id: "item-1", kind: "item" }],
      (kind) => `${kind}-copy`,
    );

    expect(duplicated).toEqual({ canvas, duplicatedObjects: [] });
  });

  it("replaces notes by id without changing unrelated notes", () => {
    const canvas = {
      ...canvasFixture(),
      notes: [
        { id: "note-1", text: "Old", x: 20, y: 30 },
        { id: "note-2", text: "Keep", x: 80, y: 90 },
      ],
    };

    expect(
      replaceCanvasNote(canvas, { id: "note-1", text: "New", x: 40, y: 50 }).notes,
    ).toEqual([
      { id: "note-1", text: "New", x: 40, y: 50 },
      { id: "note-2", text: "Keep", x: 80, y: 90 },
    ]);
  });
});
