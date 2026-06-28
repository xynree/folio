import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FolioDB } from ".";
import {
  makeCanvas,
  makeData,
  makeItem,
  makeNote,
  makeProject,
} from "../../test/fixtures";

describe("FolioDB", () => {
  let db: FolioDB;
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "folio-db-"));
    db = new FolioDB(path.join(dir, "folio.db"));
  });

  afterEach(async () => {
    db.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // Items
  // -------------------------------------------------------------------------

  it("starts with empty collections", () => {
    expect(db.getItems()).toEqual([]);
    expect(db.getTags()).toEqual([]);
    expect(db.getProjects()).toEqual([]);
    expect(db.getCanvases()).toEqual([]);
  });

  it("round-trips an item through upsert and getItems", () => {
    const item = makeItem("alpha", {
      path: "projects/color-study/images/alpha.png",
      tagIds: ["tag-1", "tag-2"],
      description: "A test item",
      mediaWidth: 1920,
      mediaHeight: 1080,
    });

    db.upsertItem(item);

    const items = db.getItems();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: item.id,
      path: item.path,
      tagIds: ["tag-1", "tag-2"],
      description: "A test item",
      mediaWidth: 1920,
      mediaHeight: 1080,
    });
    expect(items[0].missing).toBeFalsy();
  });

  it("upsert overwrites an existing item row", () => {
    const item = makeItem("alpha", { path: "projects/p/images/alpha.png" });
    db.upsertItem(item);
    db.upsertItem({ ...item, title: "Updated title" });

    const items = db.getItems();
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Updated title");
  });

  it("setItems replaces the full items collection atomically", () => {
    const first = makeItem("alpha", { path: "projects/p/images/alpha.png" });
    const second = makeItem("bravo", { path: "projects/p/images/bravo.png" });
    db.setItems([first]);
    db.setItems([second]);

    const items = db.getItems();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(second.id);
  });

  it("deleteItems removes only the specified rows", () => {
    const alpha = makeItem("alpha", { path: "projects/p/images/alpha.png" });
    const bravo = makeItem("bravo", { path: "projects/p/images/bravo.png" });
    db.setItems([alpha, bravo]);
    db.deleteItems([alpha.id]);

    const items = db.getItems();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(bravo.id);
  });

  // -------------------------------------------------------------------------
  // Tags
  // -------------------------------------------------------------------------

  it("round-trips tags through setTags and getTags", () => {
    const tags = [
      { id: "t1", text: "sketches" },
      { id: "t2", text: "wip" },
    ];
    db.setTags(tags);

    expect(db.getTags()).toEqual(expect.arrayContaining(tags));
    expect(db.getTags()).toHaveLength(2);
  });

  it("setTags deletes removed tags", () => {
    db.setTags([
      { id: "t1", text: "sketches" },
      { id: "t2", text: "wip" },
    ]);
    db.setTags([{ id: "t2", text: "wip" }]);

    expect(db.getTags()).toHaveLength(1);
    expect(db.getTags()[0].id).toBe("t2");
  });

  // -------------------------------------------------------------------------
  // Projects
  // -------------------------------------------------------------------------

  it("round-trips a project with nested JSON fields", () => {
    const project = makeProject("proj-1", {
      title: "Color Study",
      description: "A recurring color practice",
      imageIds: ["img-1", "img-2"],
      reviews: [
        {
          id: "r1",
          title: "Week 1",
          markdown: "# Week 1",
          workItemIds: [],
          createdAt: "2026-06-01T00:00:00.000Z",
          updatedAt: "2026-06-01T00:00:00.000Z",
        },
      ],
    });

    db.upsertProject(project);

    const projects = db.getProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0].title).toBe("Color Study");
    expect(projects[0].description).toBe("A recurring color practice");
    expect(projects[0].imageIds).toEqual(["img-1", "img-2"]);
    expect(projects[0].reviews).toHaveLength(1);
    expect(projects[0].reviews[0].title).toBe("Week 1");
  });

  // -------------------------------------------------------------------------
  // Canvases
  // -------------------------------------------------------------------------

  it("round-trips a canvas with positions, notes, and edges", () => {
    const canvas = makeCanvas("c1", {
      title: "Moodboard",
      itemIds: ["item-1"],
      positions: { "item-1": { x: 100, y: 200, width: 300, height: 400 } },
      notes: [{ id: "n1", text: "A thought", x: 10, y: 20 }],
      edges: [{ id: "e1", fromId: "item-1", toId: "n1" }],
    });

    db.upsertCanvas(canvas);

    const canvases = db.getCanvases();
    expect(canvases).toHaveLength(1);
    expect(canvases[0].title).toBe("Moodboard");
    expect(canvases[0].positions["item-1"]).toMatchObject({ x: 100, y: 200 });
    expect(canvases[0].notes[0].text).toBe("A thought");
    expect(canvases[0].edges[0].fromId).toBe("item-1");
  });

  it("round-trips project note references on a canvas", () => {
    const canvas = makeCanvas("c1", {
      title: "Notes board",
      noteIds: ["note-1", "note-2"],
      positions: {
        "note-1": { x: 80, y: 90 },
        "note-2": { x: 270, y: 90 },
      },
    });

    db.upsertCanvas(canvas);

    const [stored] = db.getCanvases();
    expect(stored.noteIds).toEqual(["note-1", "note-2"]);
    expect(stored.positions["note-1"]).toMatchObject({ x: 80, y: 90 });
  });

  // -------------------------------------------------------------------------
  // setFolioData — atomic bulk write
  // -------------------------------------------------------------------------

  it("setFolioData replaces all four collections in one transaction", () => {
    const data = makeData({
      items: [makeItem("alpha", { path: "projects/p/images/alpha.png" })],
      tags: [{ id: "t1", text: "sketches" }],
      projects: [makeProject("proj-1", { title: "Study" })],
      canvases: [makeCanvas("c1", { title: "Board" })],
    });

    db.setFolioData(data);

    expect(db.getItems()).toHaveLength(1);
    expect(db.getTags()).toHaveLength(1);
    expect(db.getProjects()).toHaveLength(1);
    expect(db.getCanvases()).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // isEmpty + importFromFolioData (migration path)
  // -------------------------------------------------------------------------

  it("isEmpty returns true on a fresh database", () => {
    expect(db.isEmpty()).toBe(true);
  });

  it("isEmpty returns false once data is inserted", () => {
    db.upsertTag({ id: "t1", text: "sketches" });
    expect(db.isEmpty()).toBe(false);
  });

  it("importFromFolioData seeds a new database from a FolioData snapshot", () => {
    const snapshot = makeData({
      items: [makeItem("alpha", { path: "projects/p/images/alpha.png" })],
      tags: [{ id: "t1", text: "inspiration" }],
      projects: [makeProject("proj-1", { title: "Portfolio" })],
      canvases: [makeCanvas("c1", { title: "Vision board" })],
    });

    db.importFromFolioData(snapshot);

    expect(db.getItems()).toHaveLength(1);
    expect(db.getTags()[0].text).toBe("inspiration");
    expect(db.getProjects()[0].title).toBe("Portfolio");
    expect(db.getCanvases()[0].title).toBe("Vision board");
  });

  // -------------------------------------------------------------------------
  // Notes
  // -------------------------------------------------------------------------

  it("round-trips a note through upsert and getNotes", () => {
    db.upsertNote(makeNote("note-1", { title: "Ideas", projectId: "proj-1" }));

    const notes = db.getNotes();
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({
      id: "note-1",
      title: "Ideas",
      projectId: "proj-1",
      path: "projects/studio-archive/notes/note-1.md",
    });
  });

  it("setNotes replaces the notes collection and deleteNote removes one", () => {
    db.setNotes([makeNote("note-1"), makeNote("note-2")]);
    expect(db.getNotes()).toHaveLength(2);

    db.setNotes([makeNote("note-2", { title: "Kept" })]);
    const remaining = db.getNotes();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].title).toBe("Kept");

    db.deleteNote("note-2");
    expect(db.getNotes()).toHaveLength(0);
  });

  it("getFolioData and setFolioData include notes", () => {
    db.setFolioData(
      makeData({
        notes: [makeNote("note-1", { title: "Captured" })],
      }),
    );

    expect(db.getNotes()).toHaveLength(1);
    expect(db.getFolioData().notes[0].title).toBe("Captured");
  });

  // -------------------------------------------------------------------------
  // In-memory database (useful in tests where no temp dir is needed)
  // -------------------------------------------------------------------------

  it("supports :memory: databases", () => {
    const memDb = new FolioDB(":memory:");
    expect(memDb.isEmpty()).toBe(true);
    memDb.upsertTag({ id: "t1", text: "test" });
    expect(memDb.getTags()).toHaveLength(1);
    memDb.close();
  });
});
