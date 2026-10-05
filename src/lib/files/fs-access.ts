import { mimeFromName } from "./mime";
import type { DeviceEntry } from "./types";

export type WellKnownDir = "documents" | "downloads" | "pictures" | "videos" | "music";

type DirHandle = FileSystemDirectoryHandle & {
  entries: () => AsyncIterableIterator<[string, FileSystemHandle]>;
  values?: () => AsyncIterableIterator<FileSystemHandle>;
  queryPermission: (opts?: { mode?: "read" | "readwrite" }) => Promise<PermissionState>;
  requestPermission: (opts?: { mode?: "read" | "readwrite" }) => Promise<PermissionState>;
};

type PickerOpts = {
  id?: string;
  mode?: "read" | "readwrite";
  startIn?: WellKnownDir | FileSystemHandle;
};

function picker(): ((opts?: PickerOpts) => Promise<FileSystemDirectoryHandle>) | undefined {
  return (
    window as unknown as {
      showDirectoryPicker?: (opts?: PickerOpts) => Promise<FileSystemDirectoryHandle>;
    }
  ).showDirectoryPicker;
}

export function hasFileSystemAccess(): boolean {
  return typeof window !== "undefined" && typeof picker() === "function";
}

export function hasDirectoryInput(): boolean {
  if (typeof document === "undefined") return false;
  const el = document.createElement("input");
  return "webkitdirectory" in el;
}

async function iterateDir(dir: DirHandle): Promise<[string, FileSystemHandle][]> {
  const out: [string, FileSystemHandle][] = [];
  if (typeof dir.entries === "function") {
    for await (const pair of dir.entries()) out.push(pair);
    return out;
  }
  if (typeof dir.values === "function") {
    for await (const entry of dir.values()) out.push([entry.name, entry]);
  }
  return out;
}

export async function pickDirectory(
  startIn?: WellKnownDir,
): Promise<FileSystemDirectoryHandle | null> {
  const show = picker();
  if (!show) return null;
  const tryPick = async (mode: "read" | "readwrite") => {
    try {
      return await show({
        id: startIn ?? "media-manager-device",
        mode,
        startIn,
      });
    } catch {
      return null;
    }
  };
  return (await tryPick("readwrite")) ?? (await tryPick("read"));
}

export async function listDirectory(handle: FileSystemDirectoryHandle): Promise<DeviceEntry[]> {
  const dir = handle as DirHandle;
  const out: DeviceEntry[] = [];
  let pairs: [string, FileSystemHandle][] = [];
  try {
    pairs = await iterateDir(dir);
  } catch {
    return [];
  }
  for (const [name, entry] of pairs) {
    try {
      if (entry.kind === "directory") {
        out.push({
          name,
          path: name,
          kind: "folder",
          size: 0,
          mime: "inode/directory",
          lastModified: 0,
        });
      } else {
        const file = await (entry as FileSystemFileHandle).getFile();
        out.push({
          name,
          path: name,
          kind: "file",
          size: file.size,
          mime: file.type || mimeFromName(name),
          lastModified: file.lastModified,
        });
      }
    } catch {
      out.push({
        name,
        path: name,
        kind: entry.kind === "directory" ? "folder" : "file",
        size: 0,
        mime: entry.kind === "directory" ? "inode/directory" : mimeFromName(name),
        lastModified: 0,
      });
    }
  }
  return sortEntries(out);
}

export async function scanDirectory(
  handle: FileSystemDirectoryHandle,
  onProgress?: (info: { files: number; folders: number; bytes: number }) => void,
  signal?: { cancelled: boolean },
): Promise<{ files: number; folders: number; bytes: number }> {
  let files = 0;
  let folders = 0;
  let bytes = 0;
  let ticks = 0;

  const walk = async (dir: FileSystemDirectoryHandle) => {
    if (signal?.cancelled) return;
    let pairs: [string, FileSystemHandle][] = [];
    try {
      pairs = await iterateDir(dir as DirHandle);
    } catch {
      return;
    }
    for (const [, entry] of pairs) {
      if (signal?.cancelled) return;
      if (entry.kind === "directory") {
        folders += 1;
        try {
          await walk(entry as FileSystemDirectoryHandle);
        } catch {
          /* skip locked folders */
        }
      } else {
        files += 1;
        try {
          const file = await (entry as FileSystemFileHandle).getFile();
          bytes += file.size;
        } catch {
          /* placeholder / denied */
        }
      }
      ticks += 1;
      if (ticks % 40 === 0) onProgress?.({ files, folders, bytes });
    }
  };

  await walk(handle);
  onProgress?.({ files, folders, bytes });
  return { files, folders, bytes };
}

export async function collectDirectoryFiles(
  handle: FileSystemDirectoryHandle,
  cap = 400,
): Promise<File[]> {
  const out: File[] = [];
  const walk = async (dir: FileSystemDirectoryHandle) => {
    if (out.length >= cap) return;
    let pairs: [string, FileSystemHandle][] = [];
    try {
      pairs = await iterateDir(dir as DirHandle);
    } catch {
      return;
    }
    for (const [, entry] of pairs) {
      if (out.length >= cap) return;
      if (entry.kind === "directory") {
        await walk(entry as FileSystemDirectoryHandle);
      } else {
        try {
          out.push(await (entry as FileSystemFileHandle).getFile());
        } catch {
          /* skip */
        }
      }
    }
  };
  await walk(handle);
  return out;
}

export async function readDeviceFile(
  dir: FileSystemDirectoryHandle,
  name: string,
): Promise<File | null> {
  try {
    const handle = await dir.getFileHandle(name);
    return await handle.getFile();
  } catch {
    return null;
  }
}

export async function openDeviceSubdir(
  dir: FileSystemDirectoryHandle,
  name: string,
): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await dir.getDirectoryHandle(name);
  } catch {
    return null;
  }
}

export async function writeDeviceFile(
  dir: FileSystemDirectoryHandle,
  name: string,
  data: Blob,
): Promise<boolean> {
  try {
    const handle = await dir.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(data);
    await writable.close();
    return true;
  } catch {
    return false;
  }
}

export async function ensurePermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const dir = handle as DirHandle;
  try {
    const q = await dir.queryPermission?.({ mode: "readwrite" });
    if (q === "granted") return true;
    const r = await dir.requestPermission?.({ mode: "readwrite" });
    if (r === "granted") return true;
  } catch {
    /* read-only handles */
  }
  try {
    const q = await dir.queryPermission?.({ mode: "read" });
    if (q === "granted") return true;
    const r = await dir.requestPermission?.({ mode: "read" });
    return r === "granted";
  } catch {
    return false;
  }
}

function parentPath(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}

function sortEntries(out: DeviceEntry[]): DeviceEntry[] {
  return out.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

const deviceBag = new Map<string, File>();
let treeFiles: DeviceEntry[] = [];
let treeFolders: DeviceEntry[] = [];

export function clearDeviceTree() {
  deviceBag.clear();
  treeFiles = [];
  treeFolders = [];
}

export function getDeviceBagFile(path: string): File | undefined {
  return deviceBag.get(path);
}

export function filesUnderPath(path: string): File[] {
  const prefix = path ? `${path}/` : "";
  const out: File[] = [];
  for (const [p, file] of deviceBag) {
    if (!prefix || p.startsWith(prefix)) out.push(file);
  }
  return out;
}

export type DeviceTreeMount = {
  rootName: string;
  fileCount: number;
  totalBytes: number;
};

export function mountFileList(files: File[]): DeviceTreeMount {
  clearDeviceTree();
  const rels = files.map((f) => (f.webkitRelativePath || f.name).replace(/^\/+/, ""));
  const tops = rels.map((r) => r.split("/")[0]).filter(Boolean);
  let rootName = "Device";
  const sharedRoot =
    tops.length > 0 && tops.every((t) => t === tops[0]) && rels.some((r) => r.includes("/"));
  if (sharedRoot) rootName = tops[0];

  const folderSet = new Set<string>();
  let totalBytes = 0;

  for (let i = 0; i < files.length; i++) {
    let rel = rels[i];
    if (!rel) continue;
    if (sharedRoot && rel.startsWith(`${rootName}/`)) rel = rel.slice(rootName.length + 1);
    if (!rel) continue;
    const file = files[i];
    deviceBag.set(rel, file);
    totalBytes += file.size;
    const parts = rel.split("/").filter(Boolean);
    for (let d = 1; d < parts.length; d++) folderSet.add(parts.slice(0, d).join("/"));
    treeFiles.push({
      name: parts[parts.length - 1] ?? file.name,
      path: rel,
      kind: "file",
      size: file.size,
      mime: file.type || mimeFromName(file.name),
      lastModified: file.lastModified,
    });
  }

  treeFolders = [...folderSet].map((path) => ({
    name: path.slice(path.lastIndexOf("/") + 1),
    path,
    kind: "folder" as const,
    size: 0,
    mime: "inode/directory",
    lastModified: 0,
  }));

  return { rootName, fileCount: treeFiles.length, totalBytes };
}

export function listTreePath(path: string): DeviceEntry[] {
  const depth = path ? path.split("/").length : 0;
  const folders = treeFolders.filter((f) => {
    if (path) return f.path.startsWith(`${path}/`) && f.path.split("/").length === depth + 1;
    return !f.path.includes("/");
  });
  const files = treeFiles.filter((f) => parentPath(f.path) === path);
  return sortEntries([...folders, ...files]);
}

export function searchTree(query: string, limit = 80): DeviceEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return treeFiles.filter((f) => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q)).slice(0, limit);
}

export function treeParent(path: string): string {
  return parentPath(path);
}
