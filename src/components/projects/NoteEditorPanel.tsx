import React, { useEffect, useRef, useState } from "react";
import MDEditor from "@uiw/react-md-editor";
import {
  codeEdit,
  codeLive,
  codePreview,
  type ICommand,
} from "@uiw/react-md-editor/commands";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";
import { LayoutGrid, Trash2 } from "lucide-react";
import type { Note } from "../../types";
import { formatReviewTimestamp } from "../folio/dates";
import { ButtonIcon } from "../shared/ButtonIcon";

const AUTOSAVE_DELAY_MS = 600;

// Only the edit / live / preview view toggles. The library's default toolbar
// also injects a fullscreen command, which we intentionally leave out.
const EDITOR_VIEW_COMMANDS: ICommand[] = [codeEdit, codeLive, codePreview];

export function NoteEditorPanel({
  note,
  onSaveContent,
  onDelete,
  onAddToBoard,
}: {
  note: Note;
  onSaveContent: (noteId: string, content: string) => void;
  onDelete: (noteId: string) => void;
  onAddToBoard?: (noteId: string) => void;
}) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  // Tracks the content known to be on disk so autosave skips no-op writes and
  // the freshly loaded value of a newly opened note never triggers a save.
  const savedContentRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    savedContentRef.current = null;

    window.folio
      .readNoteContent(note.id)
      .then((loadedContent) => {
        if (cancelled) return;
        savedContentRef.current = loadedContent;
        setContent(loadedContent);
      })
      .catch((error) => {
        console.error(error);
        if (cancelled) return;
        savedContentRef.current = "";
        setContent("");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [note.id]);

  useEffect(() => {
    if (loading) return undefined;
    if (savedContentRef.current === null) return undefined;
    if (content === savedContentRef.current) return undefined;

    const timeout = window.setTimeout(() => {
      savedContentRef.current = content;
      onSaveContent(note.id, content);
    }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [content, loading, note.id, onSaveContent]);

  const deleteNote = () => {
    const confirmed = window.confirm(`Delete "${note.title}"?`);
    if (!confirmed) return;
    onDelete(note.id);
  };

  return (
    <section className="note-editor-panel" aria-label="Note editor">
      <header className="note-editor-header">
        <div className="note-editor-heading">
          <h3>{note.title}</h3>
          <span>Updated {formatReviewTimestamp(note.updatedAt)}</span>
        </div>
        <div className="note-editor-actions">
          {onAddToBoard ? (
            <button
              className="secondary-action"
              type="button"
              onClick={() => onAddToBoard(note.id)}
            >
              <ButtonIcon icon={LayoutGrid} />
              Add to board
            </button>
          ) : null}
          <button
            className="secondary-action"
            type="button"
            onClick={deleteNote}
          >
            <ButtonIcon icon={Trash2} />
            Delete
          </button>
        </div>
      </header>

      <div className="note-editor-body project-markdown-editor" data-color-mode="light">
        {loading ? (
          <p className="note-editor-loading">Loading note…</p>
        ) : (
          <MDEditor
            extraCommands={EDITOR_VIEW_COMMANDS}
            height={520}
            preview="live"
            value={content}
            onChange={(value) => setContent(value ?? "")}
          />
        )}
      </div>
    </section>
  );
}
