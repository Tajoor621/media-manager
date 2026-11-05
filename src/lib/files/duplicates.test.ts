import assert from "node:assert/strict";
import test from "node:test";
import { findDuplicateGroups } from "./duplicates.ts";
import { TRASH_ID, type FileNode } from "./types.ts";

function node(partial: Pick<FileNode, "id" | "name" | "size" | "kind" | "parentId">): FileNode {
  return {
    mime: "application/octet-stream",
    createdAt: 1,
    updatedAt: 1,
    favorite: false,
    bookmark: false,
    ...partial,
  };
}

test("groups files that share a name and size, ignoring case and Trash", () => {
  const groups = findDuplicateGroups([
    node({ id: "a", name: "Photo.JPG", size: 10, kind: "file", parentId: "root" }),
    node({ id: "b", name: "photo.jpg", size: 10, kind: "file", parentId: "folder-photos" }),
    node({ id: "c", name: "photo.jpg", size: 11, kind: "file", parentId: "root" }),
    node({ id: "d", name: "notes.md", size: 4, kind: "file", parentId: "root" }),
    node({ id: "e", name: "Photo.JPG", size: 10, kind: "file", parentId: TRASH_ID }),
    node({ id: "folder", name: "Photo.JPG", size: 10, kind: "folder", parentId: "root" }),
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].name, "Photo.JPG");
  assert.equal(groups[0].size, 10);
  assert.deepEqual(groups[0].ids, ["a", "b"]);
});

test("returns no groups when every file is unique", () => {
  const groups = findDuplicateGroups([
    node({ id: "a", name: "a.jpg", size: 1, kind: "file", parentId: "root" }),
    node({ id: "b", name: "b.jpg", size: 1, kind: "file", parentId: "root" }),
  ]);
  assert.deepEqual(groups, []);
});
