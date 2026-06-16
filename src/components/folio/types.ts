import type React from "react";
import type { FolioData, FolioItem } from "../../types";

export type ArchiveViewMode = "strip" | "grid";
export type GridTagFilter = "all" | string;
export type ItemDetailsMode = "details" | "tags";
export type DataUpdater = (current: FolioData) => FolioData;

export type ItemOpenHandler = (
  itemId: string,
  event: React.MouseEvent,
  orderedItems: FolioItem[],
  rangeEnabled: boolean,
) => void;

export type ItemDetailsOpenHandler = (
  itemId: string,
  mode?: ItemDetailsMode,
) => void;
