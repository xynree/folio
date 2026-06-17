/**
 * Spatial Canvas Types
 *===============================================
 */

/** Simple coordinate pair for positioning objects */
export interface CanvasPosition {
  x: number;
  y: number;
}

/** Optional rendered object dimensions saved with canvas objects */
export interface CanvasObjectGeometry extends CanvasPosition {
  width?: number;
  height?: number;
}

export interface CanvasObjectSize {
  width: number;
  height: number;
}

export type CanvasConnectionSide = "top" | "right" | "bottom" | "left";

export type CanvasEdgeDirection = "none" | "forward" | "bidirectional";

export type CanvasTextSize = "sm" | "md" | "large";

export type BoardKind =
  | "reference-board"
  | "moodboard"
  | "process-board"
  | "review-board"
  | "collection";

export type BoardStatus = "active" | "paused" | "done" | "archived";

/** A connecting line between two objects on a canvas */
export interface CanvasEdge {
  id: string;
  fromId: string; // ID of an item, note, reference, or text element
  toId: string;
  fromSide?: CanvasConnectionSide;
  toSide?: CanvasConnectionSide;
  direction?: CanvasEdgeDirection;
  label?: string; // Optional text shown on the edge
}

/** A freehand annotation path drawn directly on the canvas */
export interface CanvasStroke {
  id: string;
  path: string;
  color: string;
}

/** A sticky note placed directly on the canvas surface */
export interface CanvasNote extends CanvasObjectGeometry {
  id: string;
  text: string;
}

/** A lightweight plain text element placed directly on the canvas surface */
export interface CanvasTextElement extends CanvasObjectGeometry {
  id: string;
  text: string;
  size?: CanvasTextSize;
}

/** A reference image that only exists on a specific canvas */
export type CanvasReference = CanvasObjectGeometry & {
  id: string;
  path: string; // Path relative to ~/Folio/references/<canvasId>/
  filename: string;
  mediaWidth?: number; // Natural source image width when known
  mediaHeight?: number; // Natural source image height when known
};

/** A named thinking surface with positioned items and annotations */
export interface Canvas {
  id: string;
  title: string;
  description?: string;
  color?: string; // Theme color for the canvas
  projectId?: string;
  kind?: BoardKind;
  status?: BoardStatus;
  brief?: string;
  outcome?: string;
  startedAt?: string;
  targetDate?: string;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  itemIds: string[]; // IDs of items from the main archive
  positions: Record<string, CanvasObjectGeometry>; // Item geometry keyed by item ID
  notes: CanvasNote[];
  edges: CanvasEdge[];
  references: CanvasReference[];
  strokes?: CanvasStroke[];
  texts?: CanvasTextElement[];
}
