import { publicUrl } from "@/lib/public-url";
import { mimeFromName } from "./mime";
import { putBlob, putNodes, setMeta, getMeta } from "./idb";
import { FOLDER_IDS, ROOT_ID, TRASH_ID, type FileNode } from "./types";
async function fetchBuf(path: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

async function fetchSize(path: string): Promise<number> {
  try {
    const res = await fetch(path, { method: "HEAD" });
    if (!res.ok) return 0;
    return Number(res.headers.get("content-length") ?? 0);
  } catch {
    return 0;
  }
}

function folder(id: string, parentId: string, name: string, now: number): FileNode {
  return {
    id,
    parentId,
    name,
    kind: "folder",
    mime: "inode/directory",
    size: 0,
    createdAt: now,
    updatedAt: now,
    favorite: false,
    bookmark: id === FOLDER_IDS.photos || id === FOLDER_IDS.documents,
  };
}

function fileNode(
  id: string,
  parentId: string,
  name: string,
  size: number,
  now: number,
  extra?: Partial<FileNode>,
): FileNode {
  return {
    id,
    parentId,
    name,
    kind: "file",
    mime: mimeFromName(name),
    size,
    createdAt: now,
    updatedAt: now,
    favorite: false,
    bookmark: false,
    ...extra,
  };
}

export function folderTree(now = Date.now()): FileNode[] {
  return [
    folder(ROOT_ID, ROOT_ID, "Library", now),
    folder(TRASH_ID, TRASH_ID, "Trash", now),
    folder(FOLDER_IDS.photos, ROOT_ID, "Photos", now),
    folder(FOLDER_IDS.videos, ROOT_ID, "Videos", now),
    folder(FOLDER_IDS.music, ROOT_ID, "Music", now),
    folder(FOLDER_IDS.documents, ROOT_ID, "Documents", now),
    folder(FOLDER_IDS.downloads, ROOT_ID, "Downloads", now),
    folder(FOLDER_IDS.archives, ROOT_ID, "Archives", now),
    folder(FOLDER_IDS.projects, ROOT_ID, "Projects", now),
  ];
}

type Asset = {
  id: string;
  parent: string;
  name: string;
  path: string;
  favorite?: boolean;
  lazy?: boolean;
};

const ASSETS: Asset[] = [
  { id: "file-logo", parent: FOLDER_IDS.photos, name: "621 Media Manager.jpg", path: "/brand/logo.jpg", favorite: true },
  { id: "file-dunes", parent: FOLDER_IDS.photos, name: "Dunes at Dusk.jpg", path: "/samples/dunes.jpg", favorite: true },
  { id: "file-harbor", parent: FOLDER_IDS.photos, name: "Harbor Lights.jpg", path: "/samples/harbor.jpg" },
  { id: "file-atrium", parent: FOLDER_IDS.photos, name: "Private Atrium.jpg", path: "/samples/atrium.jpg" },
  { id: "file-orbit", parent: FOLDER_IDS.videos, name: "Studio Orbit.mp4", path: "/samples/studio-orbit.mp4", favorite: true, lazy: true },
  { id: "file-reel", parent: FOLDER_IDS.videos, name: "Gold Reel.mp4", path: "/samples/gold-reel.mp4", lazy: true },
  { id: "file-wav", parent: FOLDER_IDS.music, name: "Gold Standard.wav", path: "/samples/gold-standard.wav", favorite: true },
  { id: "file-welcome", parent: FOLDER_IDS.documents, name: "Welcome.md", path: "/samples/welcome.md", favorite: true },
  { id: "file-pdf", parent: FOLDER_IDS.documents, name: "Briefing.pdf", path: "/samples/briefing.pdf" },
  { id: "file-json", parent: FOLDER_IDS.documents, name: "manifest.json", path: "/samples/manifest.json" },
  { id: "file-ts", parent: FOLDER_IDS.projects, name: "routes.ts", path: "/samples/routes.ts" },
  { id: "file-zip", parent: FOLDER_IDS.archives, name: "briefing-pack.zip", path: "/samples/briefing-pack.zip" },
  { id: "file-db", parent: FOLDER_IDS.projects, name: "library.db", path: "/samples/library.db" },
];

export async function seedLibrary(): Promise<FileNode[]> {
  const now = Date.now();
  const nodes: FileNode[] = folderTree(now);

  const loaded = await Promise.all(
    ASSETS.map(async (a) => {
      if (a.lazy) {
        const size = await fetchSize(publicUrl(a.path));
        return { a, buf: null as ArrayBuffer | null, size };
      }
      const buf = await fetchBuf(publicUrl(a.path));
      return buf ? { a, buf, size: buf.byteLength } : null;
    }),
  );

  await Promise.all(
    loaded.map(async (row) => {
      if (!row) return;
      const { a, buf, size } = row;
      const node = fileNode(a.id, a.parent, a.name, size, now, {
        favorite: a.favorite,
        source: a.lazy ? publicUrl(a.path) : undefined,
      });
      nodes.push(node);
      if (buf && !node.source) await putBlob(a.id, buf, mimeFromName(a.name));
    }),
  );

  await putNodes(nodes);
  await setMeta("seeded", 5);
  await setMeta("recents", ["file-logo", "file-orbit", "file-welcome", "file-dunes", "file-wav"]);
  return nodes;
}

export async function ensureLatestSamples(existing: FileNode[]): Promise<FileNode[]> {
  const now = Date.now();
  const byId = new Map(existing.map((n) => [n.id, n]));
  const added: FileNode[] = [];
  const updates: FileNode[] = [];

  await Promise.all(
    ASSETS.map(async (a) => {
      const n = byId.get(a.id);
      if (!n) {
        if (a.lazy) {
          const size = await fetchSize(publicUrl(a.path));
          added.push(
            fileNode(a.id, a.parent, a.name, size, now, {
              favorite: a.favorite,
              source: publicUrl(a.path),
            }),
          );
        } else {
          const buf = await fetchBuf(publicUrl(a.path));
          if (!buf) return;
          added.push(
            fileNode(a.id, a.parent, a.name, buf.byteLength, now, {
              favorite: a.favorite,
            }),
          );
          await putBlob(a.id, buf, mimeFromName(a.name));
        }
        return;
      }
      if (n.parentId !== a.parent || n.name !== a.name) {
        updates.push({ ...n, parentId: a.parent, name: a.name });
      }
    }),
  );

  const root = byId.get(ROOT_ID);
  if (root && root.name !== "Library") {
    updates.push({ ...root, name: "Library" });
  }

  const ver = (await getMeta<number>("seeded")) ?? 0;
  if (ver < 5) {
    const buf = await fetchBuf(publicUrl("samples/welcome.md"));
    const welcome = byId.get("file-welcome");
    if (buf && welcome) {
      await putBlob("file-welcome", buf, mimeFromName(welcome.name));
      updates.push({ ...welcome, size: buf.byteLength, updatedAt: now });
    }
  }

  await setMeta("seeded", 5);
  if (!added.length && !updates.length) return existing;
  const next = new Map(existing.map((n) => [n.id, n]));
  for (const u of updates) next.set(u.id, u);
  for (const a of added) next.set(a.id, a);
  const list = [...next.values()];
  await putNodes([...updates, ...added]);
  if (added.some((a) => a.id === "file-logo")) {
    const recents = (await getMeta<string[]>("recents")) ?? [];
    await setMeta(
      "recents",
      ["file-logo", ...recents.filter((id) => id !== "file-logo")].slice(0, 40),
    );
  }
  return list;
}
