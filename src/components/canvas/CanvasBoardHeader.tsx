import React from "react";
import {
  ArrowLeft,
  Edit3,
  Eraser,
  Frame,
  ImagePlus,
  Images,
  Link as LinkIcon,
  Maximize2,
  Minus,
  MousePointer2,
  PenLine,
  Plus,
  ScanLine,
  Search,
  StickyNote,
  Type,
  Undo2,
} from "lucide-react";
import type { Canvas } from "../../types";
import { formatBoardTimestamp } from "../folio/dates";
import { ButtonIcon } from "../shared/ButtonIcon";
import { BoardEditDialog } from "./BoardEditDialog";
import type { CanvasTool } from "./canvasTypes";

type CanvasBoardHeaderProps = {
  activeCanvas: Canvas;
  activeStrokeCount: number;
  activeTool: CanvasTool;
  boardColorDraft: string;
  boardSearchQuery: string;
  boardTitleDraft: string;
  boardToolsOpen: boolean;
  canvasZoom: number;
  projectImageCount: number;
  projectImagePickerOpen: boolean;
  onActiveToolChange: React.Dispatch<React.SetStateAction<CanvasTool>>;
  onAddLink: () => void;
  onAddNote: () => void;
  onBackToBoards: () => void;
  onBoardColorDraftChange: (color: string) => void;
  onBoardSearchQueryChange: (query: string) => void;
  onBoardTitleDraftChange: (title: string) => void;
  onCreateBoard: () => void;
  onDeleteBoard: () => void;
  onFitContent: () => void;
  onImportImages: () => void;
  onResetZoom: () => void;
  onSaveBoardSettings: (canvas: Canvas) => void;
  onToggleBoardTools: () => void;
  onToggleProjectImages: () => void;
  onUndoStroke: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
};

export function CanvasBoardHeader({
  activeCanvas,
  activeStrokeCount,
  activeTool,
  boardColorDraft,
  boardSearchQuery,
  boardTitleDraft,
  boardToolsOpen,
  canvasZoom,
  projectImageCount,
  projectImagePickerOpen,
  onActiveToolChange,
  onAddLink,
  onAddNote,
  onBackToBoards,
  onBoardColorDraftChange,
  onBoardSearchQueryChange,
  onBoardTitleDraftChange,
  onCreateBoard,
  onDeleteBoard,
  onFitContent,
  onImportImages,
  onResetZoom,
  onSaveBoardSettings,
  onToggleBoardTools,
  onToggleProjectImages,
  onUndoStroke,
  onZoomIn,
  onZoomOut,
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
          <span className="canvas-board-title-row">
            <strong>{activeCanvas.title}</strong>
            <button
              className="canvas-board-title-edit-button"
              type="button"
              aria-label="Edit board"
              title="Edit board"
              onClick={onToggleBoardTools}
              aria-expanded={boardToolsOpen}
            >
              <ButtonIcon icon={Edit3} size={13} />
            </button>
          </span>
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
        <span className="canvas-board-primary-actions">
          <label className="canvas-board-search">
            <ButtonIcon icon={Search} size={14} />
            <span className="sr-only">Search board</span>
            <input
              aria-label="Search board"
              placeholder="Search"
              value={boardSearchQuery}
              onChange={(event) =>
                onBoardSearchQueryChange(event.currentTarget.value)
              }
            />
          </label>
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
            className={`canvas-board-action-button ${
              activeTool === "select" ? "canvas-board-action-active" : ""
            }`}
            type="button"
            aria-label="Select tool"
            aria-pressed={activeTool === "select"}
            title="Select tool"
            onClick={() => onActiveToolChange("select")}
          >
            <ButtonIcon icon={MousePointer2} />
          </button>
          <button
            className={`canvas-board-action-button ${
              activeTool === "connect" ? "canvas-board-action-active" : ""
            }`}
            type="button"
            aria-label="Connect tool"
            aria-pressed={activeTool === "connect"}
            title="Connect tool"
            onClick={() => toggleTool("connect")}
          >
            <ButtonIcon icon={ScanLine} />
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
            className={`canvas-board-action-button ${
              activeTool === "section" ? "canvas-board-action-active" : ""
            }`}
            type="button"
            aria-label="Section tool"
            aria-pressed={activeTool === "section"}
            title="Section tool"
            onClick={() => toggleTool("section")}
          >
            <ButtonIcon icon={Frame} />
          </button>
          <button
            className="canvas-board-action-button"
            type="button"
            aria-label="Add link"
            title="Add link"
            onClick={onAddLink}
          >
            <ButtonIcon icon={LinkIcon} />
          </button>
        </span>
        <span className="canvas-board-zoom-controls" aria-label="Canvas zoom">
          <button
            className="canvas-board-action-button"
            type="button"
            aria-label="Zoom out"
            title="Zoom out"
            onClick={onZoomOut}
          >
            <ButtonIcon icon={Minus} />
          </button>
          <button
            className="canvas-board-action-button canvas-board-zoom-value"
            type="button"
            aria-label="Reset zoom"
            title="Reset zoom"
            onClick={onResetZoom}
          >
            {Math.round(canvasZoom * 100)}%
          </button>
          <button
            className="canvas-board-action-button"
            type="button"
            aria-label="Zoom in"
            title="Zoom in"
            onClick={onZoomIn}
          >
            <ButtonIcon icon={Plus} />
          </button>
          <button
            className="canvas-board-action-button"
            type="button"
            aria-label="Fit content"
            title="Fit content"
            onClick={onFitContent}
          >
            <ButtonIcon icon={Maximize2} />
          </button>
        </span>
        <button
          className="canvas-board-action-button"
          type="button"
          aria-label="New board"
          title="New board"
          onClick={onCreateBoard}
        >
          <ButtonIcon icon={Plus} />
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
        <span className="canvas-board-right-actions">
          <button
            className="canvas-board-action-button"
            type="button"
            aria-label="Import images and files"
            title="Import images and files"
            onClick={onImportImages}
          >
            <ButtonIcon icon={ImagePlus} />
          </button>
          <button
            className={`canvas-board-action-button canvas-board-image-toggle ${
              projectImagePickerOpen ? "canvas-board-action-active" : ""
            }`}
            type="button"
            aria-label={projectImagePickerOpen ? "Hide add images" : "Add images"}
            aria-controls="canvas-project-image-picker"
            aria-expanded={projectImagePickerOpen}
            title={projectImagePickerOpen ? "Hide add images" : "Add images"}
            onClick={onToggleProjectImages}
          >
            <ButtonIcon icon={Images} />
            <span className="canvas-board-action-count" aria-hidden="true">
              {projectImageCount}
            </span>
          </button>
        </span>
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
