import { useCallback } from "react";
import type { FolioData, Note } from "../../types";

type UseProjectNotesOptions = {
  activeProjectId: string | null;
  putData: (data: FolioData) => void;
  dataRef: React.RefObject<FolioData>;
  activeNoteId: string | null;
  setActiveNoteId: (noteId: string | null) => void;
  onToast: (message: string) => void;
};

export type ProjectNoteActions = {
  createProjectNote: () => Promise<Note | null>;
  saveNoteContent: (noteId: string, content: string) => Promise<void>;
  deleteProjectNote: (noteId: string) => Promise<void>;
};

/**
 * Owns the create/save/delete lifecycle for standalone Markdown notes attached
 * to the active project. Note content lives on disk and is mediated through the
 * main-process IPC bridge; this hook keeps the in-memory note metadata and the
 * active selection in sync.
 */
export function useProjectNotes({
  activeProjectId,
  putData,
  dataRef,
  activeNoteId,
  setActiveNoteId,
  onToast,
}: UseProjectNotesOptions): ProjectNoteActions {
  const createProjectNote = useCallback(async (): Promise<Note | null> => {
    if (!activeProjectId) return null;

    const existingCount = dataRef.current.notes.filter(
      (note) => note.projectId === activeProjectId,
    ).length;

    try {
      const note = await window.folio.createNote(
        activeProjectId,
        `Note ${existingCount + 1}`,
      );
      putData({
        ...dataRef.current,
        notes: [note, ...dataRef.current.notes],
      });
      setActiveNoteId(note.id);
      onToast("Note created");
      return note;
    } catch (error) {
      console.error(error);
      onToast("Note could not be created");
      return null;
    }
  }, [activeProjectId, dataRef, onToast, putData, setActiveNoteId]);

  const saveNoteContent = useCallback(
    async (noteId: string, content: string) => {
      try {
        const updatedNote = await window.folio.writeNoteContent(noteId, content);
        putData({
          ...dataRef.current,
          notes: dataRef.current.notes.map((note) =>
            note.id === noteId ? updatedNote : note,
          ),
        });
      } catch (error) {
        console.error(error);
        onToast("Note could not be saved");
      }
    },
    [dataRef, onToast, putData],
  );

  const deleteProjectNote = useCallback(
    async (noteId: string) => {
      try {
        const nextData = await window.folio.deleteNote(noteId);
        putData(nextData);
        if (activeNoteId === noteId) {
          setActiveNoteId(null);
        }
        onToast("Note deleted");
      } catch (error) {
        console.error(error);
        onToast("Note could not be deleted");
      }
    },
    [activeNoteId, onToast, putData, setActiveNoteId],
  );

  return { createProjectNote, saveNoteContent, deleteProjectNote };
}
