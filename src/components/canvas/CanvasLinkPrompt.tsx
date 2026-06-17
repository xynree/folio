import React, { useEffect, useRef, useState } from "react";
import { Link as LinkIcon, X } from "lucide-react";
import { ButtonIcon } from "../shared/ButtonIcon";

export function CanvasLinkPrompt({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (url: string) => boolean;
}) {
  const [url, setUrl] = useState("");
  const [hasError, setHasError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;
    if (!onSubmit(trimmedUrl)) {
      setHasError(true);
    }
  };

  return (
    <div
      className="canvas-link-prompt-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className="canvas-link-prompt" role="dialog" aria-label="Add a link">
        <div className="canvas-link-prompt-header">
          <span>
            <ButtonIcon icon={LinkIcon} size={14} />
            Add a link
          </span>
          <button
            className="icon-button"
            type="button"
            aria-label="Cancel adding link"
            title="Cancel"
            onClick={onCancel}
          >
            <ButtonIcon icon={X} />
          </button>
        </div>
        <input
          ref={inputRef}
          aria-label="Link URL"
          placeholder="https://example.com"
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
            if (hasError) setHasError(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            } else if (event.key === "Escape") {
              event.preventDefault();
              onCancel();
            }
          }}
        />
        {hasError ? (
          <p className="canvas-link-prompt-error" role="alert">
            Enter a valid web link.
          </p>
        ) : null}
        <div className="canvas-link-prompt-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="canvas-link-prompt-submit"
            type="button"
            onClick={submit}
            disabled={!url.trim()}
          >
            Add link
          </button>
        </div>
      </div>
    </div>
  );
}
