import React, { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  CANVAS_MAX_ZOOM,
  CANVAS_MIN_ZOOM,
  CANVAS_WORLD_HEIGHT,
  CANVAS_WORLD_WIDTH,
} from "../folio/constants";
import { clampNumber } from "../folio/model";

type CanvasViewportProps = {
  zoom: number;
  zoomRef: React.MutableRefObject<number>;
  onZoomChange: React.Dispatch<React.SetStateAction<number>>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  surfaceRef: React.RefObject<HTMLDivElement | null>;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onSurfacePointerDown?: (event: React.PointerEvent<HTMLDivElement>) => void;
  children: React.ReactNode;
};

function getCanvasContext(canvas: HTMLCanvasElement) {
  try {
    return canvas.getContext("2d");
  } catch {
    return null;
  }
}

export function CanvasViewport({
  zoom,
  zoomRef,
  onZoomChange,
  scrollRef,
  surfaceRef,
  onDrop,
  onDragOver,
  onSurfacePointerDown,
  children,
}: CanvasViewportProps) {
  const backgroundRef = useRef<HTMLCanvasElement | null>(null);
  const drawFrameRef = useRef<number | null>(null);
  const zoomAnchorRef = useRef<{ x: number; y: number } | null>(null);
  const [isCanvasPanning, setIsCanvasPanning] = useState(false);

  const drawBackground = useCallback(() => {
    const canvas = backgroundRef.current;
    const scroll = scrollRef.current;
    if (!canvas || !scroll) return;

    const rect = scroll.getBoundingClientRect();
    const width = Math.max(1, Math.round(scroll.clientWidth || rect.width || 1));
    const height = Math.max(1, Math.round(scroll.clientHeight || rect.height || 1));
    const pixelRatio = window.devicePixelRatio || 1;
    const pixelWidth = Math.round(width * pixelRatio);
    const pixelHeight = Math.round(height * pixelRatio);

    if (canvas.width !== pixelWidth) {
      canvas.width = pixelWidth;
    }
    if (canvas.height !== pixelHeight) {
      canvas.height = pixelHeight;
    }
    if (canvas.style.width !== `${width}px`) {
      canvas.style.width = `${width}px`;
    }
    if (canvas.style.height !== `${height}px`) {
      canvas.style.height = `${height}px`;
    }

    const context = getCanvasContext(canvas);
    if (!context) return;

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#f7f3ec";
    context.fillRect(0, 0, width, height);

    const gridSize = 24 * zoom;
    const dotRadius = Math.max(0.65, zoom);
    const startX = -(((scroll.scrollLeft % gridSize) + gridSize) % gridSize);
    const startY = -(((scroll.scrollTop % gridSize) + gridSize) % gridSize);

    context.fillStyle = "#d6cbbd";
    for (let x = startX; x <= width; x += gridSize) {
      for (let y = startY; y <= height; y += gridSize) {
        context.beginPath();
        context.arc(x + dotRadius, y + dotRadius, dotRadius, 0, Math.PI * 2);
        context.fill();
      }
    }
  }, [scrollRef, zoom]);

  const scheduleBackgroundDraw = useCallback(() => {
    if (drawFrameRef.current !== null) {
      window.cancelAnimationFrame(drawFrameRef.current);
    }
    drawFrameRef.current = window.requestAnimationFrame(() => {
      drawFrameRef.current = null;
      drawBackground();
    });
  }, [drawBackground]);

  useEffect(() => {
    return () => {
      if (drawFrameRef.current !== null) {
        window.cancelAnimationFrame(drawFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    zoomRef.current = zoom;
    scheduleBackgroundDraw();
  }, [scheduleBackgroundDraw, zoom, zoomRef]);

  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return undefined;

    scheduleBackgroundDraw();
    scroll.addEventListener("scroll", scheduleBackgroundDraw, { passive: true });
    window.addEventListener("resize", scheduleBackgroundDraw);

    let resizeObserver: ResizeObserver | null = null;
    if ("ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(scheduleBackgroundDraw);
      resizeObserver.observe(scroll);
    }

    return () => {
      scroll.removeEventListener("scroll", scheduleBackgroundDraw);
      window.removeEventListener("resize", scheduleBackgroundDraw);
      resizeObserver?.disconnect();
    };
  }, [scheduleBackgroundDraw, scrollRef]);

  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return undefined;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const wheelDelta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
      if (wheelDelta === 0) return;

      const currentZoom = zoomRef.current;
      const rect = scroll.getBoundingClientRect();
      const eventAnchor = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      const eventIsInsideCanvas =
        event.clientX >= rect.left
        && event.clientX <= rect.right
        && event.clientY >= rect.top
        && event.clientY <= rect.bottom;
      const anchor = eventIsInsideCanvas
        ? eventAnchor
        : zoomAnchorRef.current ?? {
            x: rect.width / 2,
            y: rect.height / 2,
          };

      const pointerX = clampNumber(anchor.x, 0, rect.width);
      const pointerY = clampNumber(anchor.y, 0, rect.height);
      zoomAnchorRef.current = { x: pointerX, y: pointerY };

      const logicalX = (scroll.scrollLeft + pointerX) / currentZoom;
      const logicalY = (scroll.scrollTop + pointerY) / currentZoom;
      const zoomMultiplier = Math.exp(-wheelDelta * 0.0016);
      const nextZoom = clampNumber(
        currentZoom * zoomMultiplier,
        CANVAS_MIN_ZOOM,
        CANVAS_MAX_ZOOM,
      );

      if (nextZoom === currentZoom) {
        scheduleBackgroundDraw();
        return;
      }

      zoomRef.current = nextZoom;
      flushSync(() => {
        onZoomChange(nextZoom);
      });
      scroll.scrollLeft = logicalX * nextZoom - pointerX;
      scroll.scrollTop = logicalY * nextZoom - pointerY;
      scheduleBackgroundDraw();
    };

    scroll.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      scroll.removeEventListener("wheel", handleWheel);
    };
  }, [onZoomChange, scheduleBackgroundDraw, scrollRef, zoomRef]);

  const rememberZoomAnchor = useCallback(
    (clientX: number, clientY: number) => {
      const scroll = scrollRef.current;
      if (!scroll) return;

      const rect = scroll.getBoundingClientRect();
      zoomAnchorRef.current = {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    },
    [scrollRef],
  );

  const startCanvasPan = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (
        target.closest(
          ".canvas-card, .canvas-note, .canvas-text-card, button, input, textarea, select, [data-no-canvas-pan]",
        )
      ) {
        return;
      }

      const scroll = scrollRef.current;
      if (!scroll) return;

      event.preventDefault();
      const startPointer = { x: event.clientX, y: event.clientY };
      const startScroll = {
        left: scroll.scrollLeft,
        top: scroll.scrollTop,
      };
      const previousCursor = document.body.style.cursor;
      const previousUserSelect = document.body.style.userSelect;
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
      setIsCanvasPanning(true);

      const onPointerMove = (moveEvent: PointerEvent) => {
        scroll.scrollLeft = startScroll.left - (moveEvent.clientX - startPointer.x);
        scroll.scrollTop = startScroll.top - (moveEvent.clientY - startPointer.y);
        scheduleBackgroundDraw();
      };

      const onPointerUp = () => {
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        setIsCanvasPanning(false);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [scheduleBackgroundDraw, scrollRef],
  );

  return (
    <div className="canvas-viewport">
      <canvas
        aria-hidden="true"
        className="canvas-backing"
        data-testid="canvas-backing"
        ref={backgroundRef}
      />
      <div
        className={`canvas-scroll ${isCanvasPanning ? "canvas-panning" : ""}`}
        ref={scrollRef}
        onPointerDown={startCanvasPan}
        onPointerMove={(event) => rememberZoomAnchor(event.clientX, event.clientY)}
      >
        <div
          className="canvas-zoom-layer"
          style={{
            width: CANVAS_WORLD_WIDTH * zoom,
            height: CANVAS_WORLD_HEIGHT * zoom,
          }}
        >
          <div
            className="canvas-surface"
            ref={surfaceRef}
            style={{
              width: CANVAS_WORLD_WIDTH,
              height: CANVAS_WORLD_HEIGHT,
              transform: `scale(${zoom})`,
            }}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onPointerDown={onSurfacePointerDown}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
