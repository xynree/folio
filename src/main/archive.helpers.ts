import path from "node:path";
import type { ImportSource, ItemType } from "../types";

export function normalizeArchiveItemType(type: string): ItemType {
  if (type === "image") return "sketch";
  if (type === "audio") return "music";
  if (type === "video") return "anim";
  if (["sketch", "ref", "music", "anim", "text", "other"].includes(type)) {
    return type as ItemType;
  }
  return "other";
}

export function resolveImportSourceMeta(source: ImportSource): {
  filename: string;
  ext: string;
} {
  if (source.kind === "path") {
    const sourceExt = path.extname(source.filePath);
    return {
      filename: path.basename(source.filePath, sourceExt),
      ext: sourceExt.toLowerCase(),
    };
  }

  return {
    filename: source.filename ?? "pasted-image",
    ext: source.ext.toLowerCase(),
  };
}
