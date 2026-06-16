import { PanelRightOpen, Tag as TagIcon, Trash2, X } from "lucide-react";
import { formatCount } from "../folio/model";
import { ButtonIcon } from "../shared/ButtonIcon";

export function SelectionBar({
  count,
  newBoardDialogOpen,
  newBoardTitle,
  tagDialogOpen,
  tagDraft,
  onCancelNewBoard,
  onCancelTag,
  onApplyTag,
  onClear,
  onCreateNewBoard,
  onDeleteSelection,
  onNewBoardTitleChange,
  onOpenNewBoard,
  onOpenTag,
  onTagDraftChange,
}: {
  count: number;
  newBoardDialogOpen: boolean;
  newBoardTitle: string;
  tagDialogOpen: boolean;
  tagDraft: string;
  onCancelNewBoard: () => void;
  onCancelTag: () => void;
  onApplyTag: () => void;
  onClear: () => void;
  onCreateNewBoard: () => void;
  onDeleteSelection: () => void;
  onNewBoardTitleChange: (title: string) => void;
  onOpenNewBoard: () => void;
  onOpenTag: () => void;
  onTagDraftChange: (tag: string) => void;
}) {
  if (!count) return null;

  return (
    <section
      className="selection-bar selection-bar-archive-top"
      aria-live="polite"
    >
      <div className="selection-message">
        <strong>{formatCount(count, "item")} selected</strong>
      </div>
      <div className="selection-actions">
        <button
          className="selection-tag-button"
          type="button"
          onClick={onOpenTag}
        >
          <ButtonIcon icon={TagIcon} />
          Tag
        </button>
        <button
          className="selection-create-button"
          type="button"
          onClick={onOpenNewBoard}
        >
          <ButtonIcon icon={PanelRightOpen} />
          New board
        </button>
        <button
          className="selection-clear-button"
          type="button"
          onClick={onClear}
        >
          <ButtonIcon icon={X} />
          Clear
        </button>
        <button
          className="selection-delete-button"
          type="button"
          onClick={onDeleteSelection}
        >
          <ButtonIcon icon={Trash2} />
          Delete
        </button>
      </div>
      {newBoardDialogOpen ? (
        <form
          className="selection-board-dialog"
          role="dialog"
          aria-label="Name new board"
          onSubmit={(event) => {
            event.preventDefault();
            onCreateNewBoard();
          }}
        >
          <label>
            <span>Board name</span>
            <input
              autoFocus
              value={newBoardTitle}
              onChange={(event) => onNewBoardTitleChange(event.target.value)}
              placeholder="Board name"
            />
          </label>
          <div className="selection-board-dialog-actions">
            <button className="selection-dialog-create" type="submit">
              Create
            </button>
            <button type="button" onClick={onCancelNewBoard}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}
      {tagDialogOpen ? (
        <form
          className="selection-board-dialog selection-tag-dialog"
          role="dialog"
          aria-label="Tag selected items"
          onSubmit={(event) => {
            event.preventDefault();
            onApplyTag();
          }}
        >
          <label>
            <span>Tag name</span>
            <input
              autoFocus
              value={tagDraft}
              onChange={(event) => onTagDraftChange(event.target.value)}
              placeholder="Tag name"
            />
          </label>
          <div className="selection-board-dialog-actions">
            <button className="selection-dialog-create" type="submit">
              Apply
            </button>
            <button type="button" onClick={onCancelTag}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
