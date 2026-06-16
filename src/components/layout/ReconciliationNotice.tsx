import { Plus, X } from "lucide-react";
import type { ReconciliationResult } from "../../types";
import { formatCount } from "../folio/model";
import { ButtonIcon } from "../shared/ButtonIcon";

export function ReconciliationNotice({
  reconciliation,
  dismissed,
  onAddUntracked,
  onDismiss,
}: {
  reconciliation: ReconciliationResult | null;
  dismissed: boolean;
  onAddUntracked: () => void;
  onDismiss: () => void;
}) {
  if (!reconciliation || dismissed) return null;

  const { untrackedFiles, missingItems, relocatedItems } = reconciliation;
  if (!untrackedFiles.length && !missingItems.length && !relocatedItems.length) {
    return null;
  }

  return (
    <section className="reconciliation" aria-live="polite">
      <div>
        {untrackedFiles.length ? (
          <p>
            {formatCount(untrackedFiles.length, "new file")} found in your Folio
            folder - add to archive?
          </p>
        ) : null}
        {missingItems.length ? (
          <p>
            {formatCount(missingItems.length, "file")} missing and could not be
            located
          </p>
        ) : null}
        {relocatedItems.length ? (
          <p>{formatCount(relocatedItems.length, "moved file")} reconnected</p>
        ) : null}
      </div>
      <div className="notice-actions">
        {untrackedFiles.length ? (
          <button type="button" onClick={onAddUntracked}>
            <ButtonIcon icon={Plus} />
            Add
          </button>
        ) : null}
        <button type="button" onClick={onDismiss}>
          <ButtonIcon icon={X} />
          Dismiss
        </button>
      </div>
    </section>
  );
}
