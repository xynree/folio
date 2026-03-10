// Discriminated union for the two ways a user can import a file.
// "path" = drag & drop or file picker; "buffer" = clipboard paste.
export type ImportSource =
  | { kind: "path"; filePath: string }
  | { kind: "buffer"; data: Buffer; ext: string; filename?: string };
