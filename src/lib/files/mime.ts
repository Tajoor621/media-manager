import type { ViewerKind } from "./types";

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  ico: "image/x-icon",
  avif: "image/avif",
  mp4: "video/mp4",
  webm: "video/webm",
  ogv: "video/ogg",
  mov: "video/quicktime",
  mkv: "video/x-matroska",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  flac: "audio/flac",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  pdf: "application/pdf",
  zip: "application/zip",
  rar: "application/vnd.rar",
  "7z": "application/x-7z-compressed",
  json: "application/json",
  md: "text/markdown",
  markdown: "text/markdown",
  txt: "text/plain",
  csv: "text/csv",
  xml: "text/xml",
  html: "text/html",
  css: "text/css",
  ts: "text/typescript",
  tsx: "text/tsx",
  js: "text/javascript",
  jsx: "text/jsx",
  mjs: "text/javascript",
  py: "text/x-python",
  rs: "text/x-rust",
  go: "text/x-go",
  sh: "text/x-sh",
  yml: "text/yaml",
  yaml: "text/yaml",
  db: "application/x-sqlite3",
  sqlite: "application/x-sqlite3",
  sqlite3: "application/x-sqlite3",
  vtt: "text/vtt",
  srt: "application/x-subrip",
  bin: "application/octet-stream",
  hex: "application/octet-stream",
};

export function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

export function mimeFromName(name: string, fallback = "application/octet-stream"): string {
  return EXT_MIME[extOf(name)] ?? fallback;
}

export function isTextMime(mime: string, name: string): boolean {
  if (mime.startsWith("text/")) return true;
  return [
    "application/json",
    "application/xml",
    "application/javascript",
    "text/typescript",
    "text/tsx",
    "text/jsx",
    "text/yaml",
    "text/x-python",
    "text/x-rust",
    "text/x-go",
    "text/x-sh",
    "text/vtt",
    "application/x-subrip",
  ].includes(mime) || ["json", "md", "ts", "tsx", "js", "jsx", "css", "html", "svg", "xml", "yml", "yaml", "py", "rs", "go", "sh", "csv", "vtt", "srt"].includes(extOf(name));
}

export function viewerKind(mime: string, name: string): ViewerKind {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf" || extOf(name) === "pdf") return "pdf";
  if (["zip", "rar", "7z"].includes(extOf(name)) || mime.includes("zip") || mime.includes("compressed")) {
    return "archive";
  }
  if (mime.includes("sqlite") || ["db", "sqlite", "sqlite3"].includes(extOf(name))) return "sqlite";
  if (isTextMime(mime, name)) return "text";
  return "hex";
}

export function canPreview(mime: string, name: string): boolean {
  return viewerKind(mime, name) !== "hex" || mime === "application/octet-stream";
}
