import type { ItemType } from "../../types";

export const EMPTY_DATA = {
  version: 1,
  items: [],
  canvases: [],
  tags: [],
  projects: [],
};

export const TYPE_LABELS: Record<ItemType, string> = {
  sketch: "Sketch",
  ref: "Ref",
  music: "Music",
  anim: "Anim",
  text: "Text",
  other: "File",
};

export const CANVAS_COLORS = [
  "#9f6b3d",
  "#385d56",
  "#7c5d92",
  "#b06d4a",
  "#546f9a",
];

export const ITEM_DRAG_MIME = "application/x-folio-item-ids";
export const IMAGE_FILE_PATTERN = /\.(avif|gif|heic|jpeg|jpg|png|svg|webp)$/i;

export const ARCHIVE_PANEL_MIN_WIDTH = 390;
export const CANVAS_DOCK_MIN_WIDTH = 420;
export const CANVAS_DOCK_DEFAULT_WIDTH = 420;
export const CANVAS_SPLITTER_WIDTH = 8;

export const CANVAS_SURFACE_WIDTH = 2400;
export const CANVAS_SURFACE_HEIGHT = 1800;
export const CANVAS_WORLD_PADDING = 20000;
export const CANVAS_WORLD_ORIGIN = CANVAS_WORLD_PADDING;
export const CANVAS_WORLD_WIDTH =
  CANVAS_SURFACE_WIDTH + CANVAS_WORLD_PADDING * 2;
export const CANVAS_WORLD_HEIGHT =
  CANVAS_SURFACE_HEIGHT + CANVAS_WORLD_PADDING * 2;
export const CANVAS_MIN_ZOOM = 0.45;
export const CANVAS_MAX_ZOOM = 2.4;
