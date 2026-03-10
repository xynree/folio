/**
 * Canvas Related
 *===============================================
 */

// Canvas Location orients an item on a canvas
// TBD: adding connected edges/strokes/more info
interface CanvasPosition {
  x: number;
  y: number;
}

export interface CanvasEdge {
  id: string;
  fromId: string;
  toId: string;
  label?: string;
}

// Notes live on canvas plane
// TBD: "connect" them with edges to Folio Items or other objects
export interface CanvasNote extends CanvasPosition {
  id: string;
  text: string;
}

export type CanvasReference = CanvasPosition & {
  id: string;
  path: string; // relative path in ~/Folio/references/<canvasId>
  filename: string;
};

export interface Canvas {
  id: string;
  title: string;
  description?: string;
  color?: string;
  itemIds: string[];
  // Record<itemId, CanvasItem>
  positions: Record<string, CanvasPosition>;
  notes: CanvasNote[];
  edges: CanvasEdge[];
  references: CanvasReference[];
}
