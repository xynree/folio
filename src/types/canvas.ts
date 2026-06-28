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

export type CanvasRelationshipType =
  | "related"
  | "inspired-by"
  | "uses"
  | "variant-of"
  | "version-of"
  | "response-to"
  | "part-of";

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
  fromId: string; // ID of an item, note, or text element
  toId: string;
  fromSide?: CanvasConnectionSide;
  toSide?: CanvasConnectionSide;
  direction?: CanvasEdgeDirection;
  relationshipType?: CanvasRelationshipType;
  label?: string; // Optional text shown on the edge
  createdAt?: string;
  updatedAt?: string;
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
  size?: CanvasTextSize;
  createdAt?: string;
  updatedAt?: string;
}

/** A lightweight plain text element placed directly on the canvas surface */
export interface CanvasTextElement extends CanvasObjectGeometry {
  id: string;
  text: string;
  size?: CanvasTextSize;
  createdAt?: string;
  updatedAt?: string;
}

/** A named frame used to organize canvas objects spatially */
export interface CanvasSection extends CanvasObjectGeometry {
  id: string;
  title: string;
  color?: string;
  collapsed?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** A lightweight outside-link card placed directly on the canvas */
export interface CanvasLink extends CanvasObjectGeometry {
  id: string;
  url: string;
  title: string;
  description?: string;
  sourceDomain?: string;
  faviconUrl?: string;
  imageUrl?: string;
  capturedAt: string;
  updatedAt?: string;
}

/** Fetched preview metadata for an outside link */
export interface LinkMetadata {
  url: string;
  title?: string;
  description?: string;
  sourceDomain?: string;
  faviconUrl?: string;
  imageUrl?: string;
}

/** Last useful board viewport for returning to a large canvas */
export interface CanvasViewportState {
  x: number;
  y: number;
  zoom: number;
  updatedAt: string;
}

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
  noteIds?: string[]; // IDs of project Notes placed on the board
  positions: Record<string, CanvasObjectGeometry>; // Item geometry keyed by item ID
  notes: CanvasNote[];
  edges: CanvasEdge[];
  strokes?: CanvasStroke[];
  texts?: CanvasTextElement[];
  sections?: CanvasSection[];
  links?: CanvasLink[];
  viewport?: CanvasViewportState;
  createdFromTemplate?: string;
}
