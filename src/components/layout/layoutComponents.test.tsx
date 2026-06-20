import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { makeItem } from "../../test/fixtures";
import { ReconciliationNotice } from "./ReconciliationNotice";
import { SelectionBar } from "./SelectionBar";

describe("layout components", () => {
  it("hides selection controls when no items are selected", () => {
    const { container } = render(
      <SelectionBar
        count={0}
        newBoardDialogOpen={false}
        newBoardTitle=""
        tagDialogOpen={false}
        tagDraft=""
        onCancelNewBoard={vi.fn()}
        onCancelTag={vi.fn()}
        onApplyTag={vi.fn()}
        onClear={vi.fn()}
        onCreateNewBoard={vi.fn()}
        onDeleteSelection={vi.fn()}
        onNewBoardTitleChange={vi.fn()}
        onOpenNewBoard={vi.fn()}
        onOpenTag={vi.fn()}
        onTagDraftChange={vi.fn()}
      />,
    );

    expect(container.firstElementChild).toBeNull();
  });

  it("handles selection actions and dialog submissions", () => {
    const onApplyTag = vi.fn();
    const onCreateNewBoard = vi.fn();
    const onNewBoardTitleChange = vi.fn();
    const onTagDraftChange = vi.fn();

    render(
      <SelectionBar
        count={2}
        newBoardDialogOpen
        newBoardTitle="Board"
        tagDialogOpen
        tagDraft="sketch"
        onCancelNewBoard={vi.fn()}
        onCancelTag={vi.fn()}
        onApplyTag={onApplyTag}
        onClear={vi.fn()}
        onCreateNewBoard={onCreateNewBoard}
        onDeleteSelection={vi.fn()}
        onNewBoardTitleChange={onNewBoardTitleChange}
        onOpenNewBoard={vi.fn()}
        onOpenTag={vi.fn()}
        onTagDraftChange={onTagDraftChange}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Board name"), {
      target: { value: "Review board" },
    });
    fireEvent.change(screen.getByPlaceholderText("Tag name"), {
      target: { value: "roughs" },
    });
    fireEvent.submit(screen.getByRole("dialog", { name: "Name new board" }));
    fireEvent.submit(screen.getByRole("dialog", { name: "Tag selected items" }));

    expect(onNewBoardTitleChange).toHaveBeenCalledWith("Review board");
    expect(onTagDraftChange).toHaveBeenCalledWith("roughs");
    expect(onCreateNewBoard).toHaveBeenCalledTimes(1);
    expect(onApplyTag).toHaveBeenCalledTimes(1);
  });

  it("renders reconciliation actions only when there is work to review", () => {
    const onAddUntracked = vi.fn();
    const onDismiss = vi.fn();
    const { rerender } = render(
      <ReconciliationNotice
        reconciliation={null}
        dismissed={false}
        onAddUntracked={onAddUntracked}
        onDismiss={onDismiss}
      />,
    );

    expect(screen.queryByText("Dismiss")).toBeNull();

    rerender(
      <ReconciliationNotice
        reconciliation={{
          scannedAt: "2026-06-15T12:00:00.000Z",
          untrackedFiles: [
            { path: "new.png", absolutePath: "/tmp/new.png", hash: "hash" },
          ],
          missingItems: [makeItem("missing")],
          relocatedItems: [makeItem("moved")],
        }}
        dismissed={false}
        onAddUntracked={onAddUntracked}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(screen.getByText("Add"));
    fireEvent.click(screen.getByText("Dismiss"));

    expect(screen.getByText(/1 new file found/)).not.toBeNull();
    expect(screen.getByText(/1 file missing/)).not.toBeNull();
    expect(screen.getByText(/1 moved file reconnected/)).not.toBeNull();
    expect(onAddUntracked).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
