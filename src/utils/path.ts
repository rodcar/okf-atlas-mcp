import path from "node:path";

export function toPosixPath(value: string): string {
  return value.split(path.sep).join("/");
}

export function stripMarkdownExtension(value: string): string {
  return value.replace(/\.md$/i, "");
}

export function normalizeConceptPath(value: string): string {
  return stripMarkdownExtension(toPosixPath(value).replace(/^\/+/, "")).replace(/\/+/g, "/");
}

export function isReservedMarkdownFile(relativePath: string): boolean {
  const base = path.posix.basename(toPosixPath(relativePath)).toLowerCase();
  return base === "index.md" || base === "log.md";
}

export function bundleIdFromPath(bundlePath: string): string {
  return path.basename(bundlePath);
}
