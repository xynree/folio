import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateProjectDialog } from "./CreateProjectDialog";

describe("CreateProjectDialog", () => {
  it("requires a name before Create is enabled", async () => {
    const onCreate = vi.fn();
    render(
      <CreateProjectDialog busy={false} onClose={vi.fn()} onCreate={onCreate} />,
    );
    const dialog = screen.getByRole("dialog", { name: /create project/i });

    expect(
      within(dialog).getByRole("button", { name: /create/i }),
    ).toHaveProperty("disabled", true);

    await userEvent.type(screen.getByLabelText("Project name"), "Sketchbook");

    expect(
      within(dialog).getByRole("button", { name: /create/i }),
    ).toHaveProperty("disabled", false);
  });

  it("submits a trimmed name and description", async () => {
    const onCreate = vi.fn();
    render(
      <CreateProjectDialog busy={false} onClose={vi.fn()} onCreate={onCreate} />,
    );

    await userEvent.type(screen.getByLabelText("Project name"), "  Sketchbook  ");
    await userEvent.type(
      screen.getByLabelText("Description"),
      "  Loose ideas  ",
    );
    await userEvent.click(screen.getByRole("button", { name: /create/i }));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith("Sketchbook", "Loose ideas"),
    );
  });

  it("closes on Escape, overlay click, and Cancel", async () => {
    const onClose = vi.fn();
    render(
      <CreateProjectDialog busy={false} onClose={onClose} onCreate={vi.fn()} />,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.mouseDown(
      document.querySelector(".project-create-overlay") as HTMLElement,
    );
    expect(onClose).toHaveBeenCalledTimes(2);

    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("disables actions while busy", () => {
    render(
      <CreateProjectDialog busy={true} onClose={vi.fn()} onCreate={vi.fn()} />,
    );
    const dialog = screen.getByRole("dialog", { name: /create project/i });

    expect(
      within(dialog).getByRole("button", { name: /create/i }),
    ).toHaveProperty("disabled", true);
    expect(
      within(dialog).getByRole("button", { name: /cancel/i }),
    ).toHaveProperty("disabled", true);
  });
});
