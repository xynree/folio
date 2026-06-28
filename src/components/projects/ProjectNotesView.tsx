import React from "react";
import { FileText, Plus } from "lucide-react";
import type { Note } from "../../types";
import { formatReviewTimestamp } from "../folio/dates";
import { ButtonIcon } from "../shared/ButtonIcon";
import { NoteEditorPanel } from "./NoteEditorPanel";

export function ProjectNotesView({
  notes,
  activeNoteId,
  onCreateNote,
  onOpenNote,
  onSaveNoteContent,
  onDeleteNote,
  onAddNoteToBoard,
}: {
  notes: Note[];
  activeNoteId: string | null;
  onCreateNote: () => void;
  onOpenNote: (noteId: string) => void;
  onSaveNoteContent: (noteId: string, content: string) => void;
  onDeleteNote: (noteId: string) => void;
  onAddNoteToBoard?: (noteId: string) => void;
}) {
  const activeNote =
    notes.find((note) => note.id === activeNoteId) ?? null;

  return (
    <section className="project-notes" aria-label="Project notes">
      <aside className="project-notes-list" aria-label="Notes">
        <header className="project-notes-list-header">
          <div className="project-notes-list-heading">
            <ButtonIcon icon={FileText} size={14} />
            <span>Notes</span>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="New note"
            title="New note"
            onClick={onCreateNote}
          >
            <ButtonIcon icon={Plus} />
          </button>
        </header>

        <div className="project-notes-list-scroll">
          {notes.length ? (
            notes.map((note) => (
              <button
                key={note.id}
                type="button"
                className={`project-notes-list-item ${
                  note.id === activeNoteId ? "active" : ""
                }`}
                aria-pressed={note.id === activeNoteId}
                onClick={() => onOpenNote(note.id)}
              >
                <strong>{note.title}</strong>
                <span>{formatReviewTimestamp(note.updatedAt)}</span>
              </button>
            ))
          ) : (
            <div className="project-notes-empty">No notes yet</div>
          )}
        </div>
      </aside>

      <div className="project-notes-detail">
        {activeNote ? (
          <NoteEditorPanel
            key={activeNote.id}
            note={activeNote}
            onSaveContent={onSaveNoteContent}
            onDelete={onDeleteNote}
            onAddToBoard={onAddNoteToBoard}
          />
        ) : (
          <div className="project-notes-placeholder">
            <p>Select a note to start editing, or create a new one.</p>
          </div>
        )}
      </div>
    </section>
  );
}
