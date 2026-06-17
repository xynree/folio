import React, { useEffect, useMemo, useState } from "react";
import type { CanvasObjectView } from "./canvasObjects";

const MINIMAP_WIDTH = 164;
const MINIMAP_HEIGHT = 116;
const MINIMAP_PADDING = 10;
const MINIMAP_OVERFLOW_FACTOR = 1.2;

type CanvasMinimapProps = {
  objectViews: CanvasObjectView[];
  scrollRef: React.RefObject<HTMLDivElement | null>;
  zoom: number;
  onFocusViewport: (x: number, y: number) => void;
};

type ViewportSnapshot = {
  height: number;
  scrollLeft: number;
  scrollTop: number;
  width: number;
};

function objectBounds(objectViews: CanvasObjectView[]) {
  if (!objectViews.length) return null;

  const minX = Math.min(...objectViews.map((object) => object.geometry.x));
  const minY = Math.min(...objectViews.map((object) => object.geometry.y));
  const maxX = Math.max(
    ...objectViews.map(
      (object) => object.geometry.x + (object.geometry.width ?? 1),
    ),
  );
  const maxY = Math.max(
    ...objectViews.map(
      (object) => object.geometry.y + (object.geometry.height ?? 1),
    ),
  );

  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

export function CanvasMinimap({
  objectViews,
  scrollRef,
  zoom,
  onFocusViewport,
}: CanvasMinimapProps) {
  const [viewport, setViewport] = useState<ViewportSnapshot | null>(null);
  const bounds = useMemo(() => objectBounds(objectViews), [objectViews]);

  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return undefined;

    const updateViewport = () => {
      setViewport({
        height: scroll.clientHeight || scroll.getBoundingClientRect().height,
        scrollLeft: scroll.scrollLeft,
        scrollTop: scroll.scrollTop,
        width: scroll.clientWidth || scroll.getBoundingClientRect().width,
      });
    };

    updateViewport();
    scroll.addEventListener("scroll", updateViewport, { passive: true });
    window.addEventListener("resize", updateViewport);
    return () => {
      scroll.removeEventListener("scroll", updateViewport);
      window.removeEventListener("resize", updateViewport);
    };
  }, [scrollRef]);

  if (!bounds || !viewport) return null;

  const logicalViewportWidth = viewport.width / zoom;
  const logicalViewportHeight = viewport.height / zoom;
  const contentExceedsViewport =
    bounds.width > logicalViewportWidth * MINIMAP_OVERFLOW_FACTOR
    || bounds.height > logicalViewportHeight * MINIMAP_OVERFLOW_FACTOR;
  if (!contentExceedsViewport) return null;

  const scale = Math.min(
    (MINIMAP_WIDTH - MINIMAP_PADDING * 2) / bounds.width,
    (MINIMAP_HEIGHT - MINIMAP_PADDING * 2) / bounds.height,
  );
  const viewportRect = {
    x: MINIMAP_PADDING + (viewport.scrollLeft / zoom - bounds.x) * scale,
    y: MINIMAP_PADDING + (viewport.scrollTop / zoom - bounds.y) * scale,
    width: logicalViewportWidth * scale,
    height: logicalViewportHeight * scale,
  };

  const focusFromMinimapPoint = (clientX: number, clientY: number, element: Element) => {
    const rect = element.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    // Convert the clicked minimap point into world coordinates and center the
    // viewport on it.
    const worldX = bounds.x + (localX - MINIMAP_PADDING) / scale;
    const worldY = bounds.y + (localY - MINIMAP_PADDING) / scale;
    onFocusViewport(
      worldX - logicalViewportWidth / 2,
      worldY - logicalViewportHeight / 2,
    );
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const element = event.currentTarget;
    focusFromMinimapPoint(event.clientX, event.clientY, element);

    const onPointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      focusFromMinimapPoint(moveEvent.clientX, moveEvent.clientY, element);
    };
    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  return (
    <button
      className="canvas-minimap"
      type="button"
      aria-label="Minimap"
      onPointerDown={handlePointerDown}
    >
      {objectViews.map((object) => (
        <span
          className={`canvas-minimap-object canvas-minimap-object-${object.kind}`}
          key={`${object.kind}:${object.id}`}
          style={{
            height: Math.max(3, (object.geometry.height ?? 1) * scale),
            left: MINIMAP_PADDING + (object.geometry.x - bounds.x) * scale,
            top: MINIMAP_PADDING + (object.geometry.y - bounds.y) * scale,
            width: Math.max(3, (object.geometry.width ?? 1) * scale),
          }}
        />
      ))}
      <span
        className="canvas-minimap-viewport"
        style={{
          height: Math.max(8, viewportRect.height),
          left: viewportRect.x,
          top: viewportRect.y,
          width: Math.max(8, viewportRect.width),
        }}
      />
    </button>
  );
}
