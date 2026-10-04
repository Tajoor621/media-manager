import { mimeFromName } from "./mime";
import type { DeviceEntry } from "./types";

type DirHandle = FileSystemDirectoryHandle & {
  entries: () => AsyncIterableIterator<[string, FileSystemHandle]>;
  queryPermission: (opts?: { mode?: "read" | "readwrite" }) => Promise<PermissionState>;
  requestPermission: (opts?: { mode?: "read" | "readwrite" }) => Promise<PermissionState>;
};

function picker(): ((opts?: { mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle>) | undefined {
  return (window as unknown as { showDirectoryPicker?: (opts?: { mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker;
}

export function hasFileSystemAccess(): boolean {
  return typeof window !== "undefined" && typeof picker() === "function";
}

export async function pickDirectory(): Promise<FileSystemDirectoryHandle | null> {
  const show = picker();
  if (!show) return null;
  try {
    return await show({ mode: "readwrite" });
  } catch {
    return null;
  }
}

export async function listDirectory(handle: FileSystemDirectoryHandle): Promise<DeviceEntry[]> {
  const dir = handle as DirHandle;
  const out: DeviceEntry[] = [];
  for await (const [name, entry] of dir.entries()) {
    if (entry.kind === "directory") {
      out.push({ name, kind: "folder", size: 0, mime: "inode/directory", lastModified: 0 });
    } else {
      const file = await (entry as FileSystemFileHandle).getFile();
      out.push({
        name,
        kind: "file",
        size: file.size,
        mime: file.type || mimeFromName(name),
        lastModified: file.lastModified,
      });
    }
  }
  out.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
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
  const q = await dir.queryPermission({ mode: "readwrite" });
  if (q === "granted") return true;
  const r = await dir.requestPermission({ mode: "readwrite" });
  return r === "granted";
}
