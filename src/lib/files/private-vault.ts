/** Offline, origin-local encrypted vault. No password or plaintext filename is persisted. */
const DB = "mm621-private-vault-v1";
const STORE = "entries";
const SETTINGS = "settings";
const enc = new TextEncoder();
const dec = new TextDecoder();
type VaultRow = { id: string; iv: Uint8Array; ciphertext: ArrayBuffer; created: number };
export type VaultItem = { id: string; name: string; size: number; type: string; created: number };
type Payload = { name: string; type: string; bytes: number[] };
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(SETTINGS)) db.createObjectStore(SETTINGS);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function transact<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => db.close();
  });
}
async function key(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", iterations: 310000, salt: salt as BufferSource },
    material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"],
  );
}
async function seal(k: CryptoKey, bytes: Uint8Array): Promise<{ iv: Uint8Array; ciphertext: ArrayBuffer }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, bytes as BufferSource);
  return { iv, ciphertext };
}
async function unseal(k: CryptoKey, row: { iv: Uint8Array; ciphertext: ArrayBuffer }): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: row.iv as BufferSource }, k, row.ciphertext));
}
type Header = { salt: Uint8Array; verifier: { iv: Uint8Array; ciphertext: ArrayBuffer } };
export async function vaultConfigured(): Promise<boolean> {
  return Boolean(await transact<Header | undefined>(SETTINGS, "readonly", s => s.get("header")));
}
export async function createVault(password: string): Promise<CryptoKey> {
  if (password.length < 12) throw Error("Use at least 12 characters.");
  if (await vaultConfigured()) throw Error("Vault already exists.");
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const k = await key(password, salt);
  const verifier = await seal(k, enc.encode("media-manager-621-vault-v1"));
  await transact(SETTINGS, "readwrite", s => s.put({ salt, verifier }, "header"));
  return k;
}
export async function unlockVault(password: string): Promise<CryptoKey> {
  const header = await transact<Header | undefined>(SETTINGS, "readonly", s => s.get("header"));
  if (!header) throw Error("Create a vault first.");
  const k = await key(password, header.salt);
  try {
    const proof = await unseal(k, header.verifier);
    if (dec.decode(proof) !== "media-manager-621-vault-v1") throw Error("Incorrect passphrase.");
    return k;
  } catch { throw Error("Incorrect passphrase or corrupted vault."); }
}
export async function vaultAdd(k: CryptoKey, file: File): Promise<void> {
  if (file.size > 20 * 1024 * 1024) throw Error("Web vault supports files up to 20 MB each.");
  const payload: Payload = { name: file.name, type: file.type, bytes: Array.from(new Uint8Array(await file.arrayBuffer())) };
  const sealed = await seal(k, enc.encode(JSON.stringify(payload)));
  const row: VaultRow = { id: crypto.randomUUID(), ...sealed, created: Date.now() };
  await transact(STORE, "readwrite", s => s.put(row));
}
async function rows(): Promise<VaultRow[]> {
  return transact<VaultRow[]>(STORE, "readonly", s => s.getAll());
}
export async function vaultList(k: CryptoKey): Promise<VaultItem[]> {
  const result: VaultItem[] = [];
  for (const row of await rows()) {
    try {
      const p = JSON.parse(dec.decode(await unseal(k, row))) as Payload;
      result.push({ id: row.id, name: p.name, type: p.type, size: p.bytes.length, created: row.created });
    } catch { /* A corrupt entry cannot be displayed; do not leak ciphertext. */ }
  }
  return result.sort((a,b) => b.created - a.created);
}
export async function vaultRead(k: CryptoKey, id: string): Promise<File> {
  const row = await transact<VaultRow | undefined>(STORE, "readonly", s => s.get(id));
  if (!row) throw Error("File not found");
  const p = JSON.parse(dec.decode(await unseal(k, row))) as Payload;
  return new File([new Uint8Array(p.bytes)], p.name, { type: p.type });
}
export async function vaultRemove(id: string): Promise<void> {
  await transact(STORE, "readwrite", s => s.delete(id));
}
