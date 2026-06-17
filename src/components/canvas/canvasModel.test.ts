import { describe, expect, it } from "vitest";
import type { Canvas } from "../../types";
import {
  addCanvasStroke,
  addCanvasTextElement,
  deleteCanvasEdge,
  deleteCanvasNote,
  deleteCanvasTextElement,
  eraseCanvasStrokesAtPoint,
  moveCanvasObject,
  removeCanvasReference,
  removeCanvasStrokes,
  removeItemFromCanvas,
  removeLastCanvasStroke,
  resizeCanvasObject,
  reverseCanvasEdgeDirection,
  updateCanvasEdgeDirection,
  updateCanvasEdgeLabel,
  updateCanvasEdgeRelationshipType,
  updateCanvasNoteText,
  updateCanvasTextElementSize,
  updateCanvasTextElementText,
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
        toId: "reference-1",
        fromSide: "bottom",
        toSide: "top",
      },
    ],
    references: [
      { id: "reference-1", filename: "ref.png", path: "refs/ref.png", x: 40, y: 50 },
    ],
    strokes: [{ id: "stroke-1", color: "#111111", path: "M 0 0 L 10 10" }],
    texts: [{ id: "text-1", text: "Caption", x: 60, y: 70 }],
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
    expect(
      updateCanvasTextElementSize(updatedCanvas, "text-1", "large").texts?.[0]
        .size,
    ).toBe("large");
    expect(deleteCanvasTextElement(updatedCanvas, "text-1").edges).toHaveLength(2);
  });

  it("removes references with their connected links", () => {
    const nextCanvas = removeCanvasReference(canvasFixture(), "reference-1");

    expect(nextCanvas.references).toEqual([]);
    expect(nextCanvas.edges.map((edge) => edge.id)).toEqual(["edge-1"]);
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
        fromId: "reference-1",
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
      moveCanvasObject(canvas, "reference", "reference-1", { x: 21, y: 22 })
        .references[0],
    ).toEqual(expect.objectContaining({ x: 21, y: 22 }));
    expect(
      moveCanvasObject(canvas, "note", "note-1", { x: 31, y: 32 }).notes[0],
    ).toEqual(expect.objectContaining({ x: 31, y: 32 }));
    expect(
      moveCanvasObject(canvas, "text", "text-1", { x: 41, y: 42 }).texts?.[0],
    ).toEqual(expect.objectContaining({ x: 41, y: 42 }));
  });

  it("resizes every supported canvas object kind", () => {
    const resizedItemCanvas = resizeCanvasObject(
      canvasFixture(),
      "item",
      "item-1",
      { width: 240, height: 280 },
    );
    const resizedReferenceCanvas = resizeCanvasObject(
      canvasFixture(),
      "reference",
      "reference-1",
      { width: 260, height: 320 },
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

    expect(resizedItemCanvas.positions["item-1"]).toMatchObject({
      x: 10,
      y: 20,
      width: 240,
      height: 280,
    });
    expect(resizedReferenceCanvas.references[0]).toMatchObject({
      width: 260,
      height: 320,
    });
    expect(resizedNoteCanvas.notes[0]).toMatchObject({
      width: 280,
      height: 180,
    });
    expect(resizedTextCanvas.texts?.[0]).toMatchObject({
      width: 300,
      height: 120,
    });
  });
});
