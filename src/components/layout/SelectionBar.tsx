import { PanelRightOpen, Plus, X } from "lucide-react";
import { formatCount } from "../folio/model";
import { ButtonIcon } from "../shared/ButtonIcon";

export function SelectionBar({
  count,
  onAddToBoard,
  onClear,
  onOpenNewBoard,
}: {
  count: number;
  onAddToBoard: () => void;
  onClear: () => void;
  onOpenNewBoard: () => void;
}) {
  if (!count) return null;

  return (
    <section className="selection-bar" aria-live="polite">
      <strong>{formatCount(count, "item")} selected</strong>
      <span>Drag onto a board or open on new board -&gt;</span>
      <div className="selection-actions">
        <button type="button" onClick={onAddToBoard}>
          <ButtonIcon icon={Plus} />
          Add to active board
        </button>
        <button type="button" onClick={onOpenNewBoard}>
          <ButtonIcon icon={PanelRightOpen} />
          Open on new board
        </button>
        <button type="button" onClick={onClear}>
          <ButtonIcon icon={X} />
          Clear
        </button>
      </div>
    </section>
  );
}
