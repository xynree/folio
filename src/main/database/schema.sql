-- Schema (DDL) applied once when the database is first opened via db.exec().
-- All statements use CREATE TABLE IF NOT EXISTS so re-running on an existing
-- database is a no-op. Adding new nullable or defaulted columns in a later
-- version is backwards-compatible.

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS items (
  id              TEXT PRIMARY KEY,
  path            TEXT NOT NULL,
  hash            TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'other',
  date            TEXT NOT NULL,
  title           TEXT NOT NULL DEFAULT '',
  description     TEXT NOT NULL DEFAULT '',
  tagIds          TEXT NOT NULL DEFAULT '[]',
  mediaWidth      INTEGER,
  mediaHeight     INTEGER,
  projectId       TEXT,
  stage           TEXT,
  sourceCreatedAt TEXT,
  updatedAt       TEXT,
  missing         INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tags (
  id   TEXT PRIMARY KEY,
  text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  status        TEXT,
  createdAt     TEXT NOT NULL,
  updatedAt     TEXT NOT NULL,
  workUpdatedAt TEXT,
  folderPath    TEXT NOT NULL,
  imageIds      TEXT NOT NULL DEFAULT '[]',
  workItemIds   TEXT NOT NULL DEFAULT '[]',
  boardIds      TEXT NOT NULL DEFAULT '[]',
  reviews       TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS canvases (
  id                  TEXT PRIMARY KEY,
  title               TEXT NOT NULL DEFAULT '',
  description         TEXT,
  color               TEXT,
  projectId           TEXT,
  kind                TEXT,
  status              TEXT,
  brief               TEXT,
  outcome             TEXT,
  startedAt           TEXT,
  targetDate          TEXT,
  completedAt         TEXT,
  createdAt           TEXT,
  updatedAt           TEXT,
  itemIds             TEXT NOT NULL DEFAULT '[]',
  positions           TEXT NOT NULL DEFAULT '{}',
  notes               TEXT NOT NULL DEFAULT '[]',
  edges               TEXT NOT NULL DEFAULT '[]',
  strokes             TEXT,
  texts               TEXT,
  sections            TEXT,
  links               TEXT,
  viewport            TEXT,
  createdFromTemplate TEXT
);
