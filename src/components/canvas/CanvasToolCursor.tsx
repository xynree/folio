import React from "react";
import { Eraser, PenLine } from "lucide-react";
import type { CanvasPosition } from "../../types";
import { ButtonIcon } from "../shared/ButtonIcon";
import { ERASER_RADIUS } from "./canvasGeometry";
import type { CanvasTool } from "./canvasTypes";

export function CanvasToolCursor({
  activeTool,
  position,
}: {
  activeTool: CanvasTool;
  position: CanvasPosition | null;
}) {
  if (!position || (activeTool !== "pen" && activeTool !== "eraser")) {
    return null;
  }

  return (
    <div
      className={`canvas-tool-cursor canvas-tool-cursor-${activeTool}`}
      data-testid="canvas-tool-cursor"
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
      }}
    >
      {activeTool === "eraser" ? (
        <>
          <span
            className="canvas-eraser-radius"
            style={{
              height: ERASER_RADIUS * 2,
              width: ERASER_RADIUS * 2,
            }}
          />
          <span className="canvas-tool-cursor-icon">
            <ButtonIcon icon={Eraser} size={16} />
          </span>
        </>
      ) : (
        <span className="canvas-tool-cursor-icon">
          <ButtonIcon icon={PenLine} size={18} />
        </span>
      )}
    </div>
  );
}
