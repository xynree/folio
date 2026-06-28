import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { makeNote } from "../../test/fixtures";
import { ProjectNotesView } from "./ProjectNotesView";

function renderView({
  notes = [
    makeNote("note-1", { title: "First note", updatedAt: "2026-06-17T10:00:00.000Z" }),
    makeNote("note-2", { title: "Second note", updatedAt: "2026-06-18T10:00:00.000Z" }),
  ],
  activeNoteId = null as string | null,
} = {}) {
  const props = {
    notes,
    activeNoteId,
    onCreateNote: vi.fn(),
    onOpenNote: vi.fn(),
    onSaveNoteContent: vi.fn(),
    onDeleteNote: vi.fn(),
  };
  render(<ProjectNotesView {...props} />);
  return props;
}

describe("ProjectNotesView", () => {
  it("lists notes and shows a placeholder when no note is selected", () => {
    renderView();

    expect(screen.getByText("First note")).not.toBeNull();
    expect(screen.getByText("Second note")).not.toBeNull();
    expect(
      screen.getByText(/select a note to start editing/i),
    ).not.toBeNull();
  });

  it("shows an empty state when there are no notes", () => {
    renderView({ notes: [] });
    expect(screen.getByText("No notes yet")).not.toBeNull();
  });

  it("invokes onCreateNote when the new-note button is clicked", () => {
    const props = renderView();
    fireEvent.click(screen.getByRole("button", { name: /new note/i }));
    expect(props.onCreateNote).toHaveBeenCalledTimes(1);
  });

  it("invokes onOpenNote with the clicked note id", () => {
    const props = renderView();
    fireEvent.click(screen.getByRole("button", { name: /first note/i }));
    expect(props.onOpenNote).toHaveBeenCalledWith("note-1");
  });

  it("marks the active note as pressed and opens it in the editor", async () => {
    vi.mocked(window.folio.readNoteContent).mockResolvedValue("# First note\n\nbody");
    renderView({ activeNoteId: "note-1" });

    const activeButton = screen.getByRole("button", { name: /first note/i });
    expect(activeButton.getAttribute("aria-pressed")).toBe("true");

    await waitFor(() => {
      expect(screen.getByLabelText("Note editor")).not.toBeNull();
    });
  });
});
