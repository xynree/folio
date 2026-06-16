import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { FileSaveStrategy, JsonSaveStrategy } from "./storage.manager";

describe("storage strategies", () => {
  it("writes JSON through a temporary file and leaves the final file readable", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "folio-json-"));
    const filePath = path.join(tempDir, "folio.json");

    await new JsonSaveStrategy().save(filePath, { version: 1, items: [] });

    expect(JSON.parse(await fs.readFile(filePath, "utf-8"))).toEqual({
      version: 1,
      items: [],
    });
    await expect(fs.stat(`${filePath}.tmp`)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("copies files and writes buffers through the file save strategy", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "folio-file-"));
    const sourcePath = path.join(tempDir, "source.txt");
    const copiedPath = path.join(tempDir, "copy.txt");
    const bufferPath = path.join(tempDir, "buffer.txt");
    const strategy = new FileSaveStrategy();

    await fs.writeFile(sourcePath, "from file");
    await strategy.save(copiedPath, { kind: "path", source: sourcePath });
    await strategy.save(bufferPath, {
      kind: "buffer",
      source: Buffer.from("from buffer"),
    });

    expect(await fs.readFile(copiedPath, "utf-8")).toBe("from file");
    expect(await fs.readFile(bufferPath, "utf-8")).toBe("from buffer");
  });
});
