import React from "react";
import {
  Trash2,
  Copy,
  CalendarDays,
  Shapes,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ButtonIcon } from "../shared/ButtonIcon";

type CanvasSelectionBarProps = {
  selectedCount: number;
  onArrangeByDate: () => void;
  onArrangeByType: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
};

export function CanvasSelectionBar({
  selectedCount,
  onArrangeByDate,
  onArrangeByType,
  onDelete,
  onDuplicate,
}: CanvasSelectionBarProps) {
  if (!selectedCount) return null;

  return (
    <div className="canvas-selection-bar" role="toolbar" aria-label="Selection actions">
      <span className="canvas-selection-count">
        {selectedCount} selected
      </span>
      <SelectionButton
        icon={CalendarDays}
        label="Arrange by date"
        onClick={onArrangeByDate}
      />
      <SelectionButton
        icon={Shapes}
        label="Arrange by type"
        onClick={onArrangeByType}
      />
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
