import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { makeNote } from "../../test/fixtures";
import { NoteEditorPanel } from "./NoteEditorPanel";

function renderPanel({
  note = makeNote("note-1", {
    title: "Concept",
    updatedAt: "2026-06-18T10:00:00.000Z",
  }),
} = {}) {
  const props = {
    note,
    onSaveContent: vi.fn(),
    onDelete: vi.fn(),
  };
  render(<NoteEditorPanel {...props} />);
  return props;
}

describe("NoteEditorPanel", () => {
  it("loads note content from the bridge and renders the editor", async () => {
    vi.mocked(window.folio.readNoteContent).mockResolvedValue(
      "# Concept\n\nInitial content",
    );

    renderPanel();

    expect(window.folio.readNoteContent).toHaveBeenCalledWith("note-1");
    await waitFor(() => {
      expect(screen.getByDisplayValue(/Initial content/)).not.toBeNull();
    });
  });

  it("does not autosave the freshly loaded content", async () => {
    vi.mocked(window.folio.readNoteContent).mockResolvedValue("# Loaded\n\n");
    const props = renderPanel();

    await waitFor(() => {
      expect(screen.getByDisplayValue(/Loaded/)).not.toBeNull();
    });

    await new Promise((resolve) => setTimeout(resolve, 800));
    expect(props.onSaveContent).not.toHaveBeenCalled();
  });

  it("autosaves edited content after the debounce window", async () => {
    vi.mocked(window.folio.readNoteContent).mockResolvedValue("# Loaded\n\n");
    const props = renderPanel();

    const textarea = await screen.findByDisplayValue(/Loaded/);
    fireEvent.change(textarea, {
      target: { value: "# Loaded\n\nNew text" },
    });

    await waitFor(
      () => {
        expect(props.onSaveContent).toHaveBeenCalledWith(
          "note-1",
          "# Loaded\n\nNew text",
        );
      },
      { timeout: 1500 },
    );
  });

  it("confirms before deleting and calls onDelete with the note id", async () => {
    vi.mocked(window.folio.readNoteContent).mockResolvedValue("# Concept\n\n");
    const props = renderPanel();

    await screen.findByDisplayValue(/Concept/);
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));

    expect(window.confirm).toHaveBeenCalled();
    expect(props.onDelete).toHaveBeenCalledWith("note-1");
  });

  it("does not delete when the confirmation is dismissed", async () => {
    vi.mocked(window.folio.readNoteContent).mockResolvedValue("# Concept\n\n");
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    const props = renderPanel();

    await screen.findByDisplayValue(/Concept/);
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));

    expect(props.onDelete).not.toHaveBeenCalled();
  });

  it("falls back to an empty editor when loading content fails", async () => {
    vi.mocked(window.folio.readNoteContent).mockRejectedValue(new Error("io"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(vi.fn());

    renderPanel();

    await waitFor(() => {
      expect(screen.queryByText(/loading note/i)).toBeNull();
    });
    expect(screen.getByLabelText("Note editor")).not.toBeNull();
    consoleError.mockRestore();
  });
});
