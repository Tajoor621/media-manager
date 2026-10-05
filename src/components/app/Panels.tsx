import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Camera, Cloud, Cpu, FolderOpen, HardDrive, Images, MemoryStick, Radio, Search } from "lucide-react";
import { useFiles } from "@/lib/files/store";
import { useShallow } from "zustand/react/shallow";
import { formatBytes } from "@/lib/files/format";
import { viewerKind } from "@/lib/files/mime";
import { Button, Input, Modal } from "@/components/ui";
import { FileGlyph } from "./file-icon";
import { BrandMark } from "./Brand";
import { listDriveFolder, readDriveFile, searchDrive, type DriveRpc } from "@/lib/cloud/drive";
import { driveFileBase64, driveFileText, normalizeDriveItems } from "@/lib/cloud/normalize";
import {
  classifyCallToolError,
  isConnectorPending,
  isLoginRequired,
  redirectToLoginIfRequired,
  useRefetchWhenConnectorReady,
  type CallToolResult,
} from "@/lib/app-data";
import { useP2PRoom } from "@/lib/multiplayer/use-p2p-room";
import { mimeFromName } from "@/lib/files/mime";
import { cn } from "@/lib/utils";

export function SettingsPanel() {
  const open = useFiles((s) => s.settingsOpen);
  const settings = useFiles((s) => s.settings);
  const transfers = useFiles((s) => s.transfers);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  return (
    <Modal open={open} onClose={() => useFiles.getState().setSettingsOpen(false)} title="Settings" wide>
      <div className="space-y-6">
        <section>
          <h3 className="mb-2 text-xs uppercase tracking-wider text-subtle">Appearance</h3>
          <div className="flex gap-2">
            {(["dark", "light"] as const).map((t) => (
              <Button
                key={t}
                size="sm"
                variant={settings.theme === t ? "default" : "secondary"}
                onClick={() => useFiles.getState().setTheme(t)}
              >
                {t === "dark" ? "Dark gold" : "Daylight"}
              </Button>
            ))}
          </div>
        </section>
        <section>
          <h3 className="mb-2 text-xs uppercase tracking-wider text-subtle">Playback</h3>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.autoPlay}
              onChange={(e) => useFiles.getState().patchSettings({ autoPlay: e.target.checked })}
            />
            Auto-play media
          </label>
        </section>
        <section>
          <h3 className="mb-2 text-xs uppercase tracking-wider text-subtle">RAM & ROM</h3>
          <StorageMeters />
          <LargestFiles />
          <div className="mt-3">
            <Button size="sm" variant="secondary" onClick={() => void useFiles.getState().persistStorage()}>
              Keep library on this device
            </Button>
          </div>
        </section>
        <section>
          <h3 className="mb-2 text-xs uppercase tracking-wider text-subtle">Transfers</h3>
          {transfers.length === 0 ? (
            <p className="text-sm text-muted">No active transfers.</p>
          ) : (
            <ul className="space-y-2">
              {transfers.slice(0, 8).map((t) => (
                <li key={t.id} className="text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="truncate">{t.name}</span>
                    <span className="text-xs text-subtle">{t.status}</span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-elevated">
                    <div className="h-full bg-gold" style={{ width: `${t.progress}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h3 className="mb-2 text-xs uppercase tracking-wider text-subtle">Cloud</h3>
          <p className="text-sm text-muted">
            Google Drive lives in the sidebar. Dropbox and OneDrive work by opening their synced folders via
            Device folder, or by uploading files into the Library.
          </p>
        </section>
        <section>
          <h3 className="mb-2 text-xs uppercase tracking-wider text-subtle">Shortcuts</h3>
          <ul className="space-y-1.5 text-sm text-muted">
            {[
              ["⌘K", "Search all files"],
              ["⌘A", "Select all"],
              ["⌘C / ⌘X / ⌘V", "Copy, cut, paste"],
              ["Enter", "Open"],
              ["F2", "Rename"],
              ["Delete", "Move to trash"],
              ["Backspace", "Up one folder"],
              ["Esc", "Close viewer"],
            ].map(([k, v]) => (
              <li key={k} className="flex items-center justify-between gap-3">
                <span>{v}</span>
                <kbd className="rounded bg-elevated px-1.5 py-0.5 text-xs text-subtle hairline">{k}</kbd>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="mb-2 text-xs uppercase tracking-wider text-subtle">Install on your phone</h3>
          <p className="mb-3 text-sm text-muted">
            Publish this app first, then open it in the phone browser. Add to Home Screen for a
            fullscreen icon, offline library, and the 621 mark on the launcher.
          </p>
          <ol className="mb-3 space-y-3 text-sm text-muted">
            <li>
              <p className="font-medium text-foreground">iPhone / iPad</p>
              <p>
                Open in Safari (not Chrome). Tap Share, then Add to Home Screen. Launch from the
                gold Media Manager icon. iOS keeps files you upload in the Library; it cannot open a
                whole disk folder the way Chrome on Android can.
              </p>
            </li>
            <li>
              <p className="font-medium text-foreground">Android</p>
              <p>
                Open in Chrome. Use Install app below if it appears, or the menu → Install app / Add
                to Home screen. Chrome can also connect a Device folder for real files.
              </p>
            </li>
            <li>
              <p className="font-medium text-foreground">Android APK / Play Store</p>
              <p>
                After publish, paste the live HTTPS URL into PWABuilder to wrap it as a Trusted Web
                Activity APK or AAB. That is the Play Store package — still this same web app, not a
                second codebase.
              </p>
            </li>
          </ol>
          <div className="flex flex-wrap gap-2">
            {installEvent && (
              <Button
                size="sm"
                onClick={async () => {
                  await installEvent.prompt();
                  setInstallEvent(null);
                }}
              >
                Install app
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => window.open(`${import.meta.env.BASE_URL}?install=1&platform=ios`, "_blank")}
            >
              Home screen guide
            </Button>
          </div>
        </section>
        <section>
          <h3 className="mb-2 text-xs uppercase tracking-wider text-subtle">Library</h3>
          <label className="mb-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.showHidden}
              onChange={(e) => useFiles.getState().patchSettings({ showHidden: e.target.checked })}
            />
            Show hidden files
          </label>
          <Button size="sm" variant="danger" onClick={() => void useFiles.getState().resetLibrary()}>
            Reset sample library
          </Button>
        </section>
        <section className="overflow-hidden rounded-xl bg-ink">
          <BrandMark variant="lockup" className="mx-auto h-auto w-full max-w-xs" alt="Media Manager" />
        </section>
      </div>
    </Modal>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

export function CommandPalette() {
  const open = useFiles((s) => s.commandOpen);
  const [q, setQ] = useState("");
  const nodeMap = useFiles((s) => s.nodes);
  const nodes = useMemo(() => Object.values(nodeMap), [nodeMap]);
  const hits = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return nodes.filter((x) => x.kind === "file").slice(0, 12);
    return nodes.filter((x) => x.name.toLowerCase().includes(n)).slice(0, 20);
  }, [q, nodes]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]">
      <button
        type="button"
        className="absolute inset-0 bg-background/70"
        aria-label="Close search"
        onClick={() => useFiles.getState().setCommandOpen(false)}
      />
      <div className="relative w-full max-w-lg overflow-hidden rounded-xl bg-card shadow-2xl hairline">
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="size-4 text-gold" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search every file"
            className="h-12 flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <ul className="max-h-80 overflow-auto py-1">
          {hits.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-elevated"
                onClick={() => {
                  if (n.kind === "folder") useFiles.getState().openFolder(n.id);
                  else useFiles.getState().openViewer(n.id);
                  useFiles.getState().setCommandOpen(false);
                }}
              >
                <FileGlyph kind={viewerKind(n.mime, n.name)} folder={n.kind === "folder"} />
                <span className="truncate text-sm">{n.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function StorageMeters({ compact }: { compact?: boolean }) {
  const hardware = useFiles((s) => s.hardware);
  const deviceBytes = useFiles((s) => s.deviceBytes);
  const deviceCount = useFiles((s) => s.deviceFileCount);
  const scanning = useFiles((s) => s.deviceScanning);

  useEffect(() => {
    if (!hardware) void useFiles.getState().refreshHardware();
  }, [hardware]);

  const ramTotal = hardware?.ramBytes ?? hardware?.heapLimit ?? 0;
  const ramUsed = hardware?.heapUsed ?? 0;
  const romTotal = hardware?.romQuota ?? 0;
  const romUsed = hardware?.romUsed ?? 0;
  const ramPct = ramTotal ? Math.min(100, (ramUsed / ramTotal) * 100) : 0;
  const romPct = romTotal ? Math.min(100, (romUsed / romTotal) * 100) : 0;

  return (
    <div className={cn("grid gap-2", compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2")}>
      <MeterCard
        icon={<MemoryStick className="size-4 text-gold" />}
        label="RAM"
        value={
          hardware?.ramGb
            ? `~${hardware.ramGb} GB device`
            : ramTotal
              ? formatBytes(ramTotal)
              : "Not reported"
        }
        detail={ramUsed ? `${formatBytes(ramUsed)} in use by this app` : hardware?.platform ?? ""}
        pct={ramPct}
      />
      <MeterCard
        icon={<Cpu className="size-4 text-gold" />}
        label="ROM"
        value={romTotal ? `${formatBytes(romUsed)} / ${formatBytes(romTotal)}` : "Measuring…"}
        detail={
          deviceCount
            ? `${scanning ? "Scanning · " : ""}${deviceCount.toLocaleString()} files · ${formatBytes(deviceBytes)} on disk`
            : hardware?.persisted
              ? "Persistent app storage"
              : "Grant a device folder to read phone storage"
        }
        pct={romPct}
      />
    </div>
  );
}

function MeterCard({
  icon,
  label,
  value,
  detail,
  pct,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  pct: number;
}) {
  return (
    <div className="rounded-lg bg-elevated px-3 py-3 hairline">
      <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wider text-subtle">
        {icon}
        {label}
      </div>
      <p className="text-sm tabular-nums text-foreground">{value}</p>
      <p className="mt-0.5 truncate text-xs text-muted">{detail}</p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-background">
        <div className="h-full bg-gold" style={{ width: `${pct || 6}%` }} />
      </div>
    </div>
  );
}

export function DevicePane() {
  const status = useFiles((s) => s.deviceStatus);
  const stack = useFiles((s) => s.deviceStack);
  const entries = useFiles((s) => s.deviceEntries);
  const mode = useFiles((s) => s.deviceMode);
  const path = useFiles((s) => s.devicePath);
  const rootName = useFiles((s) => s.deviceRootName);
  const fileCount = useFiles((s) => s.deviceFileCount);
  const folders = useFiles((s) => s.deviceFolders);
  const bytes = useFiles((s) => s.deviceBytes);
  const scanning = useFiles((s) => s.deviceScanning);
  const showHidden = useFiles((s) => s.settings.showHidden);
  const [q, setQ] = useState("");
  const dirRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = dirRef.current;
    if (!el) return;
    el.setAttribute("webkitdirectory", "");
    el.setAttribute("directory", "");
    el.multiple = true;
  }, []);

  const takeFiles = (list: FileList | null) => {
    const files = list ? [...list] : [];
    if (!files.length) return;
    void useFiles.getState().mountDeviceFiles(files);
  };

  const visible = entries.filter((e) => showHidden || !e.name.startsWith("."));
  const filtered = q.trim()
    ? visible.filter((e) => e.name.toLowerCase().includes(q.trim().toLowerCase()))
    : visible;
  const crumb = mode === "tree" ? [rootName, ...path.split("/").filter(Boolean)] : stack.map((s) => s.name);
  const ready = status === "ready";

  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-auto px-3 py-3 sm:px-5"
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        const files = [...e.dataTransfer.files];
        if (files.length) void useFiles.getState().mountDeviceFiles(files);
      }}
    >
      <input
        ref={dirRef}
        type="file"
        className="hidden"
        multiple
        onChange={(e) => {
          takeFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={filesRef}
        type="file"
        className="hidden"
        multiple
        onChange={(e) => {
          const files = e.target.files ? [...e.target.files] : [];
          e.target.value = "";
          if (files.length) void useFiles.getState().ingestFiles(files);
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        className="hidden"
        accept="image/*,video/*,audio/*"
        capture="environment"
        onChange={(e) => {
          const files = e.target.files ? [...e.target.files] : [];
          e.target.value = "";
          if (files.length) void useFiles.getState().ingestFiles(files);
        }}
      />

      <StorageMeters />

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => void useFiles.getState().connectDevice()}>
          Open disk folder
        </Button>
        <Button size="sm" variant="secondary" onClick={() => dirRef.current?.click()}>
          Entire folder
        </Button>
        <Button size="sm" variant="secondary" onClick={() => filesRef.current?.click()}>
          <Images className="size-3.5" />
          Photos & files
        </Button>
        <Button size="sm" variant="secondary" onClick={() => cameraRef.current?.click()}>
          <Camera className="size-3.5" />
          Camera
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {(
          [
            ["downloads", "Downloads"],
            ["pictures", "Pictures"],
            ["videos", "Videos"],
            ["music", "Music"],
            ["documents", "Documents"],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            size="sm"
            variant="ghost"
            onClick={() => void useFiles.getState().connectDevice(id)}
          >
            {label}
          </Button>
        ))}
      </div>
      <p className="mt-3 max-w-xl text-xs text-muted">
        Browsers will not silently open the whole phone. Choose Internal storage, Download, DCIM, or SD
        card in the system picker — then every file in that tree can be previewed, searched, and imported.
      </p>

      {ready ? (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm text-foreground">
                {rootName}
                {scanning ? " · scanning…" : ""}
              </p>
              <p className="text-xs text-subtle tabular-nums">
                {fileCount.toLocaleString()} files
                {folders ? ` · ${folders.toLocaleString()} folders` : ""} · {formatBytes(bytes)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" onClick={() => void useFiles.getState().deviceUp()} disabled={crumb.length <= 1}>
                Up
              </Button>
              <Button size="sm" variant="secondary" onClick={() => void useFiles.getState().importDeviceFolder()}>
                Import this tree
              </Button>
            </div>
          </div>
          <p className="mt-2 truncate text-xs text-muted">{crumb.join(" / ")}</p>
          <div className="mt-3">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter this folder" />
          </div>
          <ul className="mt-3 overflow-hidden rounded-lg hairline">
            {filtered.length === 0 ? (
              <li className="px-3 py-8 text-center text-sm text-muted">No files in this folder.</li>
            ) : (
              filtered.map((e) => (
                <li key={e.path || e.name} className="flex items-center gap-1 border-b border-border last:border-b-0">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center justify-between gap-3 px-3 py-3 text-left hover:bg-elevated"
                    onClick={() => {
                      if (e.kind === "folder") void useFiles.getState().enterDeviceFolder(e.name);
                      else void useFiles.getState().openDeviceFile(e.name);
                    }}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <FileGlyph kind={viewerKind(e.mime, e.name)} folder={e.kind === "folder"} />
                      <span className="truncate">{e.name}</span>
                    </span>
                    <span className="text-xs text-subtle tabular-nums">
                      {e.kind === "folder" ? "Folder" : formatBytes(e.size)}
                    </span>
                  </button>
                  {e.kind === "file" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mr-1 shrink-0"
                      onClick={() => void useFiles.getState().importDeviceFile(e.name)}
                    >
                      Import
                    </Button>
                  )}
                </li>
              ))
            )}
          </ul>
        </>
      ) : (
        <div className="mt-8 flex flex-col items-center gap-3 px-4 py-8 text-center">
          <HardDrive className="size-8 text-gold" />
          <h2 className="text-lg font-medium">Connect device storage</h2>
          <p className="max-w-md text-sm text-muted">
            Chrome / Edge: Open disk folder for a live mount. iPhone and Firefox: Entire folder copies the
            tree into the app so you can browse every file you granted.
          </p>
          <Button onClick={() => dirRef.current?.click()}>
            <FolderOpen className="size-4" />
            Choose a folder
          </Button>
        </div>
      )}
    </div>
  );
}

export function CloudPane() {
  const status = useFiles((s) => s.driveStatus);
  const items = useFiles((s) => s.driveItems);
  const err = useFiles((s) => s.driveError);
  const path = useFiles((s) => s.drivePath);
  const folderId = useFiles((s) => s.driveFolderId);
  const [q, setQ] = useState("");
  const pending = status === "pending";
  useRefetchWhenConnectorReady(pending, () => loadDrive(folderId));

  useEffect(() => {
    if (status === "idle") void loadDrive(folderId);
  }, [status, folderId]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 px-3 py-2 sm:px-5">
        <Button size="sm" variant="ghost" onClick={() => { useFiles.getState().driveUp(); void loadDrive(useFiles.getState().driveFolderId); }} disabled={path.length <= 1}>
          Up
        </Button>
        <span className="min-w-0 truncate text-sm text-muted">{path.map((p) => p.name).join(" / ")}</span>
        <form
          className="ml-auto flex max-w-xs flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void runSearch(q);
          }}
        >
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Drive" className="h-9" />
        </form>
      </div>
      {status === "loading" || status === "pending" ? (
        <p className="p-6 text-sm text-muted">Connecting to Google Drive…</p>
      ) : status === "login" ? (
        <Hint
          icon={<Cloud className="size-8 text-gold" />}
          title="Google Drive"
          body="Drive files load when this app is opened from Grok with Google Drive connected. Until then, keep using the Library or a Device folder."
        />
      ) : status === "error" ? (
        <Hint
          icon={<Cloud className="size-8 text-gold" />}
          title="Drive unavailable"
          body={err ?? "Could not list files. Open this app from Grok with Drive connected, or keep using Internal Storage."}
          action="Retry"
          onAction={() => void loadDrive(folderId)}
        />
      ) : (
        <ul className="min-h-0 flex-1 overflow-auto px-3 pb-8 sm:px-5">
          {items.map((it) => (
            <li key={it.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-3 text-left hover:bg-elevated"
                onClick={() => {
                  if (it.isFolder) {
                    useFiles.getState().setDriveFolder(it.id, it.name);
                    void loadDrive(it.id);
                  } else {
                    void importDrive(it.id, it.name, it.mimeType);
                  }
                }}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <FileGlyph kind={viewerKind(it.mimeType, it.name)} folder={it.isFolder} />
                  <span className="truncate text-sm">{it.name}</span>
                </span>
                <span className="text-xs text-subtle">{it.isFolder ? "Folder" : formatBytes(it.size)}</span>
              </button>
            </li>
          ))}
          {!items.length && <p className="p-6 text-sm text-muted">No files in this folder.</p>}
        </ul>
      )}
    </div>
  );
}

function unpackDrive(rpc: DriveRpc): CallToolResult {
  let data: unknown = null;
  try {
    data = JSON.parse(rpc.payload);
  } catch {
    data = null;
  }
  return {
    ok: rpc.ok,
    data,
    errorMessage: rpc.errorMessage,
    loginRequired: rpc.loginRequired,
    loginUrl: rpc.loginUrl,
    pending: rpc.pending,
  };
}

async function loadDrive(folderId: string) {
  useFiles.getState().setDriveItems([], "loading");
  const result = unpackDrive(await listDriveFolder({ data: { folderId } }));
  if (isConnectorPending(result)) {
    useFiles.getState().setDriveItems([], "pending");
    return;
  }
  if (isLoginRequired(result)) {
    useFiles.getState().setDriveItems([], "login", classifyCallToolError(result)?.message ?? "Sign in required");
    redirectToLoginIfRequired(result);
    return;
  }
  if (!result.ok) {
    const classified = classifyCallToolError(result);
    useFiles.getState().setDriveItems([], "error", classified?.message ?? result.errorMessage ?? "Drive error");
    return;
  }
  useFiles.getState().setDriveItems(normalizeDriveItems(result.data), "ready");
}

async function runSearch(query: string) {
  if (!query.trim()) return loadDrive(useFiles.getState().driveFolderId);
  useFiles.getState().setDriveItems([], "loading");
  const result = unpackDrive(await searchDrive({ data: { query } }));
  if (!result.ok) {
    useFiles.getState().setDriveItems([], "error", result.errorMessage ?? "Search failed");
    return;
  }
  useFiles.getState().setDriveItems(normalizeDriveItems(result.data), "ready");
}

async function importDrive(fileId: string, name: string, mime: string) {
  const tid = useFiles.getState().addTransfer({ name, kind: "cloud", status: "running", progress: 30 });
  const result = unpackDrive(await readDriveFile({ data: { fileId } }));
  if (!result.ok) {
    useFiles.getState().patchTransfer(tid, { status: "error", detail: result.errorMessage });
    return;
  }
  const text = driveFileText(result.data);
  const b64 = driveFileBase64(result.data);
  let file: File;
  if (b64) {
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    file = new File([bin], name, { type: mime });
  } else if (text) {
    file = new File([text], name, { type: mime || mimeFromName(name) });
  } else {
    file = new File([JSON.stringify(result.data, null, 2)], `${name}.json`, { type: "application/json" });
  }
  await useFiles.getState().ingestFiles([file]);
  useFiles.getState().patchTransfer(tid, { status: "done", progress: 100 });
}

export function NearbyPanel() {
  const open = useFiles((s) => s.nearbyOpen);
  const [code, setCode] = useState(() => Math.random().toString(36).slice(2, 8).toLowerCase());
  const [join, setJoin] = useState("");
  const [room, setRoom] = useState<string | null>(null);
  const selected = useFiles((s) => s.selectedIds);

  if (!open) return null;
  return (
    <Modal open={open} onClose={() => useFiles.getState().setNearbyOpen(false)} title="Nearby share">
      {!room ? (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Two devices on this app join the same room code. Files travel peer-to-peer over WebRTC — nothing is stored on a server.
          </p>
          <div className="rounded-lg bg-elevated p-4 text-center hairline">
            <p className="text-xs uppercase tracking-wider text-subtle">Your room</p>
            <p className="font-display mt-1 text-2xl tracking-[0.3em] text-gold">{code}</p>
          </div>
          <Button className="w-full" onClick={() => setRoom(`mm${code}`)}>
            Host this room
          </Button>
          <div className="flex gap-2">
            <Input value={join} onChange={(e) => setJoin(e.target.value)} placeholder="Enter code" />
            <Button variant="secondary" onClick={() => join.trim() && setRoom(`mm${join.trim().toLowerCase()}`)}>
              Join
            </Button>
          </div>
        </div>
      ) : (
        <NearbyRoom
          key={room}
          room={room}
          fileIds={selected}
          onLeave={() => {
            setRoom(null);
            setCode(Math.random().toString(36).slice(2, 8).toLowerCase());
          }}
        />
      )}
    </Modal>
  );
}

function NearbyRoom({
  room,
  fileIds,
  onLeave,
}: {
  room: string;
  fileIds: string[];
  onLeave: () => void;
}) {
  const p2p = useP2PRoom({ room, name: "Media Manager" });
  const [log, setLog] = useState<string[]>([]);
  const incoming = useMemo(() => new Map<string, { name: string; chunks: string[]; n: number }>(), []);

  useEffect(() => {
    return p2p.onMessage((_from, data) => {
      if (!data || typeof data !== "object") return;
      const msg = data as Record<string, unknown>;
      if (msg.t === "hello") setLog((l) => [`Peer joined: ${String(msg.name ?? "device")}`, ...l]);
      if (msg.t === "file-offer") {
        incoming.set(String(msg.id), { name: String(msg.name), chunks: [], n: Number(msg.n) });
        setLog((l) => [`Incoming ${String(msg.name)}`, ...l]);
      }
      if (msg.t === "file-chunk") {
        const rec = incoming.get(String(msg.id));
        if (rec) rec.chunks[Number(msg.i)] = String(msg.data);
      }
      if (msg.t === "file-end") {
        const rec = incoming.get(String(msg.id));
        if (!rec) return;
        const b64 = rec.chunks.join("");
        const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const file = new File([bin], rec.name);
        void useFiles.getState().ingestFiles([file]);
        setLog((l) => [`Saved ${rec.name}`, ...l]);
      }
    });
  }, [p2p, incoming]);

  useEffect(() => {
    if (p2p.joined) p2p.send({ t: "hello", name: "Media Manager" });
  }, [p2p, p2p.joined]);

  async function sendSelected() {
    for (const id of fileIds) {
      const node = useFiles.getState().nodes[id];
      if (!node || node.kind !== "file") continue;
      const blob = await useFiles.getState().getBlob(id);
      if (!blob) continue;
      const buf = new Uint8Array(await blob.arrayBuffer());
      let binary = "";
      buf.forEach((b) => {
        binary += String.fromCharCode(b);
      });
      const b64 = btoa(binary);
      const size = 12_000;
      const n = Math.ceil(b64.length / size);
      p2p.send({ t: "file-offer", id, name: node.name, n, mime: node.mime });
      for (let i = 0; i < n; i++) {
        p2p.send({ t: "file-chunk", id, i, data: b64.slice(i * size, (i + 1) * size) });
      }
      p2p.send({ t: "file-end", id });
      setLog((l) => [`Sent ${node.name}`, ...l]);
    }
  }

  return (
    <div className="space-y-3">
      <p className={cn("text-sm", p2p.joined ? "text-gold" : "text-muted")}>
        {p2p.joined ? "Room live" : "Joining…"} · {p2p.peers.length} peer{p2p.peers.length === 1 ? "" : "s"}
      </p>
      <ul className="text-xs text-muted">
        {p2p.peers.map((p) => (
          <li key={p.id}>
            {p.name} · {p.connectionState}
            {p.rttMs != null ? ` · ${Math.round(p.rttMs)}ms` : ""}
          </li>
        ))}
      </ul>
      <Button className="w-full" disabled={!fileIds.length} onClick={() => void sendSelected()}>
        Send selected files
      </Button>
      <ul className="max-h-32 overflow-auto text-xs text-subtle">
        {log.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
      <Button variant="ghost" className="w-full" onClick={onLeave}>
        Leave
      </Button>
    </div>
  );
}

function LargestFiles() {
  const nodeMap = useFiles((s) => s.nodes);
  const files = useMemo(
    () =>
      Object.values(nodeMap)
        .filter((n) => n.kind === "file")
        .sort((a, b) => b.size - a.size)
        .slice(0, 5),
    [nodeMap],
  );
  if (!files.length) return null;
  return (
    <ul className="mt-3 space-y-1">
      {files.map((f) => (
        <li key={f.id}>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 text-left text-xs text-muted hover:text-gold"
            onClick={() => useFiles.getState().openViewer(f.id)}
          >
            <span className="truncate">{f.name}</span>
            <span className="tabular-nums">{formatBytes(f.size)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Hint({
  icon,
  title,
  body,
  action,
  onAction,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 py-16 text-center">
      {icon}
      <h2 className="text-lg font-medium">{title}</h2>
      <p className="max-w-md text-sm text-muted">{body}</p>
      {action && onAction && (
        <Button onClick={onAction}>{action}</Button>
      )}
    </div>
  );
}
