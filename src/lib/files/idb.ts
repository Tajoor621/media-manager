import type { FileNode } from "./types";

const DB_NAME = "media-manager-621";
const DB_VER = 1;

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error("idb request failed"));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("idb tx failed"));
    tx.onabort = () => reject(tx.error ?? new Error("idb tx aborted"));
  });
}

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  dbPromise ??= new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, DB_VER);
    open.onupgradeneeded = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains("nodes")) {
        const s = db.createObjectStore("nodes", { keyPath: "id" });
        s.createIndex("parentId", "parentId", { unique: false });
      }
      if (!db.objectStoreNames.contains("blobs")) {
        db.createObjectStore("blobs", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error ?? new Error("idb open failed"));
  });
  return dbPromise;
}

export async function getAllNodes(): Promise<FileNode[]> {
  const db = await openDb();
  return req(db.transaction("nodes").objectStore("nodes").getAll()) as Promise<FileNode[]>;
}

export async function putNode(node: FileNode): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("nodes", "readwrite");
  tx.objectStore("nodes").put(node);
  await txDone(tx);
}

export async function putNodes(nodes: FileNode[]): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("nodes", "readwrite");
  const store = tx.objectStore("nodes");
  for (const n of nodes) store.put(n);
  await txDone(tx);
}

export async function deleteNode(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(["nodes", "blobs"], "readwrite");
  tx.objectStore("nodes").delete(id);
  tx.objectStore("blobs").delete(id);
  await txDone(tx);
}

export async function putBlob(id: string, data: ArrayBuffer, mime: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("blobs", "readwrite");
  tx.objectStore("blobs").put({ id, data, mime });
  await txDone(tx);
}

export async function getBlobRecord(
  id: string,
): Promise<{ id: string; data: ArrayBuffer; mime: string } | undefined> {
  const db = await openDb();
  return req(db.transaction("blobs").objectStore("blobs").get(id));
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  const row = await req(db.transaction("meta").objectStore("meta").get(key));
  return row ? ((row as { key: string; value: T }).value as T) : undefined;
}

export async function setMeta<T>(key: string, value: T): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("meta", "readwrite");
  tx.objectStore("meta").put({ key, value });
  await txDone(tx);
}

export async function clearLibrary(): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(["nodes", "blobs", "meta"], "readwrite");
  tx.objectStore("nodes").clear();
  tx.objectStore("blobs").clear();
  tx.objectStore("meta").clear();
  await txDone(tx);
}
