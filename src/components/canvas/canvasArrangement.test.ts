import { describe, expect, it } from "vitest";
import {
  alignCanvasObjects,
  canvasObjectBounds,
  canvasObjectsWithinSection,
  distributeCanvasObjects,
  sectionAroundCanvasObjects,
  tidyCanvasObjectsIntoGrid,
  type ArrangeableCanvasObject,
} from "./canvasArrangement";

const objects: ArrangeableCanvasObject[] = [
  { id: "a", kind: "item", geometry: { x: 100, y: 80, width: 100, height: 80 } },
  { id: "b", kind: "note", geometry: { x: 260, y: 120, width: 120, height: 90 } },
  { id: "c", kind: "link", geometry: { x: 420, y: 160, width: 140, height: 100 } },
];

describe("canvas arrangement helpers", () => {
  it("tidies objects into a deterministic grid without mutating inputs", () => {
    const patches = tidyCanvasObjectsIntoGrid(objects, {
      columns: 2,
      gap: 20,
      origin: { x: 10, y: 15 },
    });

    expect(patches).toEqual([
      { id: "a", kind: "item", position: { x: 10, y: 15, width: 100, height: 80 } },
      { id: "b", kind: "note", position: { x: 170, y: 15, width: 120, height: 90 } },
      { id: "c", kind: "link", position: { x: 10, y: 135, width: 140, height: 100 } },
    ]);
    expect(objects[0].geometry.x).toBe(100);
  });

  it("aligns selected objects against shared edges and centers", () => {
    expect(alignCanvasObjects(objects, "left").map((patch) => patch.position.x))
      .toEqual([100, 100, 100]);
    expect(alignCanvasObjects(objects, "top").map((patch) => patch.position.y))
      .toEqual([80, 80, 80]);
    expect(alignCanvasObjects(objects, "center-x").map((patch) => patch.position.x))
      .toEqual([270, 260, 250]);
    expect(alignCanvasObjects(objects, "center-y").map((patch) => patch.position.y))
      .toEqual([125, 120, 115]);
  });

  it("distributes objects evenly across their current range", () => {
    expect(
      distributeCanvasObjects(objects, "horizontal").map((patch) => patch.position.x),
    ).toEqual([100, 260, 420]);
    expect(
      distributeCanvasObjects(objects, "vertical").map((patch) => patch.position.y),
    ).toEqual([80, 120, 160]);
    expect(distributeCanvasObjects(objects.slice(0, 2), "horizontal")).toEqual([]);
  });

  it("calculates bounds and section frames around selected objects", () => {
    expect(canvasObjectBounds(objects)).toEqual({
      x: 100,
      y: 80,
      width: 460,
      height: 180,
    });
    expect(
      sectionAroundCanvasObjects(objects, {
        id: "section-1",
        title: "References",
        color: "#385d56",
        padding: 20,
        createdAt: "2026-06-17T08:00:00.000Z",
      }),
    ).toEqual({
      id: "section-1",
      title: "References",
      color: "#385d56",
      x: 80,
      y: 24,
      width: 500,
      height: 256,
      createdAt: "2026-06-17T08:00:00.000Z",
      updatedAt: "2026-06-17T08:00:00.000Z",
    });
    expect(canvasObjectBounds([])).toBeNull();
    expect(sectionAroundCanvasObjects([], { id: "empty" })).toBeNull();
  });

  it("finds objects whose center falls inside a section, ignoring sections", () => {
    const section: ArrangeableCanvasObject = {
      id: "section-1",
      kind: "section",
      geometry: { x: 50, y: 50, width: 300, height: 300 },
    };
    const candidates: ArrangeableCanvasObject[] = [
      // Center (150, 130) is inside the section.
      { id: "inside", kind: "item", geometry: { x: 100, y: 90, width: 100, height: 80 } },
      // Center (510, 210) is outside the section.
      { id: "outside", kind: "note", geometry: { x: 450, y: 160, width: 120, height: 100 } },
      // Another section should never be treated as contained.
      { id: "nested-section", kind: "section", geometry: { x: 60, y: 60, width: 40, height: 40 } },
      // The section itself should be excluded.
      section,
    ];

    const contained = canvasObjectsWithinSection(section, candidates);

    expect(contained.map((object) => object.id)).toEqual(["inside"]);
  });
});
