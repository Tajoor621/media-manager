import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button, Input } from "@/components/ui";
import {
  createVault, unlockVault, vaultAdd, vaultConfigured, vaultList, vaultRead, vaultRemove,
  type VaultItem,
} from "@/lib/files/private-vault";

/** Password-derived encryption is used instead of a weak short PIN in the web edition. */
export function PrivateVaultPanel() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [entries, setEntries] = useState<VaultItem[]>([]);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => { void vaultConfigured().then(setConfigured).catch(() => setConfigured(false)); }, []);
  useEffect(() => {
    const lock = () => {
      if (document.visibilityState === "hidden") {
        setKey(null);
        setEntries([]);
        setPassword("");
      }
    };
    document.addEventListener("visibilitychange", lock);
    return () => document.removeEventListener("visibilitychange", lock);
  }, []);
  async function refresh(k: CryptoKey) { setEntries(await vaultList(k)); }
  async function authenticate() {
    setBusy(true);
    try {
      if (!configured && password !== confirm) throw Error("Passphrases do not match.");
      const k = configured ? await unlockVault(password) : await createVault(password);
      setKey(k);
      setConfigured(true);
      setPassword("");
      setConfirm("");
      await refresh(k);
      toast.success("Private Vault unlocked");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not unlock vault"); }
    finally { setBusy(false); }
  }
  async function addFiles(files: FileList | null) {
    if (!files || !key) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) await vaultAdd(key, file);
      await refresh(key);
      toast.success("Encrypted copies added. Original files were not deleted.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Import failed"); }
    finally {
      if (fileInput.current) fileInput.current.value = "";
      setBusy(false);
    }
  }
  async function exportItem(item: VaultItem) {
    if (!key) return;
    try {
      const file = await vaultRead(key, item.id);
      const url = URL.createObjectURL(file);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.name;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Export failed"); }
  }
  return (
    <section className="space-y-3">
      <h3 className="text-xs uppercase tracking-wider text-subtle">Private Vault • encrypted local files</h3>
      <p className="text-sm text-muted">
        Encrypted copies stay in this browser using AES-GCM. Originals remain where they were.
        Clearing website data may permanently erase vault files. No password recovery is available.
      </p>
      {!key ? (
        <div className="space-y-2">
          <p className="text-sm">{configured === null ? "Checking vault…" : configured ? "Unlock vault" : "Create a private vault with a passphrase of at least 12 characters."}</p>
          <Input type="password" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Vault passphrase" />
          {configured === false && <Input type="password" autoComplete="off" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm passphrase" />}
          <Button disabled={busy || configured === null || !password} onClick={() => void authenticate()}>
            {configured ? "Unlock Vault" : "Create encrypted Vault"}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => fileInput.current?.click()}>Import encrypted copy</Button>
            <Button variant="secondary" onClick={() => { setKey(null); setEntries([]); }}>Lock Vault</Button>
          </div>
          <input className="sr-only" aria-label="Select files for private vault" type="file" multiple ref={fileInput} onChange={(e) => void addFiles(e.target.files)} />
          {entries.length === 0 ? <p className="text-sm text-muted">No encrypted files yet.</p> : entries.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-gold/20 p-2">
              <span className="min-w-0 truncate text-sm">{item.name} · {Math.round(item.size / 1024)} KB</span>
              <div className="flex gap-1">
                <Button size="sm" variant="secondary" onClick={() => void exportItem(item)}>Export</Button>
                <Button size="sm" variant="danger" onClick={() => {
                  if (!window.confirm("Delete this encrypted copy permanently?")) return;
                  void vaultRemove(item.id).then(() => refresh(key)).catch(() => toast.error("Delete failed"));
                }}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
