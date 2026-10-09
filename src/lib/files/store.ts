import { create } from "zustand";
import { toast } from "sonner";
import { uid } from "@/lib/utils";
import {
  FOLDER_IDS,
  ROOT_ID,
  TRASH_ID,
  type ClipboardOp,
  type DeviceEntry,
  type DriveItem,
  type FileNode,
  type NamePrompt,
  type PlaceId,
  type Settings,
  type SortKey,
  type Tab,
  type ThemeMode,
  type Transfer,
  type ViewMode,
} from "./types";
import * as idb from "./idb";
import { seedLibrary, ensureLatestSamples, folderTree } from "./seed";
import { mimeFromName, viewerKind } from "./mime";
import {
  collectDirectoryFiles,
  ensurePermission,
  filesUnderPath,
  getDeviceBagFile,
  hasFileSystemAccess,
  listDirectory,
  listTreePath,
  mountFileList,
  openDeviceSubdir,
  permissionState,
  pickDirectory,
  readDeviceFile,
  readDevicePath,
  requestDeviceFolderInput,
  fsaUsable,
  prefersDirectoryInput,
  scanDirectory,
  treeParent,
  writeDeviceFile,
  type WellKnownDir,
} from "./fs-access";
import { readHardware, requestPersistentStorage, type HardwareInfo } from "./hardware";

const SETTINGS_KEY = "mm-621-settings";
let scanGen = 0;
let volumeHandles: FileSystemDirectoryHandle[] = [];

type VolumeSnap = { name: string; files: number; folders: number; bytes: number };

async function rememberVolumes(handles: FileSystemDirectoryHandle[]) {
  const unique: FileSystemDirectoryHandle[] = [];
  const seen = new Set<string>();
  for (const handle of handles) {
    const key = handle.name || "Storage";
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(handle);
  }
  volumeHandles = unique;
  await idb.setMeta("deviceVolumes", unique);
  if (unique[0]) await idb.setMeta("deviceHandle", unique[0]);
  return unique;
}

async function scanSavedVolumes(
  handles: FileSystemDirectoryHandle[],
  set: (partial: Partial<Store>) => void,
) {
  const unique = await rememberVolumes(handles);
  const active = unique[0];
  if (!active) return;
  let entries: DeviceEntry[] = [];
  try {
    entries = await listDirectory(active);
  } catch {
    entries = [];
  }
  set({
    deviceHandle: active,
    deviceStack: [{ name: active.name || "Device", handle: active }],
    deviceEntries: entries,
    deviceStatus: "ready",
    deviceMode: "fsa",
    devicePath: "",
    deviceRootName: unique.length > 1 ? `${unique.length} storage volumes` : active.name || "Device",
    deviceVolumes: unique.map((h) => ({ name: h.name || "Storage", files: 0, folders: 0, bytes: 0 })),
    deviceScanning: true,
    deviceFileCount: entries.filter((e) => e.kind === "file").length,
    deviceFolders: entries.filter((e) => e.kind === "folder").length,
    deviceBytes: entries.reduce((s, e) => s + e.size, 0),
    deviceIndex: [],
  });
  scanGen += 1;
  const gen = scanGen;
  let files = 0;
  let folders = 0;
  let bytes = 0;
  const index: DeviceEntry[] = [];
  const snaps: VolumeSnap[] = [];
  for (const handle of unique) {
    if (scanGen !== gen) return;
    const stats = await scanDirectory(handle, (info) => {
      if (scanGen !== gen) return;
      set({
        deviceFileCount: files + info.files,
        deviceFolders: folders + info.folders,
        deviceBytes: bytes + info.bytes,
        deviceScanning: true,
      });
    });
    files += stats.files;
    folders += stats.folders;
    bytes += stats.bytes;
    const prefix = handle.name || "Storage";
    for (const entry of stats.index) {
      if (index.length >= 80000) break;
      index.push({ ...entry, path: entry.path ? `${prefix}/${entry.path}` : prefix });
    }
    snaps.push({ name: prefix, files: stats.files, folders: stats.folders, bytes: stats.bytes });
    set({ deviceFileCount: files, deviceFolders: folders, deviceBytes: bytes, deviceIndex: index, deviceVolumes: snaps });
  }
  if (scanGen === gen) {
    set({ deviceScanning: false });
    void idb.setMeta("deviceSnapshot", {
      name: unique.length > 1 ? `${unique.length} storage volumes` : active.name || "Device",
      files,
      folders,
      bytes,
    });
  }
}

let nameResolver: ((value: string | null) => void) | null = null;

const defaultSettings: Settings = {
  theme: "dark",
  viewMode: "grid",
  sort: "name",
  sortDir: "asc",
  showHidden: false,
  autoPlay: true,
};

function loadSettings(): Settings {
  if (typeof localStorage === "undefined") return defaultSettings;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...defaultSettings, ...JSON.parse(raw) } : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* quota */
  }
}

const blobCache = new Map<string, Blob>();
const urlCache = new Map<string, string>();

export function revokeUrl(id: string) {
  const u = urlCache.get(id);
  if (u) {
    URL.revokeObjectURL(u);
    urlCache.delete(id);
  }
}

export function objectUrlFor(id: string, blob: Blob): string {
  const prev = urlCache.get(id);
  if (prev) return prev;
  const u = URL.createObjectURL(blob);
  urlCache.set(id, u);
  return u;
}

function placeTitle(place: PlaceId): string {
  const map: Record<PlaceId, string> = {
    internal: "Library",
    photos: "Photos",
    videos: "Videos",
    music: "Music",
    documents: "Documents",
    downloads: "Downloads",
    archives: "Archives",
    projects: "Projects",
    favorites: "Favorites",
    recents: "Recents",
    bookmarks: "Bookmarks",
    trash: "Trash",
    device: "Device",
    drive: "Google Drive",
    nearby: "Nearby",
  };
  return map[place];
}

function folderForPlace(place: PlaceId): string {
  switch (place) {
    case "photos":
      return FOLDER_IDS.photos;
    case "videos":
      return FOLDER_IDS.videos;
    case "music":
      return FOLDER_IDS.music;
    case "documents":
      return FOLDER_IDS.documents;
    case "downloads":
      return FOLDER_IDS.downloads;
    case "archives":
      return FOLDER_IDS.archives;
    case "projects":
      return FOLDER_IDS.projects;
    case "trash":
      return TRASH_ID;
    default:
      return ROOT_ID;
  }
}

type PlayerState = {
  queue: string[];
  index: number;
  playing: boolean;
} | null;

type DeviceNav = { name: string; handle: FileSystemDirectoryHandle };

async function resolveDeviceFile(
  get: () => { deviceMode: "none" | "fsa" | "tree"; devicePath: string; deviceStack: DeviceNav[] },
  name: string,
): Promise<File | null> {
  if (get().deviceMode === "tree") {
    const path = name.includes("/") ? name : get().devicePath ? `${get().devicePath}/${name}` : name;
    return getDeviceBagFile(path) ?? getDeviceBagFile(name) ?? null;
  }
  if (name.includes("/")) {
    const slash = name.indexOf("/");
    const head = name.slice(0, slash);
    const rest = name.slice(slash + 1);
    const vol = volumeHandles.find((h) => h.name === head);
    if (vol && rest) {
      const fromVol = await readDevicePath(vol, rest);
      if (fromVol) return fromVol;
    }
    const root = get().deviceStack[0]?.handle;
    if (root) {
      const fromRoot = await readDevicePath(root, rest || name);
      if (fromRoot) return fromRoot;
    }
  }
  const cur = get().deviceStack[get().deviceStack.length - 1];
  if (!cur) return null;
  return readDeviceFile(cur.handle, name);
}

type Store = {
  ready: boolean;
  error: string | null;
  nodes: Record<string, FileNode>;
  recents: string[];
  settings: Settings;
  tabs: Tab[];
  activeTabId: string;
  selectedIds: string[];
  selectMode: boolean;
  search: string;
  clipboard: ClipboardOp | null;
  viewerId: string | null;
  viewerTab: "preview" | "hex" | "info";
  player: PlayerState;
  transfers: Transfer[];
  sidebarOpen: boolean;
  settingsOpen: boolean;
  commandOpen: boolean;
  nearbyOpen: boolean;
  namePrompt: NamePrompt | null;
  deviceHandle: FileSystemDirectoryHandle | null;
  deviceStack: DeviceNav[];
  deviceEntries: DeviceEntry[];
  deviceStatus: "idle" | "need-gesture" | "ready" | "error";
  deviceMode: "none" | "fsa" | "tree";
  devicePath: string;
  deviceRootName: string;
  deviceFileCount: number;
  deviceBytes: number;
  deviceFolders: number;
  deviceScanning: boolean;
  deviceIndex: DeviceEntry[];
  deviceVolumes: VolumeSnap[];
  hardware: HardwareInfo | null;
  driveFolderId: string;
  drivePath: { id: string; name: string }[];
  driveItems: DriveItem[];
  driveStatus: "idle" | "loading" | "ready" | "login" | "pending" | "error";
  driveError: string | null;
  storageBytes: number;
  quotaBytes: number;

  hydrate: () => Promise<void>;
  setTheme: (t: ThemeMode) => void;
  patchSettings: (p: Partial<Settings>) => void;
  setSearch: (q: string) => void;
  setSidebarOpen: (v: boolean) => void;
  setSettingsOpen: (v: boolean) => void;
  setCommandOpen: (v: boolean) => void;
  setNearbyOpen: (v: boolean) => void;
  askName: (title: string, value?: string) => Promise<string | null>;
  resolveNamePrompt: (value: string | null) => void;
  goPlace: (place: PlaceId, folderId?: string) => void;
  openFolder: (id: string) => void;
  goUp: () => void;
  addTab: (place: PlaceId, folderId?: string) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  setViewMode: (m: ViewMode) => void;
  setSort: (k: SortKey) => void;
  toggleSelectMode: () => void;
  toggleSelected: (id: string, additive?: boolean) => void;
  selectAll: () => void;
  clearSelection: () => void;
  openViewer: (id: string, tab?: "preview" | "hex" | "info") => void;
  closeViewer: () => void;
  setViewerTab: (t: "preview" | "hex" | "info") => void;
  playMedia: (ids: string[], index: number) => void;
  setPlaying: (v: boolean) => void;
  playerSkip: (dir: 1 | -1) => void;
  createFolder: (name?: string) => Promise<void>;
  createFile: (name?: string) => Promise<void>;
  rename: (id: string, name: string) => Promise<void>;
  remove: (ids?: string[]) => Promise<void>;
  restore: (ids: string[]) => Promise<void>;
  emptyTrash: () => Promise<void>;
  copyToClipboard: (mode: "copy" | "cut", ids?: string[]) => void;
  paste: () => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  toggleBookmark: (id: string) => Promise<void>;
  ingestFiles: (files: File[], parentId?: string) => Promise<void>;
  downloadNodes: (ids?: string[]) => Promise<void>;
  getBlob: (id: string) => Promise<Blob | null>;
  replaceBlob: (id: string, blob: Blob, name?: string) => Promise<void>;
  duplicate: (id: string) => Promise<void>;
  moveTo: (ids: string[], parentId: string) => Promise<void>;
  addTransfer: (t: Omit<Transfer, "id"> & { id?: string }) => string;
  patchTransfer: (id: string, p: Partial<Transfer>) => void;
  connectDevice: (startIn?: WellKnownDir) => Promise<void>;
  resumeDeviceAccess: () => Promise<void>;
  mountDeviceFiles: (files: File[]) => Promise<void>;
  enterDeviceFolder: (name: string) => Promise<void>;
  deviceUp: () => Promise<void>;
  refreshDevice: () => Promise<void>;
  importDeviceFile: (name: string) => Promise<void>;
  openDeviceFile: (name: string) => Promise<void>;
  importDeviceFolder: () => Promise<void>;
  refreshHardware: () => Promise<void>;
  persistStorage: () => Promise<void>;
  setDriveItems: (items: DriveItem[], status: Store["driveStatus"], error?: string | null) => void;
  setDriveFolder: (id: string, name: string) => void;
  driveUp: () => void;
  visibleNodes: () => FileNode[];
  currentFolderId: () => string;
  currentPlace: () => PlaceId;
  breadcrumb: () => FileNode[];
  refreshQuota: () => Promise<void>;
  resetLibrary: () => Promise<void>;
  shareNodes: (ids?: string[]) => Promise<void>;
  exportToDevice: (ids?: string[]) => Promise<void>;
};

function childrenOf(nodes: Record<string, FileNode>, parentId: string): FileNode[] {
  return Object.values(nodes).filter((n) => n.parentId === parentId && n.id !== n.parentId);
}

function descendants(nodes: Record<string, FileNode>, id: string): string[] {
  const out: string[] = [];
  const walk = (pid: string) => {
    for (const n of Object.values(nodes)) {
      if (n.parentId === pid && n.id !== pid) {
        out.push(n.id);
        if (n.kind === "folder") walk(n.id);
      }
    }
  };
  walk(id);
  return out;
}

function uniqueName(nodes: Record<string, FileNode>, parentId: string, name: string): string {
  const used = new Set(
    Object.values(nodes)
      .filter((n) => n.parentId === parentId)
      .map((n) => n.name),
  );
  if (!used.has(name)) return name;
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let i = 2;
  while (used.has(`${base} (${i})${ext}`)) i += 1;
  return `${base} (${i})${ext}`;
}

async function cloneNode(
  source: FileNode,
  parentId: string,
  nodes: Record<string, FileNode>,
  now: number,
): Promise<string> {
  const id = uid(source.kind === "folder" ? "folder" : "file");
  const copy: FileNode = {
    ...source,
    id,
    parentId,
    name: uniqueName(nodes, parentId, source.name),
    createdAt: now,
    updatedAt: now,
    originalParentId: undefined,
  };
  nodes[id] = copy;
  if (source.kind === "file") {
    let blob = blobCache.get(source.id) ?? null;
    if (!blob) {
      const rec = await idb.getBlobRecord(source.id);
      if (rec) blob = new Blob([rec.data], { type: rec.mime });
    }
    if (blob) {
      const buf = await blob.arrayBuffer();
      await idb.putBlob(id, buf, copy.mime);
      blobCache.set(id, new Blob([buf], { type: copy.mime }));
    }
  } else {
    const kids = Object.values(nodes)
      .filter((n) => n.parentId === source.id && n.id !== source.id)
      .map((n) => n.id);
    for (const kid of kids) {
      const node = nodes[kid];
      if (node) await cloneNode(node, id, nodes, now);
    }
  }
  await idb.putNode(copy);
  return id;
}

export const useFiles = create<Store>((set, get) => ({
  ready: true,
  error: null,
  nodes: Object.fromEntries(folderTree(0).map((n) => [n.id, n])),
  recents: [],
  settings: defaultSettings,
  tabs: [{ id: "tab-home", title: "Library", place: "internal", folderId: ROOT_ID }],
  activeTabId: "tab-home",
  selectedIds: [],
  selectMode: false,
  search: "",
  clipboard: null,
  viewerId: null,
  viewerTab: "preview",
  player: null,
  transfers: [],
  sidebarOpen: false,
  settingsOpen: false,
  commandOpen: false,
  nearbyOpen: false,
  namePrompt: null,
  deviceHandle: null,
  deviceStack: [],
  deviceEntries: [],
  deviceStatus: "idle",
  deviceMode: "none",
  devicePath: "",
  deviceRootName: "Device",
  deviceFileCount: 0,
  deviceBytes: 0,
  deviceFolders: 0,
  deviceScanning: false,
  deviceIndex: [],
  deviceVolumes: [],
  hardware: null,
  driveFolderId: "root",
  drivePath: [{ id: "root", name: "My Drive" }],
  driveItems: [],
  driveStatus: "idle",
  driveError: null,
  storageBytes: 0,
  quotaBytes: 0,

  hydrate: async () => {
    const settings = loadSettings();
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("light", settings.theme === "light");
    }
    set({ settings, error: null });
    try {
      const seeded = await idb.getMeta<boolean | number>("seeded");
      let nodes: FileNode[];
      if (!seeded) {
        const skeleton = folderTree();
        set({
          nodes: Object.fromEntries(skeleton.map((n) => [n.id, n])),
          ready: true,
          error: null,
        });
        nodes = await seedLibrary();
      } else {
        nodes = await idb.getAllNodes();
        if (!nodes.find((n) => n.id === ROOT_ID)) {
          const skeleton = folderTree();
          set({
            nodes: Object.fromEntries(skeleton.map((n) => [n.id, n])),
            ready: true,
            error: null,
          });
          nodes = await seedLibrary();
        } else {
          set({
            nodes: Object.fromEntries(nodes.map((n) => [n.id, n])),
            ready: true,
            error: null,
          });
          nodes = await ensureLatestSamples(nodes);
        }
      }
      const recents = (await idb.getMeta<string[]>("recents")) ?? [];
      const snap = await idb.getMeta<{ name: string; files: number; folders: number; bytes: number }>("deviceSnapshot");
      const savedMany = (await idb.getMeta<FileSystemDirectoryHandle[]>("deviceVolumes")) ?? [];
      const savedOne = await idb.getMeta<FileSystemDirectoryHandle>("deviceHandle");
      const saved = [...savedMany];
      if (savedOne && !saved.some((h) => h.name === savedOne.name)) saved.unshift(savedOne);
      const granted: FileSystemDirectoryHandle[] = [];
      const pending: FileSystemDirectoryHandle[] = [];
      for (const handle of saved) {
        const state = await permissionState(handle).catch(() => "unknown" as const);
        if (state === "granted") granted.push(handle);
        else pending.push(handle);
      }
      volumeHandles = granted.length ? granted : pending;
      set({
        nodes: Object.fromEntries(nodes.map((n) => [n.id, n])),
        recents,
        ready: true,
        error: null,
        deviceHandle: granted[0] ?? null,
        deviceStack: granted[0] ? [{ name: granted[0].name || "Device", handle: granted[0] }] : [],
        deviceEntries: [],
        deviceStatus: granted.length ? "ready" : pending.length ? "need-gesture" : "idle",
        deviceMode: granted.length ? "fsa" : "none",
        deviceRootName: (granted[0] ?? pending[0])?.name || snap?.name || "Device",
        deviceFileCount: snap?.files ?? 0,
        deviceFolders: snap?.folders ?? 0,
        deviceBytes: snap?.bytes ?? 0,
        deviceVolumes: (granted.length ? granted : pending).map((h) => ({
          name: h.name || "Storage",
          files: 0,
          folders: 0,
          bytes: 0,
        })),
      });
      if (granted.length) void scanSavedVolumes(granted, set);
      await get().refreshQuota();
      await get().refreshHardware();
      void requestPersistentStorage();
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Failed to open library", ready: false });
    }
  },

  setTheme: (theme) => {
    const settings = { ...get().settings, theme };
    saveSettings(settings);
    document.documentElement.classList.toggle("light", theme === "light");
    set({ settings });
  },
  patchSettings: (p) => {
    const settings = { ...get().settings, ...p };
    saveSettings(settings);
    set({ settings });
  },
  setSearch: (search) => set({ search }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  setNearbyOpen: (nearbyOpen) => set({ nearbyOpen }),
  askName: (title, value = "") =>
    new Promise<string | null>((resolve) => {
      nameResolver = resolve;
      set({ namePrompt: { title, value } });
    }),
  resolveNamePrompt: (value) => {
    nameResolver?.(value);
    nameResolver = null;
    set({ namePrompt: null });
  },

  currentPlace: () => {
    const tab = get().tabs.find((t) => t.id === get().activeTabId);
    return tab?.place ?? "internal";
  },
  currentFolderId: () => {
    const tab = get().tabs.find((t) => t.id === get().activeTabId);
    return tab?.folderId ?? ROOT_ID;
  },

  goPlace: (place, folderId) => {
    const id = folderId ?? folderForPlace(place);
    set({
      tabs: get().tabs.map((t) =>
        t.id === get().activeTabId ? { ...t, place, folderId: id, title: placeTitle(place) } : t,
      ),
      selectedIds: [],
      search: "",
      sidebarOpen: false,
    });
  },
  openFolder: (id) => {
    const node = get().nodes[id];
    if (!node || node.kind !== "folder") return;
    const place = get().currentPlace() === "trash" ? "trash" : "internal";
    set({
      tabs: get().tabs.map((t) =>
        t.id === get().activeTabId ? { ...t, folderId: id, title: node.name, place } : t,
      ),
      selectedIds: [],
    });
  },
  goUp: () => {
    const id = get().currentFolderId();
    const node = get().nodes[id];
    if (!node || node.id === ROOT_ID || node.id === TRASH_ID) {
      get().goPlace("internal");
      return;
    }
    get().openFolder(node.parentId);
  },
  addTab: (place, folderId) => {
    const id = uid("tab");
    const fid = folderId ?? folderForPlace(place);
    const tab: Tab = {
      id,
      title: get().nodes[fid]?.name ?? placeTitle(place),
      place,
      folderId: fid,
    };
    set({ tabs: [...get().tabs, tab], activeTabId: id, selectedIds: [] });
  },
  closeTab: (id) => {
    const tabs = get().tabs.filter((t) => t.id !== id);
    if (!tabs.length) {
      tabs.push({ id: "tab-home", title: "Library", place: "internal", folderId: ROOT_ID });
    }
    set({
      tabs,
      activeTabId: get().activeTabId === id ? tabs[tabs.length - 1].id : get().activeTabId,
    });
  },
  setActiveTab: (activeTabId) => set({ activeTabId, selectedIds: [] }),
  setViewMode: (viewMode) => get().patchSettings({ viewMode }),
  setSort: (sort) => {
    const s = get().settings;
    if (s.sort === sort) get().patchSettings({ sortDir: s.sortDir === "asc" ? "desc" : "asc" });
    else get().patchSettings({ sort });
  },
  toggleSelectMode: () => set({ selectMode: !get().selectMode, selectedIds: [] }),
  toggleSelected: (id, additive) => {
    const { selectedIds, selectMode } = get();
    set(
      additive || selectMode
        ? { selectedIds: selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id] }
        : { selectedIds: [id] },
    );
  },
  selectAll: () => set({ selectedIds: get().visibleNodes().map((n) => n.id), selectMode: true }),
  clearSelection: () => set({ selectedIds: [] }),

  openViewer: (id, tab) => {
    const recents = [id, ...get().recents.filter((x) => x !== id)].slice(0, 40);
    void idb.setMeta("recents", recents);
    const node = get().nodes[id];
    const kind = node ? viewerKind(node.mime, node.name) : "hex";
    const next: Partial<Store> = {
      viewerId: id,
      viewerTab: tab ?? "preview",
      recents,
      selectedIds: [id],
    };
    if (kind === "audio" || kind === "video") {
      const siblings = get()
        .visibleNodes()
        .filter((n) => n.kind === "file" && (viewerKind(n.mime, n.name) === "audio" || viewerKind(n.mime, n.name) === "video"));
      const queue = siblings.length ? siblings.map((s) => s.id) : [id];
      const index = Math.max(0, queue.indexOf(id));
      next.player = { queue, index: index >= 0 ? index : 0, playing: true };
    }
    set(next);
  },
  closeViewer: () => set({ viewerId: null }),
  setViewerTab: (viewerTab) => set({ viewerTab }),
  playMedia: (queue, index) => set({ player: { queue, index, playing: true } }),
  setPlaying: (playing) => {
    const p = get().player;
    if (p) set({ player: { ...p, playing } });
  },
  playerSkip: (dir) => {
    const p = get().player;
    if (!p) return;
    const index = (p.index + dir + p.queue.length) % p.queue.length;
    set({ player: { ...p, index, playing: true }, viewerId: p.queue[index] });
  },

  createFolder: async (name) => {
    const parentId = get().currentFolderId();
    const n = uniqueName(get().nodes, parentId, (name ?? "New folder").trim() || "New folder");
    const node: FileNode = {
      id: uid("folder"),
      parentId,
      name: n,
      kind: "folder",
      mime: "inode/directory",
      size: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      favorite: false,
      bookmark: false,
    };
    await idb.putNode(node);
    set({ nodes: { ...get().nodes, [node.id]: node } });
    toast.success(`Created ${n}`);
  },
  createFile: async (name) => {
    const parentId = get().currentFolderId();
    const n = uniqueName(get().nodes, parentId, (name ?? "Untitled.md").trim() || "Untitled.md");
    const id = uid("file");
    const mime = mimeFromName(n);
    const stem = n.replace(/\.[^.]+$/, "");
    const body = n.endsWith(".md") ? `# ${stem}\n\n` : "";
    const blob = new Blob([body], { type: mime });
    const node: FileNode = {
      id,
      parentId,
      name: n,
      kind: "file",
      mime,
      size: blob.size,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      favorite: false,
      bookmark: false,
    };
    await idb.putBlob(id, await blob.arrayBuffer(), mime);
    await idb.putNode(node);
    blobCache.set(id, blob);
    set({ nodes: { ...get().nodes, [id]: node } });
    get().openViewer(id);
  },
  rename: async (id, name) => {
    const node = get().nodes[id];
    if (!node) return;
    const next = { ...node, name: name.trim() || node.name, updatedAt: Date.now() };
    await idb.putNode(next);
    set({ nodes: { ...get().nodes, [id]: next } });
  },
  remove: async (ids) => {
    const list = ids ?? get().selectedIds;
    const now = Date.now();
    const nodes = { ...get().nodes };
    const moved: FileNode[] = [];
    for (const id of list) {
      const n = nodes[id];
      if (!n || n.id === ROOT_ID || n.id === TRASH_ID) continue;
      const next = { ...n, originalParentId: n.parentId, parentId: TRASH_ID, updatedAt: now };
      nodes[id] = next;
      moved.push(next);
    }
    await idb.putNodes(moved);
    set({
      nodes,
      selectedIds: [],
      viewerId: list.includes(get().viewerId ?? "") ? null : get().viewerId,
    });
    if (moved.length) toast(`${moved.length === 1 ? "Moved" : `${moved.length} items moved`} to trash`);
  },
  restore: async (ids) => {
    const nodes = { ...get().nodes };
    const restored: FileNode[] = [];
    for (const id of ids) {
      const n = nodes[id];
      if (!n) continue;
      const parentId = n.originalParentId && nodes[n.originalParentId] ? n.originalParentId : ROOT_ID;
      const next = { ...n, parentId, originalParentId: undefined, updatedAt: Date.now() };
      nodes[id] = next;
      restored.push(next);
    }
    await idb.putNodes(restored);
    set({ nodes, selectedIds: [] });
    if (restored.length) toast.success(restored.length === 1 ? "Restored" : `Restored ${restored.length} items`);
  },
  emptyTrash: async () => {
    const nodes = { ...get().nodes };
    const top = Object.values(nodes)
      .filter((n) => n.parentId === TRASH_ID && n.id !== TRASH_ID)
      .map((n) => n.id);
    const all = [...top];
    for (const id of top) all.push(...descendants(nodes, id));
    for (const id of all) {
      delete nodes[id];
      blobCache.delete(id);
      revokeUrl(id);
      await idb.deleteNode(id);
    }
    set({ nodes, selectedIds: [] });
    await get().refreshQuota();
    toast("Trash emptied");
  },
  copyToClipboard: (mode, ids) => {
    const list = ids ?? get().selectedIds;
    if (!list.length) return;
    set({ clipboard: { mode, ids: list } });
    toast(mode === "cut" ? "Cut" : "Copied");
  },
  paste: async () => {
    const clip = get().clipboard;
    if (!clip) return;
    const parentId = get().currentFolderId();
    const nodes = { ...get().nodes };
    const now = Date.now();
    if (clip.mode === "cut") {
      const moved: FileNode[] = [];
      for (const id of clip.ids) {
        const n = nodes[id];
        if (!n) continue;
        const next = { ...n, parentId, name: uniqueName(nodes, parentId, n.name), updatedAt: now };
        nodes[id] = next;
        moved.push(next);
      }
      await idb.putNodes(moved);
      set({ nodes, clipboard: null });
      toast.success("Moved");
      return;
    }
    for (const id of clip.ids) {
      const n = nodes[id];
      if (n) await cloneNode(n, parentId, nodes, now);
    }
    await idb.putNodes(Object.values(nodes));
    set({ nodes });
    await get().refreshQuota();
    toast.success("Pasted");
  },
  toggleFavorite: async (id) => {
    const n = get().nodes[id];
    if (!n) return;
    const next = { ...n, favorite: !n.favorite };
    await idb.putNode(next);
    set({ nodes: { ...get().nodes, [id]: next } });
  },
  toggleBookmark: async (id) => {
    const n = get().nodes[id];
    if (!n) return;
    const next = { ...n, bookmark: !n.bookmark };
    await idb.putNode(next);
    set({ nodes: { ...get().nodes, [id]: next } });
  },
  ingestFiles: async (files, parentId) => {
    const dest = parentId ?? get().currentFolderId();
    const nodes = { ...get().nodes };
    const now = Date.now();
    const folderCache = new Map<string, string>();
    const ensurePath = async (segments: string[]): Promise<string> => {
      let cur = dest;
      let key = "";
      for (const seg of segments) {
        key = key ? `${key}/${seg}` : seg;
        const cached = folderCache.get(key);
        if (cached) {
          cur = cached;
          continue;
        }
        const existing = Object.values(nodes).find(
          (n) => n.parentId === cur && n.kind === "folder" && n.name === seg,
        );
        if (existing) {
          folderCache.set(key, existing.id);
          cur = existing.id;
          continue;
        }
        const id = uid("folder");
        const folder: FileNode = {
          id,
          parentId: cur,
          name: seg,
          kind: "folder",
          mime: "inode/directory",
          size: 0,
          createdAt: now,
          updatedAt: now,
          favorite: false,
          bookmark: false,
        };
        nodes[id] = folder;
        folderCache.set(key, id);
        await idb.putNode(folder);
        cur = id;
      }
      return cur;
    };
    for (const file of files) {
      const tid = get().addTransfer({ name: file.name, kind: "upload", status: "running", progress: 20 });
      try {
        const rel = (file.webkitRelativePath || "").replace(/^\/+/, "");
        const parts = rel.split("/").filter(Boolean);
        const folders = parts.length > 1 ? parts.slice(0, -1) : [];
        const parent = folders.length ? await ensurePath(folders) : dest;
        const id = uid("file");
        const buf = await file.arrayBuffer();
        const node: FileNode = {
          id,
          parentId: parent,
          name: uniqueName(nodes, parent, file.name),
          kind: "file",
          mime: file.type || mimeFromName(file.name),
          size: file.size,
          createdAt: now,
          updatedAt: now,
          favorite: false,
          bookmark: false,
        };
        await idb.putBlob(id, buf, node.mime);
        await idb.putNode(node);
        nodes[id] = node;
        blobCache.set(id, new Blob([buf], { type: node.mime }));
        get().patchTransfer(tid, { status: "done", progress: 100 });
      } catch (e) {
        get().patchTransfer(tid, {
          status: "error",
          detail: e instanceof Error ? e.message : "upload failed",
        });
      }
    }
    set({ nodes });
    await get().refreshQuota();
    await get().refreshHardware();
    if (files.length) toast.success(files.length === 1 ? `Added ${files[0].name}` : `Added ${files.length} files`);
  },
  downloadNodes: async (ids) => {
    const files = (ids ?? get().selectedIds)
      .map((id) => get().nodes[id])
      .filter((n): n is FileNode => Boolean(n && n.kind === "file"));
    if (!files.length) return;
    if (files.length > 1) {
      const tid = get().addTransfer({ name: "MediaManager.zip", kind: "download", status: "running", progress: 15 });
      try {
        const JSZip = (await import("jszip")).default;
        const zip = new JSZip();
        for (const f of files) {
          const blob = await get().getBlob(f.id);
          if (blob) zip.file(f.name, blob);
        }
        const out = await zip.generateAsync({ type: "blob" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(out);
        a.download = "MediaManager.zip";
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        get().patchTransfer(tid, { status: "done", progress: 100 });
        toast("Downloading archive");
      } catch (e) {
        get().patchTransfer(tid, {
          status: "error",
          detail: e instanceof Error ? e.message : "zip failed",
        });
      }
      return;
    }
    const file = files[0];
    const blob = await get().getBlob(file.id);
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast("Download started");
  },
  getBlob: async (id) => {
    const cached = blobCache.get(id);
    if (cached) return cached;
    const rec = await idb.getBlobRecord(id);
    if (rec) {
      const blob = new Blob([rec.data], { type: rec.mime });
      blobCache.set(id, blob);
      return blob;
    }
    const node = get().nodes[id];
    if (node?.source) {
      try {
        const res = await fetch(node.source);
        if (res.ok) {
          const blob = await res.blob();
          blobCache.set(id, blob);
          return blob;
        }
      } catch {
        return null;
      }
    }
    return null;
  },
  replaceBlob: async (id, blob, name) => {
    const node = get().nodes[id];
    if (!node) return;
    const buf = await blob.arrayBuffer();
    const mime = blob.type || node.mime;
    await idb.putBlob(id, buf, mime);
    const next = { ...node, size: blob.size, mime, updatedAt: Date.now(), name: name ?? node.name, source: undefined };
    await idb.putNode(next);
    blobCache.set(id, blob);
    revokeUrl(id);
    set({ nodes: { ...get().nodes, [id]: next } });
    toast.success("Saved");
  },
  duplicate: async (id) => {
    const node = get().nodes[id];
    if (!node) return;
    const nodes = { ...get().nodes };
    await cloneNode(node, node.parentId, nodes, Date.now());
    await idb.putNodes(Object.values(nodes));
    set({ nodes });
  },
  moveTo: async (ids, parentId) => {
    const folder = get().nodes[parentId];
    if (!folder || folder.kind !== "folder") return;
    const nodes = { ...get().nodes };
    const now = Date.now();
    const moved: FileNode[] = [];
    for (const id of ids) {
      const n = nodes[id];
      if (
        !n ||
        n.id === ROOT_ID ||
        n.id === TRASH_ID ||
        n.parentId === parentId ||
        (n.kind === "folder" && (id === parentId || descendants(nodes, id).includes(parentId)))
      ) {
        continue;
      }
      const next = { ...n, parentId, name: uniqueName(nodes, parentId, n.name), updatedAt: now };
      nodes[id] = next;
      moved.push(next);
    }
    if (!moved.length) return;
    await idb.putNodes(moved);
    set({ nodes, selectedIds: [] });
    toast.success(moved.length === 1 ? `Moved ${moved[0].name}` : `Moved ${moved.length} items`);
  },
  addTransfer: (t) => {
    const id = t.id ?? uid("tx");
    set({ transfers: [{ ...t, id }, ...get().transfers].slice(0, 40) });
    return id;
  },
  patchTransfer: (id, p) => {
    set({ transfers: get().transfers.map((t) => (t.id === id ? { ...t, ...p } : t)) });
  },
  connectDevice: async (startIn) => {
    get().goPlace("device");
    if (prefersDirectoryInput() || !fsaUsable()) {
      requestDeviceFolderInput();
      return;
    }
    const picked = await pickDirectory(startIn);
    if (!picked.handle) {
      if (picked.reason === "cancelled") return;
      requestDeviceFolderInput();
      return;
    }
    const handle = picked.handle;
    const handles = [...volumeHandles.filter((h) => h.name !== handle.name), handle];
    toast.success(`Indexing ${handle.name || "storage"}…`);
    void requestPersistentStorage();
    void get().refreshHardware();
    try {
      await scanSavedVolumes(handles, set);
      const snap = get().deviceVolumes.find((v) => v.name === (handle.name || "Storage"));
      toast.success(
        snap
          ? `${handle.name}: ${snap.files.toLocaleString()} files · ${snap.folders.toLocaleString()} folders`
          : `Opened ${handle.name || "storage"}`,
      );
    } catch {
      set({ deviceScanning: false });
      toast.error("Could not read that folder. Pick it again and allow access.");
    }
  },
  resumeDeviceAccess: async () => {
    const pending = volumeHandles;
    if (!pending.length) {
      await get().connectDevice();
      return;
    }
    const granted: FileSystemDirectoryHandle[] = [];
    for (const handle of pending) {
      if (await ensurePermission(handle)) granted.push(handle);
    }
    if (!granted.length) {
      requestDeviceFolderInput();
      toast.message("Permission still needed. Pick Internal storage or the SD card.");
      return;
    }
    await scanSavedVolumes(granted, set);
    toast.success(`Reading ${granted.length} storage volume${granted.length === 1 ? "" : "s"}`);
  },
  mountDeviceFiles: async (files) => {
    if (!files.length) return;
    scanGen += 1;
    const append = get().deviceMode === "tree" && get().deviceStatus === "ready";
    const mount = mountFileList(files, { append });
    const entries = listTreePath(append ? get().devicePath : "");
    const indexed = files.map((f) => ({
      name: f.name,
      path: (f.webkitRelativePath || f.name).replace(/^\/+/, ""),
      kind: "file" as const,
      size: f.size,
      mime: f.type || mimeFromName(f.name),
      lastModified: f.lastModified,
    }));
    set({
      deviceHandle: null,
      deviceStack: [],
      deviceEntries: entries,
      deviceStatus: "ready",
      deviceMode: "tree",
      devicePath: append ? get().devicePath : "",
      deviceRootName: append ? get().deviceRootName : mount.rootName,
      deviceFileCount: append ? get().deviceFileCount + mount.fileCount : mount.fileCount,
      deviceFolders: listTreePath("").filter((e) => e.kind === "folder").length,
      deviceBytes: append ? get().deviceBytes + mount.totalBytes : mount.totalBytes,
      deviceIndex: append ? [...get().deviceIndex, ...indexed].slice(0, 80000) : indexed,
      deviceVolumes: [
        ...(append ? get().deviceVolumes : []),
        { name: mount.rootName, files: mount.fileCount, folders: 0, bytes: mount.totalBytes },
      ],
      deviceScanning: false,
    });
    get().goPlace("device");
    toast.success(`${mount.fileCount.toLocaleString()} files from ${mount.rootName}`);
    void idb.setMeta("deviceSnapshot", {
      name: mount.rootName,
      files: append ? get().deviceFileCount : mount.fileCount,
      folders: listTreePath("").filter((e) => e.kind === "folder").length,
      bytes: append ? get().deviceBytes : mount.totalBytes,
    });
    void get().refreshHardware();
  },
  enterDeviceFolder: async (name) => {
    if (get().deviceMode === "tree") {
      const next = get().devicePath ? `${get().devicePath}/${name}` : name;
      set({ devicePath: next, deviceEntries: listTreePath(next) });
      return;
    }
    const stack = get().deviceStack;
    const cur = stack[stack.length - 1];
    if (!cur) return;
    const next = await openDeviceSubdir(cur.handle, name);
    if (!next) return;
    const entries = await listDirectory(next);
    set({ deviceStack: [...stack, { name, handle: next }], deviceEntries: entries });
  },
  deviceUp: async () => {
    if (get().deviceMode === "tree") {
      const next = treeParent(get().devicePath);
      set({ devicePath: next, deviceEntries: listTreePath(next) });
      return;
    }
    const stack = get().deviceStack.slice(0, -1);
    if (!stack.length) return;
    const cur = stack[stack.length - 1];
    set({ deviceStack: stack, deviceEntries: await listDirectory(cur.handle) });
  },
  refreshDevice: async () => {
    if (get().deviceMode === "tree") {
      set({ deviceEntries: listTreePath(get().devicePath) });
      return;
    }
    const stack = get().deviceStack;
    const cur = stack[stack.length - 1];
    if (cur) set({ deviceEntries: await listDirectory(cur.handle) });
  },
  importDeviceFile: async (name) => {
    const file = await resolveDeviceFile(get, name);
    if (file) await get().ingestFiles([file], FOLDER_IDS.downloads);
  },
  openDeviceFile: async (name) => {
    const file = await resolveDeviceFile(get, name);
    if (!file) {
      toast.error("Reconnect this folder to open the file");
      return;
    }
    const id = uid("dev");
    const buf = await file.arrayBuffer();
    const node: FileNode = {
      id,
      parentId: FOLDER_IDS.downloads,
      name: file.name,
      kind: "file",
      mime: file.type || mimeFromName(file.name),
      size: file.size,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      favorite: false,
      bookmark: false,
    };
    await idb.putBlob(id, buf, node.mime);
    await idb.putNode(node);
    blobCache.set(id, new Blob([buf], { type: node.mime }));
    set({ nodes: { ...get().nodes, [id]: node } });
    get().openViewer(id);
  },
  importDeviceFolder: async () => {
    let files: File[] = [];
    if (get().deviceMode === "tree") {
      files = filesUnderPath(get().devicePath).slice(0, 400);
    } else {
      const cur = get().deviceStack[get().deviceStack.length - 1];
      if (!cur) return;
      files = await collectDirectoryFiles(cur.handle, 400);
    }
    if (!files.length) {
      toast.error("No files in this folder");
      return;
    }
    await get().ingestFiles(files, FOLDER_IDS.downloads);
    if (files.length >= 400) toast.message("Imported the first 400 files in this tree");
  },
  setDriveItems: (driveItems, driveStatus, driveError = null) => set({ driveItems, driveStatus, driveError }),
  setDriveFolder: (id, name) => set({ driveFolderId: id, drivePath: [...get().drivePath, { id, name }] }),
  driveUp: () => {
    const path = get().drivePath;
    if (path.length <= 1) return;
    const next = path.slice(0, -1);
    set({ drivePath: next, driveFolderId: next[next.length - 1].id });
  },
  visibleNodes: () => {
    const { nodes, search, settings, recents } = get();
    const place = get().currentPlace();
    const folderId = get().currentFolderId();
    let list: FileNode[] = [];
    if (place === "favorites") list = Object.values(nodes).filter((n) => n.favorite);
    else if (place === "bookmarks") list = Object.values(nodes).filter((n) => n.bookmark);
    else if (place === "recents") list = recents.map((id) => nodes[id]).filter(Boolean);
    else if (place === "trash") list = childrenOf(nodes, TRASH_ID);
    else if (
      (["photos", "videos", "music", "documents", "archives"] as PlaceId[]).includes(place) &&
      folderId === folderForPlace(place)
    ) {
      const inFolder = childrenOf(nodes, folderId);
      const extra = Object.values(nodes).filter((n) => {
        if (n.kind !== "file" || n.parentId === TRASH_ID) return false;
        const kind = viewerKind(n.mime, n.name);
        return place === "photos"
          ? kind === "image"
          : place === "videos"
            ? kind === "video"
            : place === "music"
              ? kind === "audio"
              : place === "documents"
                ? kind === "text" || kind === "pdf"
                : place === "archives"
                  ? kind === "archive" || kind === "sqlite"
                  : false;
      });
      const seen = new Set(inFolder.map((n) => n.id));
      list = [...inFolder, ...extra.filter((n) => !seen.has(n.id))];
    } else list = childrenOf(nodes, folderId);

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((n) => n.name.toLowerCase().includes(q));
    }
    if (!settings.showHidden) list = list.filter((n) => !n.name.startsWith("."));
    const dir = settings.sortDir === "asc" ? 1 : -1;
    return list.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
      if (settings.sort === "name") return a.name.localeCompare(b.name) * dir;
      if (settings.sort === "date") return (a.updatedAt - b.updatedAt) * dir;
      if (settings.sort === "size") return (a.size - b.size) * dir;
      return a.mime.localeCompare(b.mime) * dir;
    });
  },
  breadcrumb: () => {
    const id = get().currentFolderId();
    const { nodes } = get();
    const crumbs: FileNode[] = [];
    const seen = new Set<string>();
    let cur = nodes[id];
    while (cur && !seen.has(cur.id)) {
      crumbs.unshift(cur);
      seen.add(cur.id);
      if (cur.id === ROOT_ID || cur.id === TRASH_ID || cur.parentId === cur.id) break;
      cur = nodes[cur.parentId];
    }
    return crumbs;
  },
  refreshQuota: async () => {
    let storageBytes = Object.values(get().nodes).reduce((sum, n) => sum + (n.kind === "file" ? n.size : 0), 0);
    let quotaBytes = 0;
    try {
      const est = await navigator.storage?.estimate?.();
      if (est?.usage) storageBytes = est.usage;
      if (est?.quota) quotaBytes = est.quota;
    } catch {
      /* ignore */
    }
    set({ storageBytes, quotaBytes });
  },
  refreshHardware: async () => {
    try {
      const hardware = await readHardware();
      set({
        hardware,
        storageBytes: hardware.romUsed || get().storageBytes,
        quotaBytes: hardware.romQuota || get().quotaBytes,
      });
    } catch {
      /* ignore */
    }
  },
  persistStorage: async () => {
    const ok = await requestPersistentStorage();
    await get().refreshHardware();
    toast[ok ? "success" : "error"](ok ? "Storage will stay on this device" : "Browser denied persistent storage");
  },
  resetLibrary: async () => {
    await idb.clearLibrary();
    blobCache.clear();
    for (const id of [...urlCache.keys()]) revokeUrl(id);
    const nodes = await seedLibrary();
    set({
      nodes: Object.fromEntries(nodes.map((n) => [n.id, n])),
      recents: ["file-logo", "file-orbit", "file-welcome", "file-dunes"],
      viewerId: null,
      selectedIds: [],
    });
    await get().refreshQuota();
    toast.success("Sample library restored");
  },
  shareNodes: async (ids) => {
    const nodes = (ids ?? get().selectedIds)
      .map((id) => get().nodes[id])
      .filter((n): n is FileNode => Boolean(n));
    const files: File[] = [];
    for (const n of nodes) {
      if (n.kind !== "file") continue;
      const blob = await get().getBlob(n.id);
      if (blob) files.push(new File([blob], n.name, { type: n.mime }));
    }
    if (navigator.share && files.length) {
      try {
        await navigator.share({ files, title: nodes[0]?.name });
        return;
      } catch {
        /* user cancel or unsupported files */
      }
    }
    if (navigator.share && nodes[0]) {
      try {
        await navigator.share({ title: nodes[0].name, text: `Share ${nodes[0].name} from Media Manager` });
        return;
      } catch {
        /* cancel */
      }
    }
    await get().downloadNodes(nodes.map((n) => n.id));
  },
  exportToDevice: async (ids) => {
    const handle = get().deviceHandle;
    const stack = get().deviceStack;
    if (!handle || get().deviceStatus !== "ready") {
      toast.error("Connect a device folder first");
      void get().connectDevice();
      return;
    }
    const dest = stack[stack.length - 1]?.handle ?? handle;
    const list = ids ?? get().selectedIds;
    let ok = 0;
    for (const id of list) {
      const n = get().nodes[id];
      if (!n || n.kind !== "file") continue;
      const blob = await get().getBlob(id);
      if (!blob) continue;
      const tid = get().addTransfer({ name: n.name, kind: "device", status: "running", progress: 40 });
      const wrote = await writeDeviceFile(dest, n.name, blob);
      get().patchTransfer(tid, {
        status: wrote ? "done" : "error",
        progress: wrote ? 100 : 0,
        detail: wrote ? undefined : "write failed",
      });
      if (wrote) ok += 1;
    }
    if (ok) toast.success(`Saved ${ok} file${ok === 1 ? "" : "s"} to device`);
  },
}));
