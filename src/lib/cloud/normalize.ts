import type { DriveItem } from "@/lib/files/types";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function asArray(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  const rec = asRecord(v);
  if (!rec) return [];
  for (const key of ["files", "items", "results", "documents", "children"]) {
    if (Array.isArray(rec[key])) return rec[key] as unknown[];
  }
  if (rec.data) return asArray(rec.data);
  return [];
}

export function normalizeDriveItems(data: unknown): DriveItem[] {
  return asArray(data)
    .map((raw) => {
      const r = asRecord(raw);
      if (!r) return null;
      const mime = String(r.mimeType ?? r.mime_type ?? r.mime ?? "");
      const isFolder =
        mime.includes("folder") ||
        r.isFolder === true ||
        r.kind === "folder" ||
        r.type === "folder";
      const id = String(r.id ?? r.fileId ?? r.file_id ?? "");
      const name = String(r.name ?? r.title ?? "Untitled");
      if (!id) return null;
      const sizeRaw = r.size ?? r.sizeBytes ?? 0;
      const size = typeof sizeRaw === "number" ? sizeRaw : Number(sizeRaw) || 0;
      return { id, name, mimeType: mime || (isFolder ? "application/vnd.google-apps.folder" : "application/octet-stream"), isFolder, size };
    })
    .filter((x): x is DriveItem => x !== null);
}

export function driveFileText(data: unknown): string | null {
  if (typeof data === "string") return data;
  const rec = asRecord(data);
  if (!rec) return null;
  if (typeof rec.content === "string") return rec.content;
  if (typeof rec.text === "string") return rec.text;
  if (typeof rec.body === "string") return rec.body;
  return null;
}

export function driveFileBase64(data: unknown): string | null {
  const rec = asRecord(data);
  if (!rec) return null;
  if (typeof rec.base64 === "string") return rec.base64;
  if (typeof rec.data === "string" && rec.encoding === "base64") return rec.data;
  return null;
}
