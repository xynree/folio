import { describe, expect, it } from "vitest";
import { deriveNoteTitle } from "./note.helpers";

describe("deriveNoteTitle", () => {
  it("uses the first Markdown heading when present", () => {
    expect(deriveNoteTitle("# Research notes\n\nbody", "Fallback")).toBe(
      "Research notes",
    );
  });

  it("strips trailing heading hashes and surrounding whitespace", () => {
    expect(deriveNoteTitle("##   Sketch ideas  ##", "Fallback")).toBe(
      "Sketch ideas",
    );
  });

  it("falls back to the first non-empty line when there is no heading", () => {
    expect(deriveNoteTitle("\n\nA plain first line\nmore", "Fallback")).toBe(
      "A plain first line",
    );
  });

  it("returns the fallback title when the content is blank", () => {
    expect(deriveNoteTitle("\n   \n", "Existing title")).toBe("Existing title");
  });

  it("returns a default when both content and fallback are empty", () => {
    expect(deriveNoteTitle("", "   ")).toBe("Untitled note");
  });

  it("truncates very long titles", () => {
    const longTitle = "a".repeat(200);
    expect(deriveNoteTitle(`# ${longTitle}`, "Fallback")).toHaveLength(120);
  });
});
