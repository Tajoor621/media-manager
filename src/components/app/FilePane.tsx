import { useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import {
  Check,
  Film,
  MoreVertical,
  Star,
  Bookmark,
} from "lucide-react";
import { objectUrlFor, useFiles } from "@/lib/files/store";
import { useShallow } from "zustand/react/shallow";
import { viewerKind } from "@/lib/files/mime";
import { formatBytes, formatDate } from "@/lib/files/format";
import { ROOT_ID, TRASH_ID, type FileNode, type PlaceId, type ViewerKind } from "@/lib/files/types";
import { FileGlyph } from "./file-icon";
import { BrandMark, BrandWordmark } from "./Brand";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui";

export function FilePane() {
  const nodes = useFiles(useShallow((s) => s.visibleNodes()));
  const viewMode = useFiles((s) => s.settings.viewMode);
  const selected = useFiles((s) => s.selectedIds);
  const selectMode = useFiles((s) => s.selectMode);
  const search = useFiles((s) => s.search);
  const place = useFiles((s) => s.currentPlace());
  const folderId = useFiles((s) => s.currentFolderId());
  const ingest = useFiles((s) => s.ingestFiles);
  const isHome = place === "internal" && folderId === ROOT_ID && !search;
  const gallery = (place === "photos" || place === "videos") && viewMode === "grid" && !search;
  const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const [dropOver, setDropOver] = useState(false);
  const [pull, setPull] = useState(0);
  const pullStart = useRef(0);
  const pulling = useRef(false);
  const childCounts = useFiles(
    useShallow((s) => {
      const m: Record<string, number> = {};
      for (const n of Object.values(s.nodes)) {
        if (n.id === n.parentId || n.id === TRASH_ID) continue;
        m[n.parentId] = (m[n.parentId] ?? 0) + 1;
      }
      return m;
    }),
  );

  useEffect(() => {
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  return (
    <div
      className="relative min-h-0 flex-1 overflow-auto px-3 pb-28 pt-2 sm:px-5"
      onDragOver={(e) => {
        e.preventDefault();
        setDropOver(true);
      }}
      onDragLeave={() => setDropOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDropOver(false);
        const files = [...e.dataTransfer.files];
        if (!files.length) return;
        if (files.some((f) => (f.webkitRelativePath || "").includes("/"))) {
          void useFiles.getState().mountDeviceFiles(files);
        } else {
          void ingest(files);
        }
      }}
      onClick={() => useFiles.getState().clearSelection()}
      onTouchStart={(e) => {
        if (e.currentTarget.scrollTop <= 0) {
          pulling.current = true;
          pullStart.current = e.touches[0].clientY;
        }
      }}
      onTouchMove={(e) => {
        if (!pulling.current) return;
        const dy = e.touches[0].clientY - pullStart.current;
        setPull(dy > 0 ? Math.min(72, dy) : 0);
      }}
      onTouchEnd={() => {
        if (pull > 52) void useFiles.getState().refreshQuota();
        pulling.current = false;
        setPull(0);
      }}
    >
      {pull > 8 && (
        <div className="flex items-end justify-center pb-2 text-xs text-gold" style={{ height: pull }}>
          {pull > 52 ? "Release to refresh" : "Pull to refresh"}
        </div>
      )}
      {dropOver && (
        <div className="pointer-events-none absolute inset-3 z-10 flex items-center justify-center rounded-xl border border-dashed border-gold/50 bg-background/60 text-sm text-gold">
          Drop to upload
        </div>
      )}
      {isHome && <HomeDashboard />}
      {isHome && <RecentsRail />}
      {!nodes.length ? (
        <Empty search={search} place={place} />
      ) : viewMode === "grid" ? (
        <div
          className={cn(
            "grid gap-3",
            gallery ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6",
          )}
        >
          {nodes.map((n) => (
            <GridCard
              key={n.id}
              node={n}
              selected={selected.includes(n.id)}
              selectMode={selectMode}
              gallery={gallery && n.kind === "file"}
              childCount={n.kind === "folder" ? (childCounts[n.id] ?? 0) : undefined}
              onMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMenu({ x: e.clientX, y: e.clientY, id: n.id });
              }}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg hairline">
          {viewMode === "details" && (
            <div className="hidden grid-cols-[1fr_120px_140px] gap-2 border-b border-border px-3 py-2 text-xs uppercase tracking-wider text-subtle sm:grid">
              <button type="button" className="text-left hover:text-gold" onClick={() => useFiles.getState().setSort("name")}>
                Name
              </button>
              <button type="button" className="text-left hover:text-gold" onClick={() => useFiles.getState().setSort("size")}>
                Size
              </button>
              <button type="button" className="text-left hover:text-gold" onClick={() => useFiles.getState().setSort("date")}>
                Modified
              </button>
            </div>
          )}
          {nodes.map((n) => (
            <ListRow
              key={n.id}
              node={n}
              details={viewMode === "details"}
              selected={selected.includes(n.id)}
              selectMode={selectMode}
              childCount={n.kind === "folder" ? (childCounts[n.id] ?? 0) : undefined}
              onMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMenu({ x: e.clientX, y: e.clientY, id: n.id });
              }}
            />
          ))}
        </div>
      )}
      {menu && <ContextMenu {...menu} onClose={() => setMenu(null)} />}
    </div>
  );
}

function HomeDashboard() {
  const files = useFiles(
    useShallow((s) =>
      Object.values(s.nodes).filter((n) => n.kind === "file" && n.parentId !== TRASH_ID && n.id !== TRASH_ID),
    ),
  );
  const storage = useFiles((s) => s.storageBytes);
  const photos = files.filter((n) => viewerKind(n.mime, n.name) === "image");
  const videos = files.filter((n) => viewerKind(n.mime, n.name) === "video");
  const music = files.filter((n) => viewerKind(n.mime, n.name) === "audio");
  const docs = files.filter((n) => {
    const k = viewerKind(n.mime, n.name);
    return k === "text" || k === "pdf";
  });
  const pick = (arr: FileNode[]) => arr.find((n) => n.favorite) ?? arr[0];
  const tiles: { place: PlaceId; label: string; count: number; cover?: FileNode; kind: ViewerKind }[] = [
    { place: "photos", label: "Photos", count: photos.length, cover: pick(photos), kind: "image" },
    { place: "videos", label: "Videos", count: videos.length, cover: pick(videos), kind: "video" },
    { place: "music", label: "Music", count: music.length, cover: pick(music), kind: "audio" },
    { place: "documents", label: "Documents", count: docs.length, cover: pick(docs), kind: "pdf" },
  ];

  return (
    <section className="mb-6">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xs text-gold">Collections</h2>
          <p className="mt-1 text-xs text-subtle tabular-nums">
            {files.length} files · {formatBytes(storage)}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => {
          const media = t.cover && (t.kind === "image" || t.kind === "video");
          return (
            <button
              key={t.place}
              type="button"
              className="overflow-hidden rounded-lg bg-card text-left hairline"
              onClick={(e) => {
                e.stopPropagation();
                useFiles.getState().goPlace(t.place);
              }}
            >
              <div className="relative aspect-4/3 bg-elevated">
                {media && t.cover ? (
                  <Thumb id={t.cover.id} kind={viewerKind(t.cover.mime, t.cover.name)} />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <FileGlyph kind={t.kind} className="size-8" />
                  </div>
                )}
                {t.kind === "video" && (
                  <span className="absolute top-2 right-2 rounded-full bg-background/75 p-1">
                    <Film className="size-3.5 text-gold" />
                  </span>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-background/75 px-2.5 py-2">
                  <p className="text-sm">{t.label}</p>
                  <p className="text-xs text-subtle tabular-nums">
                    {t.count} {t.count === 1 ? "item" : "items"}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Empty({ search, place }: { search: string; place: string }) {
  const copy =
    search
      ? `No matches for “${search}”.`
      : place === "videos"
        ? "No videos yet. Drop an MP4 or WebM here."
        : place === "photos"
          ? "No photos yet. Upload a JPEG, PNG, or WebP."
          : place === "music"
            ? "No audio yet. Drop an MP3, WAV, or FLAC."
            : place === "downloads"
              ? "Downloads is empty. Import from a device folder or the cloud."
              : place === "trash"
                ? "Trash is empty."
                : place === "favorites"
                  ? "Star a file to keep it here."
                  : "This place is empty. Upload, drop files, or open a device folder.";
  return (
    <div className="flex h-full min-h-64 flex-col items-center justify-center gap-3 text-center">
      <BrandMark className="size-20 opacity-90" alt="" />
      <BrandWordmark compact tagline className="px-4" />
      <p className="max-w-sm text-sm text-muted">{copy}</p>
    </div>
  );
}

function activate(node: FileNode, selectMode: boolean, e: MouseEvent | PointerEvent) {
  e.stopPropagation();
  const store = useFiles.getState();
  if (selectMode || e.ctrlKey || e.metaKey) {
    store.toggleSelected(node.id, true);
    return;
  }
  if (node.kind === "folder") store.openFolder(node.id);
  else store.openViewer(node.id);
}

function GridCard({
  node,
  selected,
  selectMode,
  gallery,
  childCount,
  onMenu,
}: {
  node: FileNode;
  selected: boolean;
  selectMode: boolean;
  gallery?: boolean;
  childCount?: number;
  onMenu: (e: { preventDefault: () => void; stopPropagation: () => void; clientX: number; clientY: number }) => void;
}) {
  const kind = viewerKind(node.mime, node.name);
  const [over, setOver] = useState(false);
  const media = node.kind === "file" && (kind === "image" || kind === "video");

  return (
    <article
      tabIndex={0}
      draggable
      onClick={(e) => activate(node, selectMode, e)}
      onContextMenu={onMenu}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate(node, selectMode, e as unknown as MouseEvent);
        }
      }}
      onPointerDown={(e) => {
        if (e.pointerType === "touch") {
          const t = window.setTimeout(() => {
            useFiles.getState().toggleSelected(node.id, true);
            useFiles.setState({ selectMode: true });
          }, 500);
          const up = () => window.clearTimeout(t);
          e.currentTarget.addEventListener("pointerup", up, { once: true });
          e.currentTarget.addEventListener("pointercancel", up, { once: true });
        }
      }}
      onDragStart={(e) => {
        const ids = useFiles.getState().selectedIds.includes(node.id)
          ? useFiles.getState().selectedIds
          : [node.id];
        e.dataTransfer.setData("text/mm-ids", ids.join(","));
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => {
        if (node.kind !== "folder") return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (node.kind !== "folder") return;
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        const ids = e.dataTransfer.getData("text/mm-ids");
        if (ids) {
          void useFiles.getState().moveTo(
            ids.split(",").filter((id) => id && id !== node.id),
            node.id,
          );
          return;
        }
        const files = [...e.dataTransfer.files];
        if (files.length) void useFiles.getState().ingestFiles(files, node.id);
      }}
      className={cn(
        "group relative flex cursor-pointer flex-col overflow-hidden rounded-lg bg-card text-left hairline transition-colors duration-200",
        selected && "ring-2 ring-gold",
        over && "ring-2 ring-gold bg-gold/10",
      )}
    >
      <div className={cn("relative bg-elevated", gallery ? "aspect-square" : "aspect-4/3")}>
        {media ? (
          <>
            <Thumb id={node.id} kind={kind} />
            {kind === "video" && (
              <span className="absolute bottom-2 left-2 rounded-full bg-background/75 p-1">
                <Film className="size-3.5 text-gold" />
              </span>
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <FileGlyph kind={kind} folder={node.kind === "folder"} className="size-8" />
          </div>
        )}
        {node.favorite && <Star className="absolute top-2 left-2 size-3.5 fill-gold text-gold" />}
        {(selectMode || selected) && (
          <span
            className={cn(
              "absolute top-2 right-2 flex size-5 items-center justify-center rounded-full hairline",
              selected ? "bg-gold text-gold-fg" : "bg-background/70",
            )}
          >
            {selected && <Check className="size-3" />}
          </span>
        )}
        {gallery && (
          <div className="absolute inset-x-0 bottom-0 bg-background/75 px-2 py-1.5">
            <p className="truncate text-xs">{node.name}</p>
          </div>
        )}
      </div>
      {!gallery && (
        <div className="flex items-start justify-between gap-1 px-2.5 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm">{node.name}</p>
            <p className="truncate text-xs text-subtle tabular-nums">
              {node.kind === "folder"
                ? `${childCount ?? 0} ${childCount === 1 ? "item" : "items"}`
                : formatBytes(node.size)}
            </p>
          </div>
          <button
            type="button"
            aria-label="File actions"
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-subtle opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onMenu(e);
            }}
          >
            <MoreVertical className="size-4" />
          </button>
        </div>
      )}
    </article>
  );
}

function ListRow({
  node,
  details,
  selected,
  selectMode,
  childCount,
  onMenu,
}: {
  node: FileNode;
  details: boolean;
  selected: boolean;
  selectMode: boolean;
  childCount?: number;
  onMenu: (e: MouseEvent) => void;
}) {
  const kind = viewerKind(node.mime, node.name);
  const media = node.kind === "file" && (kind === "image" || kind === "video");
  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onClick={(e) => activate(node, selectMode, e)}
      onContextMenu={onMenu}
      onKeyDown={(e) => {
        if (e.key === "Enter") activate(node, selectMode, e as unknown as MouseEvent);
      }}
      onDragStart={(e) => {
        const ids = useFiles.getState().selectedIds.includes(node.id)
          ? useFiles.getState().selectedIds
          : [node.id];
        e.dataTransfer.setData("text/mm-ids", ids.join(","));
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => {
        if (node.kind !== "folder") return;
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={(e) => {
        if (node.kind !== "folder") return;
        e.preventDefault();
        e.stopPropagation();
        const ids = e.dataTransfer.getData("text/mm-ids");
        if (ids) {
          void useFiles.getState().moveTo(
            ids.split(",").filter((id) => id && id !== node.id),
            node.id,
          );
          return;
        }
        const files = [...e.dataTransfer.files];
        if (files.length) void useFiles.getState().ingestFiles(files, node.id);
      }}
      className={cn(
        "flex items-center gap-3 border-b border-border px-3 py-2.5 text-left hover:bg-elevated",
        selected && "bg-gold/10",
        details && "sm:grid sm:grid-cols-[1fr_120px_140px]",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {media ? (
          <span className="size-9 overflow-hidden rounded-sm bg-elevated">
            <Thumb id={node.id} kind={kind} />
          </span>
        ) : (
          <FileGlyph kind={kind} folder={node.kind === "folder"} />
        )}
        <span className="min-w-0 flex-1 truncate text-sm">{node.name}</span>
        {node.favorite && <Star className="size-3 fill-gold text-gold" />}
        {node.bookmark && <Bookmark className="size-3 text-gold" />}
        <button
          type="button"
          aria-label="File actions"
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-subtle"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onMenu(e);
          }}
        >
          <MoreVertical className="size-4" />
        </button>
      </div>
      {details && (
        <>
          <span className="hidden text-xs text-muted tabular-nums sm:block">
            {node.kind === "folder" ? `${childCount ?? 0} items` : formatBytes(node.size)}
          </span>
          <span className="hidden text-xs text-muted sm:block">{formatDate(node.updatedAt)}</span>
        </>
      )}
    </div>
  );
}

function Thumb({ id, kind }: { id: string; kind?: ViewerKind }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void useFiles
      .getState()
      .getBlob(id)
      .then(async (b) => {
        if (!alive || !b) return;
        if (kind === "video") {
          const src = URL.createObjectURL(b);
          const poster = await videoPoster(src);
          URL.revokeObjectURL(src);
          if (alive) setUrl(poster);
          return;
        }
        if (alive) setUrl(objectUrlFor(id, b));
      });
    return () => {
      alive = false;
    };
  }, [id, kind]);
  if (!url) return <div className="h-full w-full bg-elevated" />;
  return <img src={url} alt="" className="h-full w-full object-cover" />;
}

function videoPoster(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.src = src;
    const fail = () => resolve(null);
    const timer = window.setTimeout(fail, 4000);
    v.onerror = () => {
      window.clearTimeout(timer);
      fail();
    };
    v.onloadeddata = () => {
      try {
        v.currentTime = Math.min(1, (v.duration || 1) * 0.08);
      } catch {
        window.clearTimeout(timer);
        fail();
      }
    };
    v.onseeked = () => {
      window.clearTimeout(timer);
      const c = document.createElement("canvas");
      c.width = 480;
      c.height = 270;
      const ctx = c.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(v, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", 0.72));
    };
  });
}

function RecentsRail() {
  const recents = useFiles(
    useShallow((s) =>
      s.recents
        .map((id) => s.nodes[id])
        .filter((n): n is FileNode => Boolean(n && n.kind === "file"))
        .slice(0, 10),
    ),
  );
  if (!recents.length) return null;
  return (
    <section className="mb-5">
      <h2 className="mb-2 font-display text-xs text-gold">Recent</h2>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {recents.map((n) => {
          const kind = viewerKind(n.mime, n.name);
          const media = kind === "image" || kind === "video";
          return (
            <button
              key={n.id}
              type="button"
              className="w-28 shrink-0 overflow-hidden rounded-lg bg-card text-left hairline"
              onClick={(e) => {
                e.stopPropagation();
                useFiles.getState().openViewer(n.id);
              }}
            >
              <div className="relative aspect-4/3 bg-elevated">
                {media ? (
                  <Thumb id={n.id} kind={kind} />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <FileGlyph kind={kind} />
                  </div>
                )}
              </div>
              <p className="truncate px-2 py-1.5 text-xs">{n.name}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ContextMenu({ x, y, id, onClose }: { x: number; y: number; id: string; onClose: () => void }) {
  const node = useFiles((s) => s.nodes[id]);
  const place = useFiles((s) => s.currentPlace());
  const [rename, setRename] = useState(false);
  const [name, setName] = useState(node?.name ?? "");
  const style = useMemo(() => {
    const left = Math.min(x, window.innerWidth - 220);
    const top = Math.min(y, window.innerHeight - 320);
    return { left, top };
  }, [x, y]);
  if (!node) return null;

  const act = (fn: () => void) => {
    fn();
    onClose();
  };

  return (
    <div
      className="fixed z-50 w-52 overflow-hidden rounded-lg bg-card py-1 shadow-2xl hairline"
      style={style}
      onClick={(e) => e.stopPropagation()}
    >
      {rename ? (
        <form
          className="p-2"
          onSubmit={(e) => {
            e.preventDefault();
            void useFiles.getState().rename(id, name);
            onClose();
          }}
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-9 w-full rounded-md bg-elevated px-2 text-sm hairline"
          />
        </form>
      ) : (
        <>
          {node.kind === "file" && (
            <Item onClick={() => act(() => useFiles.getState().openViewer(id))}>Open</Item>
          )}
          {node.kind === "folder" && (
            <>
              <Item onClick={() => act(() => useFiles.getState().openFolder(id))}>Open</Item>
              <Item onClick={() => act(() => useFiles.getState().addTab("internal", id))}>Open in new tab</Item>
            </>
          )}
          <Item onClick={() => setRename(true)}>Rename</Item>
          <Item onClick={() => act(() => void useFiles.getState().toggleFavorite(id))}>
            {node.favorite ? "Remove favorite" : "Favorite"}
          </Item>
          {node.kind === "folder" && (
            <Item onClick={() => act(() => void useFiles.getState().toggleBookmark(id))}>
              {node.bookmark ? "Remove bookmark" : "Bookmark"}
            </Item>
          )}
          <Item onClick={() => act(() => useFiles.getState().copyToClipboard("copy", [id]))}>Copy</Item>
          <Item onClick={() => act(() => useFiles.getState().copyToClipboard("cut", [id]))}>Cut</Item>
          <Item onClick={() => act(() => void useFiles.getState().duplicate(id))}>Duplicate</Item>
          <Item onClick={() => act(() => void useFiles.getState().downloadNodes([id]))}>Download</Item>
          <Item onClick={() => act(() => void useFiles.getState().shareNodes([id]))}>Share</Item>
          <Item onClick={() => act(() => void useFiles.getState().exportToDevice([id]))}>Save to device</Item>
          {node.kind === "file" && (
            <Item onClick={() => act(() => useFiles.getState().openViewer(id, "hex"))}>Hex view</Item>
          )}
          <Item onClick={() => act(() => useFiles.getState().openViewer(id, "info"))}>Properties</Item>
          {place === "trash" ? (
            <Item onClick={() => act(() => void useFiles.getState().restore([id]))}>Restore</Item>
          ) : (
            <Item onClick={() => act(() => void useFiles.getState().remove([id]))}>Move to trash</Item>
          )}
        </>
      )}
    </div>
  );
}

function Item({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      className="flex h-9 w-full items-center px-3 text-left text-sm hover:bg-elevated"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function ConfirmBar() {
  const selected = useFiles((s) => s.selectedIds);
  const place = useFiles((s) => s.currentPlace());
  const viewing = useFiles((s) => s.viewerId);
  if (!selected.length || viewing) return null;
  return (
    <div className="pointer-events-auto absolute inset-x-3 bottom-20 z-20 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-card px-3 py-2 shadow-xl hairline sm:bottom-16">
      <span className="text-sm text-muted tabular-nums">{selected.length} selected</span>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => useFiles.getState().copyToClipboard("copy")}>
          Copy
        </Button>
        <Button size="sm" variant="secondary" onClick={() => void useFiles.getState().shareNodes()}>
          Share
        </Button>
        {place === "trash" ? (
          <Button size="sm" onClick={() => void useFiles.getState().restore(selected)}>
            Restore
          </Button>
        ) : (
          <Button size="sm" variant="danger" onClick={() => void useFiles.getState().remove()}>
            Trash
          </Button>
        )}
      </div>
    </div>
  );
}
