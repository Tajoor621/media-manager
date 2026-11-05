import { useEffect, useRef, useState } from "react";
import {
  Archive,
  Bookmark,
  Cloud,
  Folder,
  HardDrive,
  Home,
  ImageIcon,
  LayoutGrid,
  List,
  Menu,
  Moon,
  Music,
  Plus,
  Radio,
  Rows3,
  Search,
  Settings,
  Star,
  Sun,
  Trash2,
  Upload,
  Film,
  Clock,
  Database,
  ArrowUp,
  ArrowUpDown,
  ClipboardPaste,
  CheckSquare,
  X,
  FilePlus,
  FolderPlus,
} from "lucide-react";
import { Toaster } from "sonner";
import { useFiles } from "@/lib/files/store";
import { useShallow } from "zustand/react/shallow";
import { viewerKind } from "@/lib/files/mime";
import { TRASH_ID, type PlaceId, type SortKey, type ViewMode } from "@/lib/files/types";
import { formatBytes } from "@/lib/files/format";
import { Button, IconButton, Input, Modal } from "@/components/ui";
import { FilePane, ConfirmBar } from "./FilePane";
import { MiniPlayer, ViewerHost } from "./Viewers";
import {
  CloudPane,
  CommandPalette,
  DevicePane,
  DevicePickers,
  NearbyPanel,
  SettingsPanel,
  StorageMeters,
} from "./Panels";
import { BrandMark, BrandWordmark } from "./Brand";
import { DuplicatesDialog } from "./DuplicatesDialog";
import { ShortcutsDialog } from "./Shortcuts";
import { cn } from "@/lib/utils";
import { OfflineIndicator } from "./OfflineIndicator";

const PLACES: { id: PlaceId; label: string; icon: typeof Home }[] = [
  { id: "internal", label: "Library", icon: Home },
  { id: "photos", label: "Photos", icon: ImageIcon },
  { id: "videos", label: "Videos", icon: Film },
  { id: "music", label: "Music", icon: Music },
  { id: "documents", label: "Documents", icon: Folder },
  { id: "downloads", label: "Downloads", icon: Upload },
  { id: "archives", label: "Archives", icon: Archive },
  { id: "projects", label: "Projects", icon: Database },
  { id: "device", label: "Device storage", icon: HardDrive },
  { id: "drive", label: "Google Drive", icon: Cloud },
  { id: "nearby", label: "Nearby", icon: Radio },
  { id: "favorites", label: "Favorites", icon: Star },
  { id: "recents", label: "Recents", icon: Clock },
  { id: "bookmarks", label: "Bookmarks", icon: Bookmark },
  { id: "trash", label: "Trash", icon: Trash2 },
];

export function AppShell() {
  const hydrate = useFiles((s) => s.hydrate);
  const theme = useFiles((s) => s.settings.theme);
  const ready = useFiles((s) => s.ready);

  useEffect(() => {
    void hydrate();
    const id = window.setInterval(() => void useFiles.getState().refreshHardware(), 12000);
    return () => window.clearInterval(id);
  }, [hydrate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      const store = useFiles.getState();
      // Do not hijack native editing shortcuts inside text fields.
      if (isTyping(e)) {
        if (e.key === "Escape") {
          (e.target as HTMLElement).blur();
        }
        return;
      }
      const key = e.key.toLowerCase();
      if (meta && key === "k") {
        e.preventDefault();
        store.setCommandOpen(true);
        return;
      }
      if (meta && e.key === ",") {
        e.preventDefault();
        store.setSettingsOpen(true);
        return;
      }
      if (meta && key === "b") {
        e.preventDefault();
        store.setSidebarOpen(!store.sidebarOpen);
        return;
      }
      if (meta && key === "a") {
        e.preventDefault();
        store.selectAll();
        return;
      }
      if (meta && key === "n") {
        e.preventDefault();
        if (["device", "drive", "nearby"].includes(store.currentPlace())) return;
        void store.askName("New folder", "New folder").then((name) => {
          if (name) void useFiles.getState().createFolder(name);
        });
        return;
      }
      if (e.key === "Escape") {
        if (store.namePrompt) {
          store.resolveNamePrompt(null);
          return;
        }
        if (store.viewerId) {
          store.closeViewer();
          return;
        }
        if (store.commandOpen) {
          store.setCommandOpen(false);
          return;
        }
        if (store.settingsOpen) {
          store.setSettingsOpen(false);
          return;
        }
        if (store.nearbyOpen) {
          store.setNearbyOpen(false);
          return;
        }
        if (store.sidebarOpen) {
          store.setSidebarOpen(false);
          return;
        }
        store.clearSelection();
        return;
      }
      if (!meta && e.key === "?") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("mm-shortcuts"));
        return;
      }
      if (meta && key === "arrowup") {
        e.preventDefault();
        store.goUp();
        return;
      }
      if (meta && key === "c") store.copyToClipboard("copy");
      if (meta && key === "x") store.copyToClipboard("cut");
      if (meta && key === "v") void store.paste();
      if (e.key === "Enter" && !isTyping(e) && !store.viewerId && store.selectedIds[0]) {
        const n = store.nodes[store.selectedIds[0]];
        if (n?.kind === "folder") store.openFolder(n.id);
        else if (n) store.openViewer(n.id);
      }
      if (e.key === "Delete" && !isTyping(e)) void store.remove();
      if (e.key === "Backspace" && !isTyping(e) && !store.viewerId) store.goUp();
      if (e.key === "F2" && store.selectedIds[0]) {
        e.preventDefault();
        const id = store.selectedIds[0];
        const node = store.nodes[id];
        if (!node) return;
        void store.askName("Rename", node.name).then((name) => {
          if (name) void store.rename(id, name);
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable))
        return;
      const files = e.clipboardData?.files;
      if (files?.length) {
        e.preventDefault();
        void useFiles.getState().ingestFiles([...files]);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  useEffect(() => {
    const w = window as Window & {
      launchQueue?: {
        setConsumer: (cb: (params: { files?: FileSystemFileHandle[] }) => void) => void;
      };
    };
    w.launchQueue?.setConsumer((params) => {
      void (async () => {
        const files: File[] = [];
        for (const handle of params.files ?? []) {
          files.push(await handle.getFile());
        }
        if (files.length) await useFiles.getState().ingestFiles(files);
      })();
    });
  }, []);

  useEffect(() => {
    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
    }
  }, []);

  useEffect(() => {
    const onMsg = (event: MessageEvent) => {
      const files = event.data?.files;
      if (event.data?.type === "mm-share" && Array.isArray(files) && files.length) {
        void useFiles.getState().ingestFiles(files);
      }
    };
    navigator.serviceWorker?.addEventListener("message", onMsg);
    return () => navigator.serviceWorker?.removeEventListener("message", onMsg);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const place = params.get("place");
    if (place && PLACES.some((p) => p.id === place)) useFiles.getState().goPlace(place as PlaceId);
  }, []);

  if (!ready) return <Splash />;

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <a className="skip-link" href="#main">
        Skip to library
      </a>
      <h1 className="sr-only">Media Manager 621</h1>
      <TopBar />
      <OfflineIndicator />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main
          id="main"
          tabIndex={-1}
          className="relative flex min-w-0 flex-1 flex-col outline-none"
        >
          <TabBar />
          <Toolbar />
          <Workspace />
          <ConfirmBar />
        </main>
      </div>
      <MiniPlayer />
      <StatusBar />
      <MobileNav />
      <ViewerHost />
      <SettingsPanel />
      <CommandPalette />
      <ShortcutsDialogHost />
      <DuplicatesDialog />
      <NearbyPanel />
      <NamePrompt />
      <DevicePickers />
      <Toaster
        theme={theme === "light" ? "light" : "dark"}
        position="bottom-center"
        toastOptions={{
          classNames: {
            toast: "bg-card text-foreground hairline",
          },
        }}
      />
    </div>
  );
}

function EmptyTrashButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="danger" onClick={() => setOpen(true)}>
        Empty trash
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Empty trash">
        <p className="text-sm text-muted">
          Permanently delete everything in Trash? This cannot be undone.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              setOpen(false);
              void useFiles.getState().emptyTrash();
            }}
          >
            Delete forever
          </Button>
        </div>
      </Modal>
    </>
  );
}

function ShortcutsDialogHost() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("mm-shortcuts", onOpen);
    return () => window.removeEventListener("mm-shortcuts", onOpen);
  }, []);
  return <ShortcutsDialog open={open} onClose={() => setOpen(false)} />;
}

function isTyping(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null;
  return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}

function Splash() {
  const error = useFiles((s) => s.error);
  return (
    <div className="mm-splash flex h-dvh flex-col items-center justify-center gap-8 px-6 text-center">
      <h1 className="sr-only">Media Manager 621</h1>
      <BrandMark className="size-28 sm:size-36" alt="" />
      <BrandWordmark tagline />
      {error ? (
        <div className="space-y-3">
          <p className="max-w-sm text-sm text-muted">{error}</p>
          <Button onClick={() => void useFiles.getState().hydrate()}>Retry</Button>
        </div>
      ) : (
        <>
          <div className="h-px w-44 overflow-hidden rounded-full bg-gold/25">
            <span className="mm-load block h-full w-2/5 bg-gold" />
          </div>
          <p className="text-xs tracking-[0.2em] text-subtle">Opening library</p>
        </>
      )}
    </div>
  );
}

function NamePrompt() {
  const prompt = useFiles((s) => s.namePrompt);
  const [value, setValue] = useState(prompt?.value ?? "");
  useEffect(() => {
    setValue(prompt?.value ?? "");
  }, [prompt]);
  if (!prompt) return null;
  return (
    <Modal open onClose={() => useFiles.getState().resolveNamePrompt(null)} title={prompt.title}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          useFiles.getState().resolveNamePrompt(value.trim() || null);
        }}
      >
        <Input autoFocus value={value} onChange={(e) => setValue(e.target.value)} />
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => useFiles.getState().resolveNamePrompt(null)}
          >
            Cancel
          </Button>
          <Button type="submit">Save</Button>
        </div>
      </form>
    </Modal>
  );
}

function TopBar() {
  const search = useFiles((s) => s.search);
  const theme = useFiles((s) => s.settings.theme);
  return (
    <header className="flex items-center gap-2 border-b border-border px-2 py-2 sm:px-4">
      <IconButton
        label="Menu"
        className="lg:hidden"
        onClick={() => useFiles.getState().setSidebarOpen(true)}
      >
        <Menu className="size-5" />
      </IconButton>
      <button
        type="button"
        className="inline-flex size-9 shrink-0 overflow-hidden rounded-full ring-1 ring-gold/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 sm:size-10"
        aria-label="Go to library"
        onClick={() => useFiles.getState().goPlace("internal")}
      >
        <BrandMark className="size-full" alt="" />
      </button>
      <div className="hidden min-w-0 sm:block">
        <BrandWordmark compact />
      </div>
      <label className="relative min-w-0 flex-1 sm:mx-6">
        <span className="sr-only">Search this place</span>
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={search}
          onChange={(e) => useFiles.getState().setSearch(e.target.value)}
          placeholder="Search this place"
          autoComplete="off"
          className="pl-10"
        />
      </label>
      <button
        type="button"
        className="hidden h-11 shrink-0 items-center gap-2 rounded-md px-2.5 text-xs text-subtle hairline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 sm:inline-flex"
        onClick={() => useFiles.getState().setCommandOpen(true)}
        aria-label="Search all"
      >
        <Search className="size-4" />
        <span className="hidden lg:inline">All</span>
        <kbd className="rounded bg-elevated px-1.5 py-0.5 text-xs text-muted">⌘K</kbd>
      </button>
      <IconButton
        label={theme === "dark" ? "Light theme" : "Dark theme"}
        onClick={() => useFiles.getState().setTheme(theme === "dark" ? "light" : "dark")}
      >
        {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
      </IconButton>
      <IconButton label="Settings" onClick={() => useFiles.getState().setSettingsOpen(true)}>
        <Settings className="size-5" />
      </IconButton>
    </header>
  );
}

function Sidebar() {
  const open = useFiles((s) => s.sidebarOpen);
  const place = useFiles((s) => s.currentPlace());
  const bookmarks = useFiles(
    useShallow((s) => Object.values(s.nodes).filter((n) => n.bookmark && n.kind === "folder")),
  );
  const counts = useFiles(
    useShallow((s) => {
      const files = Object.values(s.nodes).filter(
        (n) => n.parentId !== TRASH_ID && n.id !== TRASH_ID,
      );
      const only = files.filter((n) => n.kind === "file");
      const kind = (k: string) => only.filter((n) => viewerKind(n.mime, n.name) === k).length;
      return {
        photos: kind("image"),
        videos: kind("video"),
        music: kind("audio"),
        documents: only.filter((n) => {
          const v = viewerKind(n.mime, n.name);
          return v === "text" || v === "pdf";
        }).length,
        archives: only.filter((n) => {
          const v = viewerKind(n.mime, n.name);
          return v === "archive" || v === "sqlite";
        }).length,
        downloads: files.filter((n) => n.parentId === "folder-downloads").length,
        projects: files.filter((n) => n.parentId === "folder-projects").length,
        favorites: files.filter((n) => n.favorite).length,
        recents: s.recents.filter((id) => s.nodes[id]).length,
        trash: Object.values(s.nodes).filter((n) => n.parentId === TRASH_ID && n.id !== TRASH_ID)
          .length,
      } as Partial<Record<PlaceId, number>>;
    }),
  );

  const body = (
    <div className="flex h-full flex-col">
      <nav aria-label="Places" className="flex min-h-0 flex-1 flex-col gap-1 overflow-auto p-3">
        <p className="px-2 pb-2 font-display text-xs text-gold">Places</p>
        <button
          type="button"
          className="flex h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm text-muted hover:bg-elevated hover:text-foreground lg:hidden"
          onClick={() => {
            useFiles.getState().setSidebarOpen(false);
            useFiles.getState().setCommandOpen(true);
          }}
        >
          <Search className="size-4" />
          Search all
        </button>
        {PLACES.filter((p) => p.id !== "bookmarks").map((p) => (
          <SideItem
            key={p.id}
            active={place === p.id}
            icon={p.icon}
            label={p.label}
            count={counts[p.id]}
            onClick={() => {
              if (p.id === "nearby") useFiles.getState().setNearbyOpen(true);
              else useFiles.getState().goPlace(p.id);
            }}
          />
        ))}
        {bookmarks.length > 0 && (
          <>
            <p className="mt-4 px-2 font-display text-xs text-gold">Bookmarks</p>
            {bookmarks.map((b) => (
              <SideItem
                key={b.id}
                active={false}
                icon={Bookmark}
                label={b.name}
                onClick={() => useFiles.getState().openFolder(b.id)}
              />
            ))}
          </>
        )}
      </nav>
      <div className="border-t border-border px-3 py-3">
        <StorageMeters compact />
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden w-60 shrink-0 border-r border-border lg:block">{body}</aside>
      {open && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-background/70"
            aria-label="Close menu"
            onClick={() => useFiles.getState().setSidebarOpen(false)}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="relative h-full w-72 bg-card shadow-2xl"
          >
            {body}
          </aside>
        </div>
      )}
    </>
  );
}

function SideItem({
  active,
  icon: Icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: typeof Home;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50",
        active ? "bg-elevated text-gold" : "text-muted hover:bg-elevated hover:text-foreground",
      )}
    >
      <Icon className="size-4" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count != null && count > 0 && (
        <span className="text-xs text-subtle tabular-nums">{count}</span>
      )}
    </button>
  );
}

function TabBar() {
  const tabs = useFiles((s) => s.tabs);
  const active = useFiles((s) => s.activeTabId);
  return (
    <nav
      aria-label="Open tabs"
      className="flex items-center gap-1 overflow-x-auto border-b border-border px-2"
    >
      {tabs.map((t) => (
        <div
          key={t.id}
          className={cn(
            "flex h-10 items-center gap-1 rounded-t-md px-2 text-xs",
            t.id === active ? "bg-elevated text-gold" : "text-muted",
          )}
        >
          <button
            type="button"
            className="max-w-32 truncate rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
            aria-current={t.id === active ? "page" : undefined}
            onClick={() => useFiles.getState().setActiveTab(t.id)}
          >
            {t.title}
          </button>
          {tabs.length > 1 && (
            <button
              type="button"
              aria-label={`Close ${t.title}`}
              className="rounded p-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
              onClick={() => useFiles.getState().closeTab(t.id)}
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      ))}
      <IconButton
        label="New tab"
        className="size-8"
        onClick={() => useFiles.getState().addTab("internal")}
      >
        <Plus className="size-4" />
      </IconButton>
    </nav>
  );
}

function Toolbar() {
  const view = useFiles((s) => s.settings.viewMode);
  const sort = useFiles((s) => s.settings.sort);
  const sortDir = useFiles((s) => s.settings.sortDir);
  const crumbs = useFiles(useShallow((s) => s.breadcrumb()));
  const place = useFiles((s) => s.currentPlace());
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const selectMode = useFiles((s) => s.selectMode);
  const canMutate = place !== "device" && place !== "drive" && place !== "nearby";

  useEffect(() => {
    const el = folderRef.current;
    if (!el) return;
    el.setAttribute("webkitdirectory", "");
    el.setAttribute("directory", "");
    el.multiple = true;
  }, []);

  useEffect(() => {
    const onUpload = () => fileRef.current?.click();
    document.addEventListener("mm-open-upload", onUpload);
    return () => document.removeEventListener("mm-open-upload", onUpload);
  }, []);

  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-border px-2 py-1.5 sm:flex-wrap sm:px-3">
      <IconButton label="Up" onClick={() => useFiles.getState().goUp()}>
        <ArrowUp className="size-4" />
      </IconButton>
      <p className="min-w-0 max-w-[42%] truncate text-sm sm:hidden">
        {crumbs.at(-1)?.name ?? "Library"}
      </p>
      <nav
        aria-label="Breadcrumb"
        className="hidden min-w-0 flex-1 items-center gap-1 overflow-hidden text-xs text-muted sm:flex"
      >
        <ol className="flex min-w-0 items-center gap-1">
          {crumbs.map((c, i) => (
            <li key={c.id} className="flex min-w-0 items-center">
              {i > 0 && (
                <span className="mx-1 text-subtle" aria-hidden="true">
                  /
                </span>
              )}
              <button
                type="button"
                className="truncate rounded-sm hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
                aria-current={i === crumbs.length - 1 ? "page" : undefined}
                onClick={() => useFiles.getState().openFolder(c.id)}
              >
                {c.name}
              </button>
            </li>
          ))}
        </ol>
      </nav>
      {canMutate && (
        <>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              void useFiles
                .getState()
                .askName("New folder", "New folder")
                .then((name) => {
                  if (name) void useFiles.getState().createFolder(name);
                });
            }}
          >
            <FolderPlus className="size-3.5" />
            <span className="hidden sm:inline">New folder</span>
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="hidden sm:inline-flex"
            onClick={() => {
              void useFiles
                .getState()
                .askName("New file", "Untitled.md")
                .then((name) => {
                  if (name) void useFiles.getState().createFile(name);
                });
            }}
          >
            <FilePlus className="size-3.5" />
            New file
          </Button>
        </>
      )}
      <Button
        size="sm"
        variant="secondary"
        aria-label="Upload files"
        onClick={() => fileRef.current?.click()}
      >
        Upload
      </Button>
      <Button
        size="sm"
        variant="secondary"
        aria-label="Import a folder"
        onClick={() => folderRef.current?.click()}
      >
        Folder
      </Button>
      <input
        ref={folderRef}
        type="file"
        className="hidden"
        aria-label="Import a folder"
        multiple
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          if (files.length) void useFiles.getState().mountDeviceFiles(files);
        }}
      />
      <input
        ref={fileRef}
        type="file"
        multiple
        accept={
          place === "photos"
            ? "image/*"
            : place === "videos"
              ? "video/*"
              : place === "music"
                ? "audio/*"
                : undefined
        }
        className="hidden"
        aria-label="Upload files"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          if (files.length) void useFiles.getState().ingestFiles(files);
          e.target.value = "";
        }}
      />
      <IconButton label="Paste" onClick={() => void useFiles.getState().paste()}>
        <ClipboardPaste className="size-4" />
      </IconButton>
      <IconButton
        label={selectMode ? "Exit selection" : "Select files"}
        aria-pressed={selectMode}
        className={selectMode ? "text-gold" : ""}
        onClick={() => useFiles.getState().toggleSelectMode()}
      >
        <CheckSquare className="size-4" />
      </IconButton>
      {place === "trash" && <EmptyTrashButton />}
      <div className="ml-auto flex items-center gap-1">
        <label className="hidden items-center gap-1 text-xs text-muted sm:flex">
          <span className="sr-only">Sort by</span>
          <select
            value={sort}
            aria-label="Sort by"
            onChange={(e) => useFiles.getState().patchSettings({ sort: e.target.value as SortKey })}
            className="h-8 rounded-md bg-elevated px-2 text-xs text-foreground hairline"
          >
            <option value="name">Name</option>
            <option value="date">Date</option>
            <option value="size">Size</option>
            <option value="type">Type</option>
          </select>
        </label>
        <IconButton
          label={sortDir === "asc" ? "Sort ascending" : "Sort descending"}
          className="hidden sm:inline-flex"
          onClick={() => useFiles.getState().setSort(sort)}
        >
          <ArrowUpDown className="size-4" />
        </IconButton>
        {(["grid", "list", "details"] as ViewMode[]).map((m) => (
          <IconButton
            key={m}
            label={m === "grid" ? "Grid view" : m === "list" ? "List view" : "Details view"}
            aria-pressed={view === m}
            className={cn("size-9", view === m && "text-gold")}
            onClick={() => useFiles.getState().setViewMode(m)}
          >
            {m === "grid" ? (
              <LayoutGrid className="size-4" />
            ) : m === "list" ? (
              <List className="size-4" />
            ) : (
              <Rows3 className="size-4" />
            )}
          </IconButton>
        ))}
      </div>
    </div>
  );
}

function Workspace() {
  const place = useFiles((s) => s.currentPlace());
  if (place === "device") return <DevicePane />;
  if (place === "drive") return <CloudPane />;
  return <FilePane />;
}

function StatusBar() {
  const count = useFiles((s) => s.visibleNodes().length);
  const selected = useFiles((s) => s.selectedIds.length);
  const storage = useFiles((s) => s.storageBytes);
  const place = useFiles((s) => s.currentPlace());
  const running = useFiles((s) => s.transfers.filter((t) => t.status === "running").length);
  const placeLabel = PLACES.find((item) => item.id === place)?.label ?? place;
  const summary = `${selected > 0 ? `${selected} selected · ` : ""}${count} items · ${placeLabel}`;
  return (
    <>
      <p className="sr-only" aria-live="polite">
        {summary}
      </p>
      <footer className="hidden items-center justify-between border-t border-border px-4 py-1.5 text-xs text-subtle sm:flex">
        <span className="tabular-nums">{summary}</span>
        <span className="flex items-center gap-3 tabular-nums">
          {running > 0 && (
            <button
              type="button"
              className="text-gold hover:underline"
              onClick={() => useFiles.getState().setSettingsOpen(true)}
            >
              {running} transfer{running === 1 ? "" : "s"}
            </button>
          )}
          {formatBytes(storage)} stored
        </span>
      </footer>
    </>
  );
}

function MobileNav() {
  const place = useFiles((s) => s.currentPlace());
  const items: { id: PlaceId | "more"; label: string; icon: typeof Home }[] = [
    { id: "internal", label: "Files", icon: Home },
    { id: "device", label: "Device", icon: HardDrive },
    { id: "photos", label: "Media", icon: ImageIcon },
    { id: "more", label: "More", icon: Menu },
  ];
  return (
    <nav
      aria-label="Primary"
      className="flex border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          aria-current={it.id !== "more" && place === it.id ? "page" : undefined}
          className={cn(
            "flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold/50",
            place === it.id ? "text-gold" : "text-muted",
          )}
          onClick={() => {
            if (it.id === "more") useFiles.getState().setSidebarOpen(true);
            else if (it.id === "device") useFiles.getState().goPlace("device");
            else useFiles.getState().goPlace(it.id);
          }}
        >
          <it.icon className="size-5" />
          {it.label}
        </button>
      ))}
    </nav>
  );
}
