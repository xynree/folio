import React from "react";
import { Save, Trash2, X } from "lucide-react";
import type { Canvas } from "../../types";
import { ButtonIcon } from "../shared/ButtonIcon";

export function BoardEditDialog({
  boardColorDraft,
  boardTitleDraft,
  canvas,
  className = "",
  onBoardColorDraftChange,
  onBoardTitleDraftChange,
  onClose,
  onDelete,
  onSave,
}: {
  boardColorDraft: string;
  boardTitleDraft: string;
  canvas: Canvas;
  className?: string;
  onBoardColorDraftChange: (color: string) => void;
  onBoardTitleDraftChange: (title: string) => void;
  onClose: () => void;
  onDelete: () => void;
  onSave: (canvas: Canvas) => void;
}) {
  return (
    <div
      className={`board-edit-popover ${className}`.trim()}
      role="dialog"
      aria-label="Edit board"
    >
      <div className="board-edit-popover-header">
        <strong>Edit board</strong>
        <button
          className="icon-button board-edit-close"
          type="button"
          onClick={onClose}
          aria-label="Close board tools"
          title="Close board tools"
        >
          <ButtonIcon icon={X} />
        </button>
      </div>
      <label>
        <span>Board name</span>
        <input
          value={boardTitleDraft}
          onChange={(event) => onBoardTitleDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onSave(canvas);
            }
          }}
        />
      </label>
      <label className="board-color-field">
        <span>Board color</span>
        <span className="board-color-control">
          <input
            type="color"
            aria-label="Board color"
            value={boardColorDraft}
            onChange={(event) => onBoardColorDraftChange(event.target.value)}
          />
          <small>{boardColorDraft}</small>
        </span>
      </label>
      <div
        className="board-edit-action-bar"
        role="toolbar"
        aria-label="Board actions"
      >
        <button
          className="board-edit-save"
          type="button"
          onClick={() => onSave(canvas)}
        >
          <ButtonIcon icon={Save} />
          Save board
        </button>
        <button
          className="board-edit-action board-edit-delete"
          type="button"
          onClick={onDelete}
          aria-label="Delete board"
          title="Delete board"
        >
          <ButtonIcon icon={Trash2} />
        </button>
      </div>
    </div>
  );
}
