import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useTagsSidebarResize } from "./useTagsSidebarResize";

afterEach(() => {
  cleanup();
  document.body.style.cursor = "";
  document.body.style.userSelect = "";
});

function pointerEvent(type: string, clientX: number) {
  return new MouseEvent(type, { clientX }) as unknown as PointerEvent;
}

describe("useTagsSidebarResize", () => {
  it("starts at the default width and is not resizing", () => {
    const { result } = renderHook(() => useTagsSidebarResize(false));
    expect(result.current.width).toBe(148);
    expect(result.current.resizing).toBe(false);
  });

  it("ignores the gesture while the sidebar is collapsed", () => {
    const { result } = renderHook(() => useTagsSidebarResize(true));
    const div = document.createElement("div");
    result.current.workspaceRef.current = div as unknown as HTMLElement;

    act(() => {
      result.current.startResize({
        clientX: 300,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as React.PointerEvent<HTMLDivElement>);
    });

    expect(result.current.resizing).toBe(false);
  });

  it("tracks pointer movement within the clamped range and restores styles", () => {
    const { result } = renderHook(() => useTagsSidebarResize(false));
    const workspace = document.createElement("div");
    workspace.getBoundingClientRect = () => ({ left: 100 }) as DOMRect;
    result.current.workspaceRef.current = workspace as unknown as HTMLElement;

    act(() => {
      result.current.startResize({
        clientX: 300,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as React.PointerEvent<HTMLDivElement>);
    });
    expect(result.current.resizing).toBe(true);
    expect(result.current.width).toBe(200);

    act(() => {
      window.dispatchEvent(pointerEvent("pointermove", 150));
    });
    // 150 - 100 = 50, clamped up to the minimum of 112.
    expect(result.current.width).toBe(112);

    act(() => {
      window.dispatchEvent(pointerEvent("pointermove", 1000));
    });
    // Clamped down to the maximum of 260.
    expect(result.current.width).toBe(260);

    act(() => {
      window.dispatchEvent(pointerEvent("pointerup", 1000));
    });
    expect(result.current.resizing).toBe(false);
    expect(document.body.style.cursor).toBe("");
  });
});
