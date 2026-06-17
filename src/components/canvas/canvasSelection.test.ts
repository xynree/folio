import { describe, expect, it } from "vitest";
import {
  canvasObjectSelectionKey,
  normalizedSelectionRectangle,
  selectCanvasObjectsInRectangle,
  toggleCanvasObjectSelection,
} from "./canvasSelection";

describe("canvas selection helpers", () => {
  it("normalizes rectangle drag directions", () => {
    expect(normalizedSelectionRectangle({ x: 40, y: 80 }, { x: 10, y: 20 }))
      .toEqual({ x: 10, y: 20, width: 30, height: 60 });
  });

  it("toggles selected objects by kind and id", () => {
    const alpha = { id: "alpha", kind: "item" as const };
    const note = { id: "alpha", kind: "note" as const };
    const selected = toggleCanvasObjectSelection([alpha], note);

    expect(selected.map(canvasObjectSelectionKey)).toEqual([
      "item:alpha",
      "note:alpha",
    ]);
    expect(toggleCanvasObjectSelection(selected, alpha).map(canvasObjectSelectionKey))
      .toEqual(["note:alpha"]);
  });

  it("selects objects intersecting a marquee rectangle", () => {
    const selections = selectCanvasObjectsInRectangle(
      [
        {
          id: "alpha",
          kind: "item",
          geometry: { x: 80, y: 90, width: 120, height: 120 },
        },
        {
          id: "note-1",
          kind: "note",
          geometry: { x: 420, y: 440, width: 180, height: 120 },
        },
      ],
      { x: 70, y: 80, width: 180, height: 180 },
    );

    expect(selections).toEqual([{ id: "alpha", kind: "item" }]);
    expect(
      selectCanvasObjectsInRectangle([], { x: 0, y: 0, width: 2, height: 2 }),
    ).toEqual([]);
  });
});
