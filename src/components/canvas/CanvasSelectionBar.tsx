import React from "react";
import { Trash2, Copy } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ButtonIcon } from "../shared/ButtonIcon";

type CanvasSelectionBarProps = {
  selectedCount: number;
  onDelete: () => void;
  onDuplicate: () => void;
};

export function CanvasSelectionBar({
  selectedCount,
  onDelete,
  onDuplicate,
}: CanvasSelectionBarProps) {
  if (!selectedCount) return null;

  return (
    <div className="canvas-selection-bar" role="toolbar" aria-label="Selection actions">
      <span className="canvas-selection-count">
        {selectedCount} selected
      </span>
      <SelectionButton icon={Copy} label="Duplicate" onClick={onDuplicate} />
      <SelectionButton
        danger
        icon={Trash2}
        label="Delete selected"
        onClick={onDelete}
      />
    </div>
  );
}

function SelectionButton({
  danger = false,
  icon,
  label,
  onClick,
}: {
  danger?: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={danger ? "canvas-selection-danger" : ""}
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <ButtonIcon icon={icon} size={14} />
    </button>
  );
}
