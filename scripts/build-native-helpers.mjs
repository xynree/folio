import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const projectRoot = path.resolve(new URL("..", import.meta.url).pathname);
const source = path.join(
  projectRoot,
  "native",
  "FolioPhotosPicker",
  "FolioPhotosPicker.swift",
);
const outputDirectory = path.join(projectRoot, "resources", "native");
const output = path.join(outputDirectory, "FolioPhotosPicker");

if (process.platform !== "darwin") {
  console.log("Skipping macOS native helper build on non-macOS platform.");
  process.exit(0);
}

const targetArch = process.arch === "arm64" ? "arm64" : "x86_64";
const moduleCache = path.join(os.tmpdir(), "folio-swift-module-cache");

fs.mkdirSync(outputDirectory, { recursive: true });
fs.mkdirSync(moduleCache, { recursive: true });

const result = spawnSync(
  "xcrun",
  [
    "swiftc",
    "-target",
    `${targetArch}-apple-macosx14.0`,
    "-module-cache-path",
    moduleCache,
    source,
    "-framework",
    "AppKit",
    "-framework",
    "PhotosUI",
    "-framework",
    "Photos",
    "-framework",
    "UniformTypeIdentifiers",
    "-o",
    output,
  ],
  { stdio: "inherit" },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

fs.chmodSync(output, 0o755);
console.log(`Built native helper: ${path.relative(projectRoot, output)}`);
