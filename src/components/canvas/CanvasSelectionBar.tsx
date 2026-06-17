import React from "react";
import {
  AlignCenterHorizontal,
  AlignHorizontalDistributeCenter,
  AlignLeft,
  AlignStartHorizontal,
  Grid3X3,
  Layers,
  Rows3,
  Trash2,
  Copy,
  CalendarDays,
  Shapes,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ButtonIcon } from "../shared/ButtonIcon";

type CanvasSelectionBarProps = {
  selectedCount: number;
  onAlignCenter: () => void;
  onAlignLeft: () => void;
  onAlignTop: () => void;
  onArrangeByDate: () => void;
  onArrangeByType: () => void;
  onDelete: () => void;
  onDistributeHorizontal: () => void;
  onDistributeVertical: () => void;
  onDuplicate: () => void;
  onOrganizeIntoSection: () => void;
  onTidyGrid: () => void;
};

export function CanvasSelectionBar({
  selectedCount,
  onAlignCenter,
  onAlignLeft,
  onAlignTop,
  onArrangeByDate,
  onArrangeByType,
  onDelete,
  onDistributeHorizontal,
  onDistributeVertical,
  onDuplicate,
  onOrganizeIntoSection,
  onTidyGrid,
}: CanvasSelectionBarProps) {
  if (!selectedCount) return null;

  return (
    <div className="canvas-selection-bar" role="toolbar" aria-label="Selection actions">
      <span className="canvas-selection-count">
        {selectedCount} selected
      </span>
      <SelectionButton icon={AlignLeft} label="Align left" onClick={onAlignLeft} />
      <SelectionButton
        icon={AlignStartHorizontal}
        label="Align top"
        onClick={onAlignTop}
      />
      <SelectionButton
        icon={AlignCenterHorizontal}
        label="Align center"
        onClick={onAlignCenter}
      />
      <SelectionButton
        icon={AlignHorizontalDistributeCenter}
        label="Distribute horizontal"
        onClick={onDistributeHorizontal}
      />
      <SelectionButton
        icon={Rows3}
        label="Distribute vertical"
        onClick={onDistributeVertical}
      />
      <SelectionButton icon={Grid3X3} label="Tidy grid" onClick={onTidyGrid} />
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
      <SelectionButton
        icon={Layers}
        label="Organize into section"
        onClick={onOrganizeIntoSection}
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
