import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { Canvas } from "../../types";
import { useCanvasObjectMutations } from "./useCanvasObjectMutations";

function canvasFixture(): Canvas {
  return {
    id: "canvas-1",
    title: "Board",
    color: "#385d56",
    itemIds: ["item-1"],
    positions: { "item-1": { x: 10, y: 20 } },
    notes: [{ id: "note-1", text: "Old", x: 20, y: 30 }],
    edges: [],
    strokes: [],
    texts: [{ id: "text-1", text: "Caption", x: 60, y: 70 }],
    links: [{ id: "link-1", title: "Example", url: "https://example.com/", x: 80, y: 90 }],
    sections: [{ id: "section-1", title: "Research", x: 5, y: 6, width: 500, height: 300 }],
  };
}

/** Runs a captured updater against a fresh fixture so assertions read like real canvas output. */
function applyLastUpdate(
  updateCanvas: ReturnType<typeof vi.fn>,
): { canvas: Canvas; message: string | undefined } {
  const [canvasId, updater, message] = updateCanvas.mock.calls.at(-1) ?? [];
  expect(canvasId).toBe("canvas-1");
  return { canvas: updater(canvasFixture()), message };
}

function renderMutations(activeCanvas: Canvas | null = canvasFixture()) {
  const updateCanvas = vi.fn();
  const view = renderHook(() =>
    useCanvasObjectMutations({ activeCanvas, updateCanvas }),
  );
  return { updateCanvas, result: view.result };
}

describe("useCanvasObjectMutations", () => {
  it("adds an empty note to the active canvas", () => {
    const { updateCanvas, result } = renderMutations();

    result.current.addNote();

    const { canvas, message } = applyLastUpdate(updateCanvas);
    expect(canvas.notes).toHaveLength(2);
    expect(canvas.notes.at(-1)).toMatchObject({ text: "", x: 140, y: 120 });
    expect(message).toBe("Note added");
  });

  it("removes an archive item from the active canvas", () => {
    const { updateCanvas, result } = renderMutations();

    result.current.removeItem("item-1");

    const { canvas, message } = applyLastUpdate(updateCanvas);
    expect(canvas.itemIds).toEqual([]);
    expect(message).toBe("Removed");
  });

  it("updates note text without a status message", () => {
    const { updateCanvas, result } = renderMutations();

    result.current.updateNote("note-1", "New text");

    const { canvas, message } = applyLastUpdate(updateCanvas);
    expect(canvas.notes[0].text).toBe("New text");
    expect(message).toBeUndefined();
  });

  it("updates link details", () => {
    const { updateCanvas, result } = renderMutations();

    result.current.updateLink("link-1", { title: "Renamed" });

    const { canvas } = applyLastUpdate(updateCanvas);
    expect(canvas.links[0].title).toBe("Renamed");
  });

  it("deletes a section with a status message", () => {
    const { updateCanvas, result } = renderMutations();

    result.current.deleteSection("section-1");

    const { canvas, message } = applyLastUpdate(updateCanvas);
    expect(canvas.sections).toEqual([]);
    expect(message).toBe("Section deleted");
  });

  it("updates a text element and its size", () => {
    const { updateCanvas, result } = renderMutations();

    result.current.updateTextElement("text-1", "Edited");
    result.current.updateTextElementSize("text-1", "lg");

    const { canvas, message } = applyLastUpdate(updateCanvas);
    expect(canvas.texts[0].size).toBe("lg");
    expect(message).toBe("Text size updated");
  });

  it("covers the remaining note, link, section, and text deletions", () => {
    const { updateCanvas, result } = renderMutations();

    result.current.updateNoteSize("note-1", "lg");
    expect(applyLastUpdate(updateCanvas).message).toBe("Note text size updated");

    result.current.updateSection("section-1", { title: "Renamed" });
    expect(applyLastUpdate(updateCanvas).canvas.sections[0].title).toBe("Renamed");

    result.current.deleteLink("link-1");
    expect(applyLastUpdate(updateCanvas).canvas.links).toEqual([]);

    result.current.deleteNote("note-1");
    expect(applyLastUpdate(updateCanvas).canvas.notes).toEqual([]);

    result.current.deleteTextElement("text-1");
    expect(applyLastUpdate(updateCanvas).canvas.texts).toEqual([]);
  });

  it("does nothing when there is no active canvas", () => {
    const { updateCanvas, result } = renderMutations(null);

    result.current.addNote();
    result.current.removeItem("item-1");
    result.current.deleteNote("note-1");

    expect(updateCanvas).not.toHaveBeenCalled();
  });
});
