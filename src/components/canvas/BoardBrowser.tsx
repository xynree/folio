import React from "react";
import { Edit3, Ellipsis, Minimize2, Plus, Trash2 } from "lucide-react";
import type { Canvas, FolioItem, ThumbnailUrls } from "../../types";
import { formatCount } from "../folio/model";
import { ButtonIcon } from "../shared/ButtonIcon";
import { LazyThumbnail } from "../shared/LazyThumbnail";
import { BoardEditDialog } from "./BoardEditDialog";

const BOARD_BROWSER_PREVIEW_LIMIT = 3;

export function BoardBrowser({
  activeCanvasId,
  boardColorDraft,
  boardDropCanvasId,
  boardMenuCanvasId,
  boardTitleDraft,
  browserEditCanvas,
  canvases,
  itemsById,
  thumbUrls,
  setThumbUrls,
  onAddDraggedItemsToBoard,
  onBoardColorDraftChange,
  onBoardTileDragLeave,
  onBoardTileDragOver,
  onBoardTitleDraftChange,
  onCloseBrowserEditCanvas,
  onCreateBoard,
  onDeleteBoardById,
  onEditCanvas,
  onMinimize,
  onOpenCanvas,
  onSaveBoardSettings,
  onToggleBoardMenu,
}: {
  activeCanvasId: string | null;
  boardColorDraft: string;
  boardDropCanvasId: string | null;
  boardMenuCanvasId: string | null;
  boardTitleDraft: string;
  browserEditCanvas: Canvas | null;
  canvases: Canvas[];
  itemsById: Map<string, FolioItem>;
  thumbUrls: ThumbnailUrls;
  setThumbUrls: React.Dispatch<React.SetStateAction<ThumbnailUrls>>;
  onAddDraggedItemsToBoard: (
    event: React.DragEvent<HTMLElement>,
    canvasId: string,
  ) => void;
  onBoardColorDraftChange: (color: string) => void;
  onBoardTileDragLeave: (
    event: React.DragEvent<HTMLElement>,
    canvasId: string,
  ) => void;
  onBoardTileDragOver: (
    event: React.DragEvent<HTMLElement>,
    canvasId: string,
  ) => void;
  onBoardTitleDraftChange: (title: string) => void;
  onCloseBrowserEditCanvas: () => void;
  onCreateBoard: () => void;
  onDeleteBoardById: (canvasId: string) => void;
  onEditCanvas: (canvasId: string) => void;
  onMinimize: () => void;
  onOpenCanvas: (canvasId: string) => void;
  onSaveBoardSettings: (canvas: Canvas) => void;
  onToggleBoardMenu: (canvasId: string) => void;
}) {
  return (
    <section className="canvas-workspace canvas-board-browser">
      <header className="canvas-board-browser-header">
        <div className="canvas-board-browser-copy">
          <strong>Boards</strong>
          <span>{formatCount(canvases.length, "board")}</span>
        </div>
        <div className="canvas-board-browser-actions">
          <button
            className="secondary-action canvas-board-new-button"
            type="button"
            onClick={onCreateBoard}
          >
            <ButtonIcon icon={Plus} />
            New board
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
      </header>

      {canvases.length ? (
        <div className="canvas-board-grid">
          {canvases.map((canvas) => {
            const memberItems = canvas.itemIds
              .map((itemId) => itemsById.get(itemId))
              .filter(Boolean) as FolioItem[];
            const previewItems = memberItems.slice(0, BOARD_BROWSER_PREVIEW_LIMIT);
            const previewCount = Math.min(
              previewItems.length,
              BOARD_BROWSER_PREVIEW_LIMIT,
            );
            return (
              <article
                className={`canvas-board-tile ${
                  canvas.id === activeCanvasId ? "active" : ""
                } ${
                  boardDropCanvasId === canvas.id ? "canvas-board-tile-drop-target" : ""
                }`}
                key={canvas.id}
                onDragOver={(event) => onBoardTileDragOver(event, canvas.id)}
                onDragLeave={(event) => onBoardTileDragLeave(event, canvas.id)}
                onDrop={(event) => onAddDraggedItemsToBoard(event, canvas.id)}
              >
                <button
                  className="canvas-board-open-button"
                  type="button"
                  aria-label={`Open ${canvas.title}, ${formatCount(
                    canvas.itemIds.length,
                    "item",
                  )}`}
                  onClick={() => onOpenCanvas(canvas.id)}
                >
                  <span
                    className={`canvas-board-cover canvas-board-cover-${previewCount}`}
                  >
                    {previewItems.length ? (
                      previewItems.map((item, index) => (
                        <span
                          className={`canvas-board-cover-slot canvas-board-cover-slot-${
                            index + 1
                          }`}
                          key={item.id}
                        >
                          <LazyThumbnail
                            item={item}
                            thumbUrls={thumbUrls}
                            setThumbUrls={setThumbUrls}
                            requestThumbnail={false}
                          />
                        </span>
                      ))
                    ) : (
                      <span className="canvas-board-cover-empty">
                        <span
                          className="canvas-board-cover-dot"
                          style={{ background: canvas.color }}
                        />
                      </span>
                    )}
                  </span>
                  <span className="canvas-board-tile-meta">
                    <span className="canvas-board-tile-title">
                      <span
                        className="canvas-board-tile-dot"
                        style={{ background: canvas.color }}
                      />
                      <strong title={canvas.title}>{canvas.title}</strong>
                    </span>
                    <small>{formatCount(canvas.itemIds.length, "item")}</small>
                  </span>
                </button>
                <span
                  className={`canvas-board-menu ${
                    boardMenuCanvasId === canvas.id ? "canvas-board-menu-open" : ""
                  }`}
                >
                  <button
                    className="icon-button canvas-board-menu-button"
                    type="button"
                    aria-label={`More actions for ${canvas.title}`}
                    aria-haspopup="menu"
                    aria-expanded={boardMenuCanvasId === canvas.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleBoardMenu(canvas.id);
                    }}
                  >
                    <ButtonIcon icon={Ellipsis} />
                  </button>
                  {boardMenuCanvasId === canvas.id ? (
                    <span
                      className="canvas-board-menu-popover"
                      role="menu"
                      aria-label={`Actions for ${canvas.title}`}
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={(event) => {
                          event.stopPropagation();
                          onEditCanvas(canvas.id);
                        }}
                      >
                        <ButtonIcon icon={Edit3} />
                        Edit
                      </button>
                      <button
                        className="danger-menu-item"
                        type="button"
                        role="menuitem"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDeleteBoardById(canvas.id);
                        }}
                      >
                        <ButtonIcon icon={Trash2} />
                        Delete
                      </button>
                    </span>
                  ) : null}
                </span>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="canvas-empty">
          <div className="canvas-board-preview">
            <div className="board-node board-node-a" />
            <div className="board-node board-node-b" />
            <div className="board-node board-node-c" />
            <svg viewBox="0 0 460 240" aria-hidden="true">
              <path d="M116 92 C170 54, 242 70, 310 116" />
              <path d="M164 164 C226 186, 292 178, 346 142" />
            </svg>
          </div>
        </div>
      )}

      {browserEditCanvas ? (
        <BoardEditDialog
          boardColorDraft={boardColorDraft}
          boardTitleDraft={boardTitleDraft}
          canvas={browserEditCanvas}
          className="board-edit-browser-dialog"
          onBoardColorDraftChange={onBoardColorDraftChange}
          onBoardTitleDraftChange={onBoardTitleDraftChange}
          onClose={onCloseBrowserEditCanvas}
          onDelete={() => {
            onDeleteBoardById(browserEditCanvas.id);
            onCloseBrowserEditCanvas();
          }}
          onSave={onSaveBoardSettings}
        />
      ) : null}
    </section>
  );
}
