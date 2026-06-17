import React from "react";
import {
  ArrowLeftRight,
  ArrowRight,
  ArrowRightLeft,
  Link2,
  Minus,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CanvasEdge, CanvasEdgeDirection } from "../../types";
import { ButtonIcon } from "../shared/ButtonIcon";
import type { EdgeRenderModel } from "./canvasTypes";

type CanvasEdgeLabelsProps = {
  edgeLabelDraft: string;
  edgeRenderModels: EdgeRenderModel[];
  editingEdgeId: string | null;
  selectedEdgeId: string | null;
  onDeleteEdge: (edgeId: string) => void;
  onEdgeLabelDraftChange: (label: string) => void;
  onReverseEdgeDirection: (edgeId: string) => void;
  onSaveEdgeLabel: () => void;
  onSelectEdge: (edgeId: string) => void;
  onStartEdgeLabelEdit: (edge: CanvasEdge) => void;
  onStopEdgeLabelEdit: () => void;
  onUpdateEdgeDirection: (
    edgeId: string,
    direction: CanvasEdgeDirection,
  ) => void;
};

export function CanvasEdgeLabels({
  edgeLabelDraft,
  edgeRenderModels,
  editingEdgeId,
  selectedEdgeId,
  onDeleteEdge,
  onEdgeLabelDraftChange,
  onReverseEdgeDirection,
  onSaveEdgeLabel,
  onSelectEdge,
  onStartEdgeLabelEdit,
  onStopEdgeLabelEdit,
  onUpdateEdgeDirection,
}: CanvasEdgeLabelsProps) {
  return (
    <div className="canvas-edge-label-layer" aria-live="polite">
      {edgeRenderModels.map((model) => {
        const editing = editingEdgeId === model.edge.id;
        return (
          <span
            className={`canvas-edge-label ${
              selectedEdgeId === model.edge.id ? "canvas-edge-label-selected" : ""
            }`}
            key={model.edge.id}
            style={{
              transform: `translate(${model.labelPosition.x}px, ${model.labelPosition.y}px)`,
            }}
          >
            {editing ? (
              <input
                aria-label="Edge label"
                autoFocus
                value={edgeLabelDraft}
                onBlur={onSaveEdgeLabel}
                onChange={(event) => onEdgeLabelDraftChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onSaveEdgeLabel();
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    onStopEdgeLabelEdit();
                  }
                }}
              />
            ) : (
              <button
                type="button"
                aria-label={`Edge label: ${model.edge.label || "Link"}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectEdge(model.edge.id);
                }}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  onStartEdgeLabelEdit(model.edge);
                }}
              >
                <ButtonIcon icon={Link2} size={12} />
                <span>{model.edge.label || "Link"}</span>
              </button>
            )}
            {selectedEdgeId === model.edge.id && !editing ? (
              <span
                className="canvas-edge-direction-bar"
                role="toolbar"
                aria-label="Link actions"
              >
                <EdgeDirectionButton
                  active={model.direction === "none"}
                  icon={Minus}
                  label="No direction"
                  onClick={() => onUpdateEdgeDirection(model.edge.id, "none")}
                />
                <EdgeDirectionButton
                  active={model.direction === "forward"}
                  icon={ArrowRight}
                  label="Single direction"
                  onClick={() => onUpdateEdgeDirection(model.edge.id, "forward")}
                />
                <EdgeDirectionButton
                  active={model.direction === "bidirectional"}
                  icon={ArrowLeftRight}
                  label="Bidirectional"
                  onClick={() =>
                    onUpdateEdgeDirection(model.edge.id, "bidirectional")
                  }
                />
                <span className="canvas-edge-action-divider" />
                <button
                  type="button"
                  aria-label="Reverse direction"
                  title="Reverse direction"
                  disabled={model.direction !== "forward"}
                  onClick={(event) => {
                    event.stopPropagation();
                    onReverseEdgeDirection(model.edge.id);
                  }}
                >
                  <ButtonIcon icon={ArrowRightLeft} size={12} />
                </button>
                <button
                  className="canvas-edge-remove-button"
                  type="button"
                  aria-label="Remove link"
                  title="Remove link"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteEdge(model.edge.id);
                  }}
                >
                  <ButtonIcon icon={Trash2} size={12} />
                </button>
              </span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

function EdgeDirectionButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={active ? "canvas-edge-direction-active" : ""}
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      <ButtonIcon icon={icon} size={12} />
    </button>
  );
}
