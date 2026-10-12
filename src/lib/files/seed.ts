import { deleteNode, putNodes, setMeta, getMeta } from "./idb";
import { FOLDER_IDS, ROOT_ID, TRASH_ID, type FileNode } from "./types";

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
    bookmark: false,
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

const SAMPLE_IDS = [
  "file-logo",
  "file-dunes",
  "file-harbor",
  "file-atrium",
  "file-orbit",
  "file-reel",
  "file-wav",
  "file-welcome",
  "file-pdf",
  "file-json",
  "file-ts",
  "file-zip",
  "file-db",
];

export async function seedLibrary(): Promise<FileNode[]> {
  const nodes = folderTree();
  await putNodes(nodes);
  await setMeta("seeded", 6);
  await setMeta("recents", []);
  return nodes;
}

const SAMPLE_IDS_SET = new Set(SAMPLE_IDS);

/** Drop the old demo files so a phone that already opened the app starts empty. */
export async function ensureLatestSamples(existing: FileNode[]): Promise<FileNode[]> {
  const ver = (await getMeta<number>("seeded")) ?? 0;
  const hasSamples = existing.some((n) => SAMPLE_IDS_SET.has(n.id));
  if (ver >= 6 && !hasSamples) return existing;

  for (const id of SAMPLE_IDS) {
    if (existing.some((n) => n.id === id)) await deleteNode(id);
  }

  const now = Date.now();
  const byId = new Map(existing.filter((n) => !SAMPLE_IDS_SET.has(n.id)).map((n) => [n.id, n]));
  const updates: FileNode[] = [];
  for (const folderNode of folderTree(now)) {
    const cur = byId.get(folderNode.id);
    if (!cur) {
      byId.set(folderNode.id, folderNode);
      updates.push(folderNode);
    } else if (cur.bookmark) {
      const next = { ...cur, bookmark: false };
      byId.set(folderNode.id, next);
      updates.push(next);
    }
  }
  if (updates.length) await putNodes(updates);

  const recents = ((await getMeta<string[]>("recents")) ?? []).filter((id) => byId.has(id) && !SAMPLE_IDS_SET.has(id));
  await setMeta("recents", recents);
  await setMeta("seeded", 6);
  return [...byId.values()];
}

