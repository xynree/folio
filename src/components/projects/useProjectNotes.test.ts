import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useProjectNotes } from "./useProjectNotes";
import { makeData, makeNote } from "../../test/fixtures";
import type { FolioData, Note } from "../../types";

function setup(options?: {
  initialData?: FolioData;
  activeProjectId?: string | null;
  activeNoteId?: string | null;
  setActiveNoteId?: (noteId: string | null) => void;
}) {
  let current = options?.initialData ?? makeData({ notes: [] });
  const dataRef = {
    get current() {
      return current;
    },
    set current(value: FolioData) {
      current = value;
    },
  } as React.RefObject<FolioData>;
  const putData = vi.fn((next: FolioData) => {
    current = next;
  });
  const onToast = vi.fn();
  const setActiveNoteId = options?.setActiveNoteId ?? vi.fn();

  const { result } = renderHook(() =>
    useProjectNotes({
      activeProjectId:
        options?.activeProjectId === undefined
          ? "project-1"
          : options.activeProjectId,
      putData,
      dataRef,
      activeNoteId: options?.activeNoteId ?? null,
      setActiveNoteId,
      onToast,
    }),
  );

  return { result, putData, onToast, setActiveNoteId, getData: () => current };
}

describe("useProjectNotes", () => {
  it("creates a note, prepends it, and selects it", async () => {
    const created = makeNote("note-new", { title: "Note 1" });
    vi.mocked(window.folio.createNote).mockResolvedValue(created);
    const setActiveNoteId = vi.fn();
    const { result, getData, onToast } = setup({ setActiveNoteId });

    let returned: Note | null = null;
    await act(async () => {
      returned = await result.current.createProjectNote();
    });

    expect(window.folio.createNote).toHaveBeenCalledWith("project-1", "Note 1");
    expect(returned).toEqual(created);
    expect(getData().notes[0].id).toBe("note-new");
    expect(setActiveNoteId).toHaveBeenCalledWith("note-new");
    expect(onToast).toHaveBeenCalledWith("Note created");
  });

  it("does nothing when there is no active project", async () => {
    const { result } = setup({ activeProjectId: null });

    let returned: Note | null = makeNote("x");
    await act(async () => {
      returned = await result.current.createProjectNote();
    });

    expect(returned).toBeNull();
    expect(window.folio.createNote).not.toHaveBeenCalled();
  });

  it("numbers new notes by the count of existing project notes", async () => {
    const data = makeData({
      notes: [
        makeNote("a", { projectId: "project-1" }),
        makeNote("b", { projectId: "project-1" }),
        makeNote("c", { projectId: "other" }),
      ],
    });
    vi.mocked(window.folio.createNote).mockResolvedValue(makeNote("d"));
    const { result } = setup({ initialData: data });

    await act(async () => {
      await result.current.createProjectNote();
    });

    expect(window.folio.createNote).toHaveBeenCalledWith("project-1", "Note 3");
  });

  it("saves note content and replaces the note in state", async () => {
    const data = makeData({ notes: [makeNote("note-1", { title: "Old" })] });
    const updated = makeNote("note-1", { title: "New", updatedAt: "2030-01-01T00:00:00.000Z" });
    vi.mocked(window.folio.writeNoteContent).mockResolvedValue(updated);
    const { result, getData } = setup({ initialData: data });

    await act(async () => {
      await result.current.saveNoteContent("note-1", "# New\n\nbody");
    });

    expect(window.folio.writeNoteContent).toHaveBeenCalledWith(
      "note-1",
      "# New\n\nbody",
    );
    expect(getData().notes[0].title).toBe("New");
  });

  it("deletes a note and clears the active selection when it matches", async () => {
    const data = makeData({ notes: [makeNote("note-1")] });
    const nextData = makeData({ notes: [] });
    vi.mocked(window.folio.deleteNote).mockResolvedValue(nextData);
    const setActiveNoteId = vi.fn();
    const { result, putData } = setup({
      initialData: data,
      activeNoteId: "note-1",
      setActiveNoteId,
    });

    await act(async () => {
      await result.current.deleteProjectNote("note-1");
    });

    expect(window.folio.deleteNote).toHaveBeenCalledWith("note-1");
    expect(putData).toHaveBeenCalledWith(nextData);
    expect(setActiveNoteId).toHaveBeenCalledWith(null);
  });

  it("keeps the active selection when deleting a different note", async () => {
    const nextData = makeData({ notes: [makeNote("note-1")] });
    vi.mocked(window.folio.deleteNote).mockResolvedValue(nextData);
    const setActiveNoteId = vi.fn();
    const { result } = setup({
      initialData: makeData({ notes: [makeNote("note-1"), makeNote("note-2")] }),
      activeNoteId: "note-1",
      setActiveNoteId,
    });

    await act(async () => {
      await result.current.deleteProjectNote("note-2");
    });

    expect(setActiveNoteId).not.toHaveBeenCalled();
  });

  it("toasts and returns null when note creation fails", async () => {
    vi.mocked(window.folio.createNote).mockRejectedValue(new Error("boom"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(vi.fn());
    const { result, onToast, putData } = setup();

    let returned: Note | null = makeNote("x");
    await act(async () => {
      returned = await result.current.createProjectNote();
    });

    expect(returned).toBeNull();
    expect(onToast).toHaveBeenCalledWith("Note could not be created");
    expect(putData).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("toasts when saving note content fails", async () => {
    vi.mocked(window.folio.writeNoteContent).mockRejectedValue(new Error("io"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(vi.fn());
    const { result, onToast } = setup({
      initialData: makeData({ notes: [makeNote("note-1")] }),
    });

    await act(async () => {
      await result.current.saveNoteContent("note-1", "content");
    });

    expect(onToast).toHaveBeenCalledWith("Note could not be saved");
    consoleError.mockRestore();
  });

  it("toasts when deleting a note fails", async () => {
    vi.mocked(window.folio.deleteNote).mockRejectedValue(new Error("io"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(vi.fn());
    const { result, onToast } = setup({
      initialData: makeData({ notes: [makeNote("note-1")] }),
    });

    await act(async () => {
      await result.current.deleteProjectNote("note-1");
    });

    expect(onToast).toHaveBeenCalledWith("Note could not be deleted");
    consoleError.mockRestore();
  });
});
