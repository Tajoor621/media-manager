import { TRASH_ID, type FileNode } from "./types.ts";

export type DuplicateGroup = {
  name: string;
  size: number;
  ids: string[];
};

/**
 * Library files that share a normalized name and byte size.
 * This compares stored records, not file contents, and skips Trash.
 */
export function findDuplicateGroups(nodes: readonly FileNode[]): DuplicateGroup[] {
  const groups = new Map<string, FileNode[]>();
  for (const node of nodes) {
    if (node.kind !== "file") continue;
    if (node.id === TRASH_ID || node.parentId === TRASH_ID) continue;
    const name = node.name.trim().toLowerCase();
    if (!name) continue;
    const key = `${node.size}\0${name}`;
    const list = groups.get(key);
    if (list) list.push(node);
    else groups.set(key, [node]);
  }

  return [...groups.values()]
    .filter((list) => list.length > 1)
    .map((list) => ({
      name: list[0].name,
      size: list[0].size,
      ids: list.map((node) => node.id),
    }))
    .sort((a, b) => {
      const waste = b.size * (b.ids.length - 1) - a.size * (a.ids.length - 1);
      return waste || a.name.localeCompare(b.name);
    });
}
