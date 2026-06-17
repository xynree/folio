import { nativeImage } from "electron";

export interface MediaDimensions {
  mediaWidth: number;
  mediaHeight: number;
}

export function readImageDimensionsForFile(
  filePath: string,
): MediaDimensions | undefined {
  try {
    const image = nativeImage.createFromPath(filePath);
    if (image.isEmpty()) return undefined;

    const size = image.getSize();
    if (!size.width || !size.height) return undefined;

    return {
      mediaWidth: Math.round(size.width),
      mediaHeight: Math.round(size.height),
    };
  } catch {
    return undefined;
  }
}
