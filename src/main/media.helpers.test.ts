import { nativeImage } from "electron";
import { readImageDimensionsForFile } from "./media.helpers";

vi.mock("electron", () => ({
  nativeImage: {
    createFromPath: vi.fn(),
  },
}));

function mockNativeImage({
  empty = false,
  height = 360,
  width = 640,
}: {
  empty?: boolean;
  height?: number;
  width?: number;
} = {}) {
  vi.mocked(nativeImage.createFromPath).mockReturnValue({
    getSize: () => ({ width, height }),
    isEmpty: () => empty,
  } as Electron.NativeImage);
}

describe("media helpers", () => {
  it("reads natural image dimensions from nativeImage", () => {
    mockNativeImage({ width: 640.4, height: 359.6 });

    expect(readImageDimensionsForFile("/tmp/image.png")).toEqual({
      mediaWidth: 640,
      mediaHeight: 360,
    });
  });

  it("ignores unreadable or empty images", () => {
    mockNativeImage({ empty: true });
    expect(readImageDimensionsForFile("/tmp/empty.png")).toBeUndefined();

    mockNativeImage({ width: 0, height: 100 });
    expect(readImageDimensionsForFile("/tmp/zero-width.png")).toBeUndefined();

    vi.mocked(nativeImage.createFromPath).mockImplementationOnce(() => {
      throw new Error("Unsupported file");
    });
    expect(readImageDimensionsForFile("/tmp/broken.png")).toBeUndefined();
  });
});
