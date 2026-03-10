import { Canvas } from "./canvas";

export interface FolioData {
  version: number;
  items: FolioItem[];
  canvases: Canvas[];
  tags: Tag[];
}

export type ItemType = "image" | "audio" | "video" | "text";

export interface FolioItem {
  id: string;
  path: string;
  hash: string;
  type: ItemType;
  date: string; // import date ISO string
  title: string;
  tagIds: string[]; // References ids from Folio tags
  missing?: boolean;
}

// Tags enable filtering, partitioning items in grid
export interface Tag {
  id: string;
  text: string;
}
