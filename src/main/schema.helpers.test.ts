import { describe, expect, it } from "vitest";
import {
  removeLegacyCanvasReferences,
  repairLegacyOutputStages,
  stripLegacyCanvasReferences,
  validateFolioSchema,
} from "./schema.helpers";
import { makeCanvas, makeItem } from "../test/fixtures";
import type { Canvas } from "../types";

describe("validateFolioSchema", () => {
  it("accepts a well-formed data file", () => {
    expect(() =>
      validateFolioSchema(
        "folio.json",
        { version: 1, items: [] },
        "items",
        1,
      ),
    ).not.toThrow();
  });

  it("rejects a wrong schema version", () => {
    expect(() =>
      validateFolioSchema("folio.json", { version: 2, items: [] }, "items", 1),
    ).toThrow("folio.json is not a valid Folio v1 data file.");
  });

  it("rejects a missing collection array", () => {
    expect(() =>
      validateFolioSchema("tags.json", { version: 1 }, "tags", 1),
    ).toThrow();
  });

  it("rejects non-object input", () => {
    expect(() => validateFolioSchema("tags.json", null, "tags", 1)).toThrow();
  });
});

describe("stripLegacyCanvasReferences", () => {
  it("removes the obsolete references field without mutating the source", () => {
    const canvas = {
      ...makeCanvas("board-1"),
      references: ["legacy"],
    } as Canvas & { references?: unknown };

    const result = stripLegacyCanvasReferences(canvas) as Canvas & {
      references?: unknown;
    };

    expect("references" in result).toBe(false);
    expect("references" in canvas).toBe(true);
  });
});

describe("removeLegacyCanvasReferences", () => {
  it("reports no change when no canvas carries references", () => {
    const canvases = [makeCanvas("board-1"), makeCanvas("board-2")];
    const result = removeLegacyCanvasReferences(canvases);
    expect(result.changed).toBe(false);
    expect(result.canvases[0]).toBe(canvases[0]);
  });

  it("strips references and reports a change", () => {
    const legacy = {
      ...makeCanvas("board-1"),
      references: ["x"],
    } as Canvas & { references?: unknown };
    const result = removeLegacyCanvasReferences([legacy, makeCanvas("board-2")]);
    expect(result.changed).toBe(true);
    expect("references" in result.canvases[0]).toBe(false);
  });
});

describe("repairLegacyOutputStages", () => {
  it("rewrites the output stage to final in place", () => {
    const items = [
      makeItem("alpha", { stage: "output" as never }),
      makeItem("bravo", { stage: "final" }),
    ];
    const changed = repairLegacyOutputStages(items);
    expect(changed).toBe(true);
    expect(items[0].stage).toBe("final");
  });

  it("reports no change when there are no legacy stages", () => {
    const items = [makeItem("alpha", { stage: "final" })];
    expect(repairLegacyOutputStages(items)).toBe(false);
  });
});
