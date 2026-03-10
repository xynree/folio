/**
 * Spatial Canvas Types
 *===============================================
 */

/** Simple coordinate pair for positioning objects */
export interface CanvasPosition {
  x: number;
  y: number;
}

/** A connecting line between two objects on a canvas */
export interface CanvasEdge {
  id: string;
  fromId: string; // ID of an item, note, or reference
  toId: string;
  label?: string; // Optional text shown on the edge
}

/** A text card placed directly on the canvas surface */
export interface CanvasNote extends CanvasPosition {
  id: string;
  text: string;
}

/** A reference image that only exists on a specific canvas */
export type CanvasReference = CanvasPosition & {
  id: string;
  path: string; // Path relative to ~/Folio/references/<canvasId>/
  filename: string;
};

/** A named thinking surface with positioned items and annotations */
export interface Canvas {
  id: string;
  title: string;
  description?: string;
  color?: string; // Theme color for the canvas
  itemIds: string[]; // IDs of items from the main archive
  positions: Record<string, CanvasPosition>; // Item positions keyed by item ID
  notes: CanvasNote[];
  edges: CanvasEdge[];
  references: CanvasReference[];
}
