import { PanelRightOpen, X } from "lucide-react";
import { formatCount } from "../folio/model";
import { ButtonIcon } from "../shared/ButtonIcon";

export function SelectionBar({
  count,
  onClear,
  onOpenNewBoard,
}: {
  count: number;
  onClear: () => void;
  onOpenNewBoard: () => void;
}) {
  if (!count) return null;

  return (
    <section
      className="selection-bar selection-bar-archive-top"
      aria-live="polite"
    >
      <div className="selection-message">
        <strong>{formatCount(count, "item")} selected</strong>
        <span>Drag onto a board</span>
      </div>
      <div className="selection-actions">
        <button type="button" onClick={onOpenNewBoard}>
          <ButtonIcon icon={PanelRightOpen} />
          Create new board with selection
        </button>
        <button type="button" onClick={onClear}>
          <ButtonIcon icon={X} />
          Clear
        </button>
      </div>
    </section>
  );
}
