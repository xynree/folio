import React from "react";
import {
  ArrowLeft,
  Edit3,
  Eraser,
  ImagePlus,
  Minimize2,
  Paperclip,
  PenLine,
  StickyNote,
  Type,
  Undo2,
} from "lucide-react";
import type { Canvas } from "../../types";
import { ButtonIcon } from "../shared/ButtonIcon";
import { BoardEditDialog } from "./BoardEditDialog";
import type { CanvasTool } from "./canvasTypes";

function formatBoardTimestamp(value?: string) {
  if (!value) return "Unknown";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

type CanvasBoardHeaderProps = {
  activeCanvas: Canvas;
  activeStrokeCount: number;
  activeTool: CanvasTool;
  boardColorDraft: string;
  boardTitleDraft: string;
  boardToolsOpen: boolean;
  onActiveToolChange: React.Dispatch<React.SetStateAction<CanvasTool>>;
  onAddNote: () => void;
  onBackToBoards: () => void;
  onBoardColorDraftChange: (color: string) => void;
  onBoardTitleDraftChange: (title: string) => void;
  onDeleteBoard: () => void;
  onImportImages: () => void;
  onImportReferences: () => void;
  onMinimize: () => void;
  onSaveBoardSettings: (canvas: Canvas) => void;
  onToggleBoardTools: () => void;
  onUndoStroke: () => void;
};

export function CanvasBoardHeader({
  activeCanvas,
  activeStrokeCount,
  activeTool,
  boardColorDraft,
  boardTitleDraft,
  boardToolsOpen,
  onActiveToolChange,
  onAddNote,
  onBackToBoards,
  onBoardColorDraftChange,
  onBoardTitleDraftChange,
  onDeleteBoard,
  onImportImages,
  onImportReferences,
  onMinimize,
  onSaveBoardSettings,
  onToggleBoardTools,
  onUndoStroke,
}: CanvasBoardHeaderProps) {
  const toggleTool = (tool: CanvasTool) => {
    onActiveToolChange((current) => (current === tool ? "select" : tool));
  };
  const savedAt = activeCanvas.updatedAt ?? activeCanvas.createdAt;

  return (
    <header className="canvas-board-header">
      <div className="canvas-board-summary">
        <button
          className="canvas-board-back-button"
          type="button"
          aria-label="Boards"
          title="Boards"
          onClick={onBackToBoards}
        >
          <ButtonIcon icon={ArrowLeft} />
        </button>
        <span className="canvas-dot" style={{ background: activeCanvas.color }} />
        <span className="canvas-board-copy">
          <strong>{activeCanvas.title}</strong>
          <span>
            Created{" "}
            <time dateTime={activeCanvas.createdAt}>
              {formatBoardTimestamp(activeCanvas.createdAt)}
            </time>{" "}
            · Last saved{" "}
            <time dateTime={savedAt}>{formatBoardTimestamp(savedAt)}</time>
          </span>
        </span>
      </div>
      <div className="canvas-board-actions">
        <button
          className="canvas-board-action-button"
          type="button"
          aria-label="Add note"
          title="Add note"
          onClick={onAddNote}
        >
          <ButtonIcon icon={StickyNote} />
        </button>
        <button
          className="canvas-board-action-button"
          type="button"
          aria-label="Add reference"
          title="Add reference"
          onClick={onImportReferences}
        >
          <ButtonIcon icon={Paperclip} />
        </button>
        <button
          className="canvas-board-action-button"
          type="button"
          aria-label="Import images"
          title="Import images"
          onClick={onImportImages}
        >
          <ButtonIcon icon={ImagePlus} />
        </button>
        <button
          className={`canvas-board-action-button ${
            activeTool === "pen" ? "canvas-board-action-active" : ""
          }`}
          type="button"
          aria-label="Pen tool"
          aria-pressed={activeTool === "pen"}
          title="Pen tool"
          onClick={() => toggleTool("pen")}
        >
          <ButtonIcon icon={PenLine} />
        </button>
        <button
          className={`canvas-board-action-button ${
            activeTool === "eraser" ? "canvas-board-action-active" : ""
          }`}
          type="button"
          aria-label="Eraser tool"
          aria-pressed={activeTool === "eraser"}
          title="Eraser tool"
          onClick={() => toggleTool("eraser")}
        >
          <ButtonIcon icon={Eraser} />
        </button>
        <button
          className={`canvas-board-action-button ${
            activeTool === "text" ? "canvas-board-action-active" : ""
          }`}
          type="button"
          aria-label="Text tool"
          aria-pressed={activeTool === "text"}
          title="Text tool"
          onClick={() => toggleTool("text")}
        >
          <ButtonIcon icon={Type} />
        </button>
        <button
          className="canvas-board-action-button"
          type="button"
          aria-label="Undo stroke"
          title="Undo stroke"
          disabled={!activeStrokeCount}
          onClick={onUndoStroke}
        >
          <ButtonIcon icon={Undo2} />
        </button>
        <button
          className="canvas-board-edit-button"
          type="button"
          onClick={onToggleBoardTools}
          aria-expanded={boardToolsOpen}
        >
          <ButtonIcon icon={Edit3} />
          Edit
        </button>
        <button
          className="icon-button canvas-board-minimize-button"
          type="button"
          aria-label="Minimize board panel"
          title="Minimize board panel"
          onClick={onMinimize}
        >
          <ButtonIcon icon={Minimize2} />
        </button>
      </div>

      {boardToolsOpen ? (
        <BoardEditDialog
          boardColorDraft={boardColorDraft}
          boardTitleDraft={boardTitleDraft}
          canvas={activeCanvas}
          onBoardColorDraftChange={onBoardColorDraftChange}
          onBoardTitleDraftChange={onBoardTitleDraftChange}
          onClose={onToggleBoardTools}
          onDelete={onDeleteBoard}
          onSave={onSaveBoardSettings}
        />
      ) : null}
    </header>
  );
}
