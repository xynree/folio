import React from "react";
import { fireEvent, render } from "@testing-library/react";
import DropUtil from "./DropUtil";

describe("DropUtil", () => {
  it("prevents default drag behavior and calls the drop callback", () => {
    const callback = vi.fn();
    const { container } = render(<DropUtil callback={callback} />);
    const dropTarget = container.firstElementChild as HTMLElement;
    const dragOverEvent = new Event("dragover", {
      bubbles: true,
      cancelable: true,
    });
    const dropEvent = new Event("drop", {
      bubbles: true,
      cancelable: true,
    });

    fireEvent(dropTarget, dragOverEvent);
    fireEvent(dropTarget, dropEvent);

    expect(dragOverEvent.defaultPrevented).toBe(true);
    expect(dropEvent.defaultPrevented).toBe(true);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
