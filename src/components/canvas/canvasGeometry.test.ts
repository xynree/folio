import { describe, expect, it } from "vitest";
import { CANVAS_WORLD_ORIGIN } from "../folio/constants";
import {
  bestConnectionSide,
  buildEdgePath,
  buildPolylinePath,
  distanceToSegment,
  edgeRenderModelFromLayouts,
  eraseStrokePathAtPoint,
  objectLayoutFromPosition,
  pointsFromStrokePath,
  sizeForCanvasImageObject,
  sizeForCanvasObject,
  strokeIntersectsEraser,
} from "./canvasGeometry";

describe("canvas geometry helpers", () => {
  it("builds rounded polyline stroke paths from points", () => {
    expect(buildPolylinePath([])).toBe("");
    expect(buildPolylinePath([
      { x: 10.2, y: 20.6 },
      { x: 31.4, y: 42.5 },
    ])).toBe("M 10 21 L 31 43");
  });

  it("chooses the side facing a target point", () => {
    expect(bestConnectionSide({ x: 0, y: 0 }, { x: 20, y: 5 })).toBe("right");
    expect(bestConnectionSide({ x: 0, y: 0 }, { x: -20, y: 5 })).toBe("left");
    expect(bestConnectionSide({ x: 0, y: 0 }, { x: 5, y: 20 })).toBe("bottom");
    expect(bestConnectionSide({ x: 0, y: 0 }, { x: 5, y: -20 })).toBe("top");
  });

  it("creates object layouts in canvas world coordinates", () => {
    const layout = objectLayoutFromPosition("alpha", "item", { x: 80, y: 90 });

    expect(layout.center).toEqual({
      x: CANVAS_WORLD_ORIGIN + 80 + 81,
      y: CANVAS_WORLD_ORIGIN + 90 + 95,
    });
    expect(layout.sides.right).toEqual({
      x: CANVAS_WORLD_ORIGIN + 80 + 162,
      y: CANVAS_WORLD_ORIGIN + 90 + 95,
    });

    const resizedLayout = objectLayoutFromPosition("note", "note", {
      x: 80,
      y: 90,
      width: 260,
      height: 180,
    });
    expect(resizedLayout.size).toEqual({ width: 260, height: 180 });
    expect(resizedLayout.center).toEqual({
      x: CANVAS_WORLD_ORIGIN + 80 + 130,
      y: CANVAS_WORLD_ORIGIN + 90 + 90,
    });
  });

  it("resolves default object sizes when geometry has no dimensions", () => {
    expect(sizeForCanvasObject("text", { width: 300 })).toEqual({
      width: 300,
      height: 96,
    });
  });

  it("scales image object defaults from natural media proportions", () => {
    expect(
      sizeForCanvasImageObject("item", { x: 0, y: 0 }, {
        width: 400,
        height: 200,
      }),
    ).toEqual({ width: 190, height: 95 });
    expect(
      sizeForCanvasImageObject("item", { x: 0, y: 0, width: 240 }, {
        width: 400,
        height: 200,
      }),
    ).toEqual({ width: 240, height: 120 });
    expect(
      sizeForCanvasImageObject("item", { x: 0, y: 0, width: 162, height: 190 }, {
        width: 4032,
        height: 3024,
      }),
    ).toEqual({ width: 190, height: 143 });
  });

  it("renders edges from explicit side handles", () => {
    const layouts = new Map([
      ["alpha", objectLayoutFromPosition("alpha", "item", { x: 80, y: 90 })],
      ["bravo", objectLayoutFromPosition("bravo", "item", { x: 320, y: 120 })],
    ]);

    const model = edgeRenderModelFromLayouts(
      {
        id: "edge-1",
        fromId: "alpha",
        toId: "bravo",
        fromSide: "right",
        toSide: "left",
        direction: "forward",
      },
      layouts,
    );

    expect(model?.direction).toBe("forward");
    expect(model?.labelPosition.x).toBe(
      (CANVAS_WORLD_ORIGIN + 80 + 162 + CANVAS_WORLD_ORIGIN + 320) / 2,
    );
    expect(model?.path).toContain("C");
  });

  it("builds curved edge paths from side vectors", () => {
    expect(buildEdgePath(
      { x: 0, y: 50 },
      { x: 100, y: 50 },
      "right",
      "left",
    )).toBe("M 0 50 C 48 50 52 50 100 50");
  });

  it("parses stroke points and measures segment distance", () => {
    expect(pointsFromStrokePath("M 10 20 L 30 40 L 50 20")).toEqual([
      { x: 10, y: 20 },
      { x: 30, y: 40 },
      { x: 50, y: 20 },
    ]);
    expect(distanceToSegment(
      { x: 10, y: 10 },
      { x: 0, y: 0 },
      { x: 20, y: 0 },
    )).toBe(10);
  });

  it("detects eraser intersections against stroke segments", () => {
    const stroke = {
      id: "stroke-1",
      color: "#385d56",
      path: "M 100 100 L 180 100",
    };

    expect(strokeIntersectsEraser(stroke, { x: 140, y: 115 })).toBe(true);
    expect(strokeIntersectsEraser(stroke, { x: 140, y: 150 })).toBe(false);
  });

  it("keeps only stroke path portions outside the eraser circle", () => {
    expect(
      eraseStrokePathAtPoint("M 100 100 L 200 100", { x: 150, y: 100 }),
    ).toEqual(["M 100 100 L 132 100", "M 168 100 L 200 100"]);
    expect(
      eraseStrokePathAtPoint("M 100 100 L 200 100", { x: 110, y: 100 }),
    ).toEqual(["M 128 100 L 200 100"]);
    expect(
      eraseStrokePathAtPoint("M 100 100 L 200 100", { x: 150, y: 150 }),
    ).toEqual(["M 100 100 L 200 100"]);
  });
});
