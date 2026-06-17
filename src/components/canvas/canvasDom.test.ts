import { describe, expect, it, vi } from "vitest";
import { objectTargetFromElement, objectTargetFromEvent } from "./canvasDom";

describe("canvas DOM helpers", () => {
  it("reads object targets and connector sides from DOM nodes", () => {
    const card = document.createElement("div");
    card.dataset.canvasObjectId = "alpha";
    card.dataset.canvasObjectKind = "item";
    const connector = document.createElement("button");
    connector.dataset.connectorSide = "right";
    card.append(connector);
    document.body.append(card);

    expect(objectTargetFromElement(connector)).toEqual({
      id: "alpha",
      kind: "item",
      side: "right",
    });
  });

  it("falls back to elementFromPoint when pointer event target is not an element", () => {
    const card = document.createElement("div");
    card.dataset.canvasObjectId = "note-1";
    card.dataset.canvasObjectKind = "note";
    const elementFromPoint = vi.fn(() => card);
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: elementFromPoint,
    });

    expect(
      objectTargetFromEvent({
        clientX: 10,
        clientY: 20,
        target: null,
      } as unknown as PointerEvent),
    ).toEqual({
      id: "note-1",
      kind: "note",
      side: undefined,
    });

    expect(elementFromPoint).toHaveBeenCalledWith(10, 20);
  });
});
