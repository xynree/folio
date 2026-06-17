import { useCallback, useRef, useState } from "react";

const TAGS_SIDEBAR_DEFAULT_WIDTH = 148;
const TAGS_SIDEBAR_MIN_WIDTH = 112;
const TAGS_SIDEBAR_MAX_WIDTH = 260;

/**
 * Owns the draggable width of the tags sidebar in the studio workspace. The pointer drag updates a
 * clamped width while toggling a resizing flag, and restores the cursor and text-selection styles
 * when the gesture ends. Keeping this isolated lets the shell render without the pointer math.
 */
export function useTagsSidebarResize(tagsCollapsed: boolean) {
  const workspaceRef = useRef<HTMLElement | null>(null);
  const [width, setWidth] = useState(TAGS_SIDEBAR_DEFAULT_WIDTH);
  const [resizing, setResizing] = useState(false);

  const clampWidth = useCallback(
    (nextWidth: number) =>
      Math.round(
        Math.min(
          Math.max(nextWidth, TAGS_SIDEBAR_MIN_WIDTH),
          TAGS_SIDEBAR_MAX_WIDTH,
        ),
      ),
    [],
  );

  const startResize = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (tagsCollapsed) return;
      const workspace = workspaceRef.current;
      if (!workspace) return;

      event.preventDefault();
      event.stopPropagation();

      const previousCursor = document.body.style.cursor;
      const previousUserSelect = document.body.style.userSelect;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      setResizing(true);

      const resizeToPointer = (clientX: number) => {
        const rect = workspace.getBoundingClientRect();
        setWidth(clampWidth(clientX - rect.left));
      };

      const onPointerMove = (moveEvent: PointerEvent) => {
        resizeToPointer(moveEvent.clientX);
      };

      const onPointerUp = () => {
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        setResizing(false);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };

      resizeToPointer(event.clientX);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [clampWidth, tagsCollapsed],
  );

  return { workspaceRef, width, resizing, startResize };
}
