import { formatCount } from "../folio/model";

export function StatusBar({
  itemCount,
  canvasCount,
  tagCount,
  gapCount,
}: {
  itemCount: number;
  canvasCount: number;
  tagCount: number;
  gapCount: number;
}) {
  return (
    <footer className="status-bar">
      <span>{formatCount(itemCount, "item")}</span>
      <span>{formatCount(canvasCount, "canvas")}</span>
      <span>{formatCount(tagCount, "tag")}</span>
      <span>{formatCount(gapCount, "gap")}</span>
      <span>~/Documents/Folio/</span>
    </footer>
  );
}
