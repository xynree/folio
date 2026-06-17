import { isCanvasConnectionSide } from "./canvasGeometry";
import type { CanvasObjectKind, CanvasObjectTarget } from "./canvasTypes";

export function objectTargetFromElement(
  element: Element | null,
): CanvasObjectTarget | null {
  const objectElement = element?.closest<HTMLElement>("[data-canvas-object-id]");
  if (!objectElement?.dataset.canvasObjectId) return null;

  const connectorElement = element?.closest<HTMLElement>("[data-connector-side]");
  const connectorSide = connectorElement?.dataset.connectorSide;
  return {
    id: objectElement.dataset.canvasObjectId,
    kind: objectElement.dataset.canvasObjectKind as CanvasObjectKind,
    side: isCanvasConnectionSide(connectorSide) ? connectorSide : undefined,
  };
}

export function objectTargetFromEvent(event: PointerEvent) {
  const directTarget =
    event.target instanceof Element ? objectTargetFromElement(event.target) : null;
  if (directTarget) return directTarget;

  const elementAtPoint = document.elementFromPoint(event.clientX, event.clientY);
  return objectTargetFromElement(elementAtPoint);
}
