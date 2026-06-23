import React, { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { ButtonIcon } from "../shared/ButtonIcon";

/**
 * Modal for creating a new project. Collects a name and an optional description, matching the
 * low-friction capture goal: only the name is required, and the description can be filled in later
 * from the project itself.
 */
export function CreateProjectDialog({
  busy,
  onClose,
  onCreate,
}: {
  busy: boolean;
  onClose: () => void;
  onCreate: (title: string, description: string) => Promise<void> | void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => titleInputRef.current?.focus(), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const canSubmit = !busy && title.trim().length > 0;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    await onCreate(title.trim(), description.trim());
  };

  return (
    <div
      className="project-create-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <form
        className="project-create-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Create project"
        onSubmit={submit}
      >
        <div className="project-create-header">
          <strong>New project</strong>
          <button
            className="icon-button project-create-close"
            type="button"
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            <ButtonIcon icon={X} />
          </button>
        </div>

        <label className="project-create-field">
          <span>Project name</span>
          <input
            ref={titleInputRef}
            value={title}
            placeholder="New project"
            onChange={(event) => setTitle(event.currentTarget.value)}
          />
        </label>

        <label className="project-create-field">
          <span>Description</span>
          <textarea
            value={description}
            placeholder="What is this project about? (optional)"
            rows={4}
            onChange={(event) => setDescription(event.currentTarget.value)}
          />
        </label>

        <div className="project-create-actions">
          <button
            className="secondary-action"
            type="button"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button className="primary-action" type="submit" disabled={!canSubmit}>
            <ButtonIcon icon={Plus} />
            Create
          </button>
        </div>
      </form>
    </div>
  );
}
