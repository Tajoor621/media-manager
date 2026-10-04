import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Crop,
  Download,
  Maximize,
  Pause,
  Play,
  RotateCw,
  Search,
  SkipBack,
  SkipForward,
  Subtitles,
  Volume2,
  VolumeX,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { objectUrlFor, useFiles } from "@/lib/files/store";
import { useShallow } from "zustand/react/shallow";
import { viewerKind } from "@/lib/files/mime";
import { formatBytes, formatDate, formatDuration } from "@/lib/files/format";
import { Button, IconButton, Input } from "@/components/ui";
import { BrandMark } from "./Brand";
import { cn } from "@/lib/utils";

export function ViewerHost() {
  const id = useFiles((s) => s.viewerId);
  const node = useFiles((s) => (id ? s.nodes[id] : undefined));
  const tab = useFiles((s) => s.viewerTab);
  const [blob, setBlob] = useState<Blob | null>(null);

  useEffect(() => {
    if (!id) {
      setBlob(null);
      return;
    }
    let alive = true;
    void useFiles
      .getState()
      .getBlob(id)
      .then((b) => {
        if (alive) setBlob(b);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!useFiles.getState().viewerId) return;
      if (e.key === "Escape") useFiles.getState().closeViewer();
      if (e.key === "ArrowRight") useFiles.getState().playerSkip(1);
      if (e.key === "ArrowLeft") useFiles.getState().playerSkip(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!id || !node) return null;
  const kind = viewerKind(node.mime, node.name);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95">
      <header className="flex items-center gap-2 border-b border-border px-2 py-2 sm:px-4">
        <IconButton label="Close" onClick={() => useFiles.getState().closeViewer()}>
          <X className="size-5" />
        </IconButton>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">{node.name}</p>
          <p className="text-xs text-subtle tabular-nums">
            {formatBytes(node.size)} · {formatDate(node.updatedAt)}
          </p>
        </div>
        <div className="hidden items-center gap-1 sm:flex">
          {(["preview", "hex", "info"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => useFiles.getState().setViewerTab(t)}
              className={cn(
                "h-9 rounded-md px-3 text-xs uppercase tracking-wider",
                tab === t ? "bg-elevated text-gold" : "text-muted hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <IconButton label="Download" onClick={() => void useFiles.getState().downloadNodes([id])}>
          <Download className="size-5" />
        </IconButton>
      </header>
      <div className="flex gap-1 border-b border-border px-2 py-1 sm:hidden">
        {(["preview", "hex", "info"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => useFiles.getState().setViewerTab(t)}
            className={cn(
              "h-9 flex-1 rounded-md text-xs uppercase tracking-wider",
              tab === t ? "bg-elevated text-gold" : "text-muted",
            )}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        {node.kind === "folder" || tab === "info" ? (
          <InfoView nodeId={id} />
        ) : !blob ? (
          <div className="flex h-full items-center justify-center text-sm text-muted">Loading…</div>
        ) : tab === "hex" && blob ? (
          <HexView blob={blob} />
        ) : kind === "image" && blob ? (
          <ImageView nodeId={id} blob={blob} />
        ) : kind === "video" && blob ? (
          <VideoView nodeId={id} blob={blob} />
        ) : kind === "audio" && blob ? (
          <AudioView nodeId={id} blob={blob} />
        ) : kind === "pdf" && blob ? (
          <PdfView blob={blob} />
        ) : kind === "text" && blob ? (
          <TextView nodeId={id} blob={blob} name={node.name} />
        ) : kind === "archive" && blob ? (
          <ArchiveView blob={blob} />
        ) : kind === "sqlite" && blob ? (
          <SqliteView blob={blob} />
        ) : blob ? (
          <HexView blob={blob} />
        ) : null}
      </div>
    </div>
  );
}

function useUrl(id: string, blob: Blob) {
  return objectUrlFor(id, blob);
}

function ImageView({ nodeId, blob }: { nodeId: string; blob: Blob }) {
  const url = useUrl(nodeId, blob);
  const [scale, setScale] = useState(1);
  const [rot, setRot] = useState(0);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [crop, setCrop] = useState(false);
  const [rect, setRect] = useState({ x: 0.12, y: 0.12, w: 0.76, h: 0.76 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; scale: number } | null>(null);
  const cropDrag = useRef<{
    mode: "move" | "nw" | "ne" | "sw" | "se";
    x: number;
    y: number;
    rect: typeof rect;
    box: DOMRect;
  } | null>(null);
  const siblings = useFiles(
    useShallow((s) =>
      s
        .visibleNodes()
        .filter((n) => n.kind === "file" && viewerKind(n.mime, n.name) === "image")
        .map((n) => n.id),
    ),
  );

  function onCropPointer(e: ReactPointerEvent, mode: NonNullable<typeof cropDrag.current>["mode"]) {
    e.stopPropagation();
    e.preventDefault();
    const boxEl = (e.currentTarget as HTMLElement).closest("[data-crop-box]") as HTMLElement | null;
    const box = boxEl?.getBoundingClientRect();
    if (!box) return;
    cropDrag.current = { mode, x: e.clientX, y: e.clientY, rect, box };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  return (
    <div className="relative flex h-full flex-col">
      <div
        className="relative flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden"
        onWheel={(e) => {
          e.preventDefault();
          setScale((s) => Math.min(8, Math.max(0.2, s + (e.deltaY > 0 ? -0.12 : 0.12))));
        }}
        onPointerDown={(e) => {
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (crop) return;
          if (pointers.current.size === 2) {
            const [p1, p2] = [...pointers.current.values()];
            pinch.current = { dist: Math.hypot(p1.x - p2.x, p1.y - p2.y), scale };
            drag.current = null;
          } else {
            drag.current = { x: e.clientX - tx, y: e.clientY - ty };
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          }
        }}
        onPointerMove={(e) => {
          if (cropDrag.current) {
            const d = cropDrag.current;
            const dx = (e.clientX - d.x) / d.box.width;
            const dy = (e.clientY - d.y) / d.box.height;
            const r = d.rect;
            const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
            if (d.mode === "move") {
              setRect({
                ...r,
                x: clamp(r.x + dx, 0, 1 - r.w),
                y: clamp(r.y + dy, 0, 1 - r.h),
              });
            } else {
              let { x, y, w, h } = r;
              if (d.mode.includes("n")) {
                const ny = clamp(r.y + dy, 0, r.y + r.h - 0.08);
                h = r.y + r.h - ny;
                y = ny;
              }
              if (d.mode.includes("s")) h = clamp(r.h + dy, 0.08, 1 - r.y);
              if (d.mode.includes("w")) {
                const nx = clamp(r.x + dx, 0, r.x + r.w - 0.08);
                w = r.x + r.w - nx;
                x = nx;
              }
              if (d.mode.includes("e")) w = clamp(r.w + dx, 0.08, 1 - r.x);
              setRect({ x, y, w, h });
            }
            return;
          }
          if (pointers.current.has(e.pointerId)) {
            pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          }
          if (pointers.current.size === 2 && pinch.current) {
            const [p1, p2] = [...pointers.current.values()];
            const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
            setScale(Math.min(8, Math.max(0.2, pinch.current.scale * (dist / pinch.current.dist))));
            return;
          }
          if (!drag.current || crop) return;
          setTx(e.clientX - drag.current.x);
          setTy(e.clientY - drag.current.y);
        }}
        onPointerUp={(e) => {
          pointers.current.delete(e.pointerId);
          drag.current = null;
          cropDrag.current = null;
          if (pointers.current.size < 2) pinch.current = null;
        }}
        onPointerCancel={(e) => {
          pointers.current.delete(e.pointerId);
          drag.current = null;
          cropDrag.current = null;
          pinch.current = null;
        }}
      >
        {url && (
          <div
            className="relative inline-block"
            data-crop-box="true"
            style={{
              transform: `translate(${tx}px, ${ty}px) scale(${scale}) rotate(${rot}deg)`,
            }}
          >
            <img src={url} alt="" className="viewer-image pointer-events-none block select-none" />
            {crop && (
              <div
                className="absolute border-2 border-gold bg-gold/10"
                style={{
                  left: `${rect.x * 100}%`,
                  top: `${rect.y * 100}%`,
                  width: `${rect.w * 100}%`,
                  height: `${rect.h * 100}%`,
                }}
                onPointerDown={(e) => onCropPointer(e, "move")}
              >
                {(["nw", "ne", "sw", "se"] as const).map((c) => (
                  <span
                    key={c}
                    className={cn(
                      "absolute size-3 rounded-sm bg-gold",
                      c === "nw" && "top-0 left-0 -translate-x-1/2 -translate-y-1/2",
                      c === "ne" && "top-0 right-0 translate-x-1/2 -translate-y-1/2",
                      c === "sw" && "bottom-0 left-0 -translate-x-1/2 translate-y-1/2",
                      c === "se" && "right-0 bottom-0 translate-x-1/2 translate-y-1/2",
                    )}
                    onPointerDown={(e) => onCropPointer(e, c)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1 border-t border-border px-2 py-2">
        <IconButton label="Previous" onClick={() => skipImage(siblings, nodeId, -1)}>
          <ChevronLeft className="size-5" />
        </IconButton>
        <IconButton label="Zoom out" onClick={() => setScale((s) => Math.max(0.2, s - 0.2))}>
          <ZoomOut className="size-5" />
        </IconButton>
        <IconButton label="Zoom in" onClick={() => setScale((s) => Math.min(8, s + 0.2))}>
          <ZoomIn className="size-5" />
        </IconButton>
        <IconButton label="Rotate" onClick={() => setRot((r) => r + 90)}>
          <RotateCw className="size-5" />
        </IconButton>
        <IconButton label="Crop" className={crop ? "text-gold" : ""} onClick={() => setCrop((c) => !c)}>
          <Crop className="size-5" />
        </IconButton>
        {crop && (
          <Button size="sm" onClick={() => void saveCrop(nodeId, url, rect)}>
            Save crop
          </Button>
        )}
        {rot !== 0 && (
          <Button size="sm" variant="secondary" onClick={() => void saveRotated(nodeId, url, rot)}>
            Save rotation
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={() => void saveResized(nodeId, url, 0.5)}>
          Half size
        </Button>
        <IconButton label="Next" onClick={() => skipImage(siblings, nodeId, 1)}>
          <ChevronRight className="size-5" />
        </IconButton>
        <Slideshow ids={siblings} current={nodeId} />
      </div>
    </div>
  );
}

function skipImage(ids: string[], current: string, dir: number) {
  const i = ids.indexOf(current);
  if (i < 0 || !ids.length) return;
  const next = ids[(i + dir + ids.length) % ids.length];
  useFiles.getState().openViewer(next);
}

function Slideshow({ ids, current }: { ids: string[]; current: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!on) return;
    const t = window.setInterval(() => skipImage(ids, useFiles.getState().viewerId ?? current, 1), 2800);
    return () => window.clearInterval(t);
  }, [on, ids, current]);
  return (
    <Button size="sm" variant={on ? "default" : "secondary"} onClick={() => setOn((v) => !v)}>
      Slideshow
    </Button>
  );
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = url;
  });
}

async function saveCrop(
  id: string,
  url: string,
  rect: { x: number; y: number; w: number; h: number },
) {
  const img = await loadImage(url);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * rect.w));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * rect.h));
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.drawImage(
    img,
    img.naturalWidth * rect.x,
    img.naturalHeight * rect.y,
    img.naturalWidth * rect.w,
    img.naturalHeight * rect.h,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.92));
  if (blob) await useFiles.getState().replaceBlob(id, blob);
}

async function saveRotated(id: string, url: string, rot: number) {
  const img = await loadImage(url);
  const rad = ((rot % 360) * Math.PI) / 180;
  const swap = Math.abs(rot % 180) === 90;
  const canvas = document.createElement("canvas");
  canvas.width = swap ? img.naturalHeight : img.naturalWidth;
  canvas.height = swap ? img.naturalWidth : img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rad);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.92));
  if (blob) await useFiles.getState().replaceBlob(id, blob);
}

async function saveResized(id: string, url: string, factor: number) {
  const img = await loadImage(url);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * factor));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * factor));
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const out = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.92));
  if (out) await useFiles.getState().replaceBlob(id, out);
}

function VideoView({ nodeId, blob }: { nodeId: string; blob: Blob }) {
  const url = useUrl(nodeId, blob);
  const ref = useRef<HTMLVideoElement>(null);
  const [rate, setRate] = useState(1);
  const [playing, setLocal] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const [vol, setVol] = useState(1);
  const [muted, setMuted] = useState(false);
  const [captionsUrl, setCaptionsUrl] = useState<string | null>(null);
  const [cc, setCc] = useState(false);
  const autoPlay = useFiles((s) => s.settings.autoPlay);

  useEffect(() => {
    let alive = true;
    let created: string | null = null;
    const nodes = useFiles.getState().nodes;
    const node = nodes[nodeId];
    if (!node) return;
    const base = node.name.replace(/\.[^.]+$/, "").toLowerCase();
    const cap = Object.values(nodes).find((n) => {
      if (n.parentId !== node.parentId || n.kind !== "file") return false;
      const ext = n.name.split(".").pop()?.toLowerCase();
      if (ext !== "vtt" && ext !== "srt") return false;
      return n.name.replace(/\.[^.]+$/, "").toLowerCase() === base;
    });
    if (!cap) {
      setCaptionsUrl(null);
      return;
    }
    void useFiles
      .getState()
      .getBlob(cap.id)
      .then(async (b) => {
        if (!alive || !b) return;
        let text = await b.text();
        if (cap.name.toLowerCase().endsWith(".srt")) {
          text = `WEBVTT\n\n${text.replace(/\r/g, "").replace(/(\d+:\d+:\d+),(\d+)/g, "$1.$2")}`;
        }
        created = URL.createObjectURL(new Blob([text], { type: "text/vtt" }));
        if (alive) setCaptionsUrl(created);
      });
    return () => {
      alive = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [nodeId]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== " " || isFormField(e.target)) return;
      e.preventDefault();
      if (el.paused) void el.play();
      else el.pause();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [url]);

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="relative min-h-0 flex-1 bg-background">
        <video
          ref={ref}
          src={url}
          className="h-full w-full object-contain"
          playsInline
          autoPlay={autoPlay}
          onClick={() => {
            const el = ref.current;
            if (!el) return;
            if (el.paused) void el.play();
            else el.pause();
          }}
          onPlay={() => {
            setLocal(true);
            useFiles.getState().setPlaying(true);
          }}
          onPause={() => {
            setLocal(false);
            useFiles.getState().setPlaying(false);
          }}
          onTimeUpdate={() => {
            const el = ref.current;
            if (el) setT(el.currentTime);
          }}
          onLoadedMetadata={() => {
            const el = ref.current;
            if (el) setDur(el.duration || 0);
          }}
          onEnded={() => useFiles.getState().playerSkip(1)}
        >
          {captionsUrl && (
            <track kind="subtitles" src={captionsUrl} srcLang="en" label="Captions" default={cc} />
          )}
        </video>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2">
        <IconButton
          label="Back 10 seconds"
          onClick={() => {
            const el = ref.current;
            if (el) el.currentTime = Math.max(0, el.currentTime - 10);
          }}
        >
          <SkipBack className="size-4" />
        </IconButton>
        <IconButton
          label={playing ? "Pause" : "Play"}
          onClick={() => {
            const el = ref.current;
            if (!el) return;
            if (el.paused) void el.play();
            else el.pause();
          }}
        >
          {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
        </IconButton>
        <IconButton
          label="Forward 10 seconds"
          onClick={() => {
            const el = ref.current;
            if (el) el.currentTime = Math.min(el.duration || 0, el.currentTime + 10);
          }}
        >
          <SkipForward className="size-4" />
        </IconButton>
        <span className="min-w-16 text-xs text-muted tabular-nums">
          {formatDuration(t)} / {formatDuration(dur)}
        </span>
        <input
          type="range"
          min={0}
          max={dur || 0}
          step={0.1}
          value={t}
          aria-label="Seek"
          className="h-1 min-w-24 flex-1 accent-gold"
          onChange={(e) => {
            const v = Number(e.target.value);
            setT(v);
            if (ref.current) ref.current.currentTime = v;
          }}
        />
        <IconButton
          label={muted ? "Unmute" : "Mute"}
          onClick={() => {
            const el = ref.current;
            if (!el) return;
            el.muted = !el.muted;
            setMuted(el.muted);
          }}
        >
          {muted || vol === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </IconButton>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={muted ? 0 : vol}
          aria-label="Volume"
          className="h-1 w-20 accent-gold"
          onChange={(e) => {
            const v = Number(e.target.value);
            setVol(v);
            setMuted(v === 0);
            if (ref.current) {
              ref.current.volume = v;
              ref.current.muted = v === 0;
            }
          }}
        />
        <label className="text-xs text-muted">
          Speed
          <select
            className="ml-2 h-8 rounded-md bg-elevated px-2 text-foreground hairline"
            value={rate}
            onChange={(e) => {
              const v = Number(e.target.value);
              setRate(v);
              if (ref.current) ref.current.playbackRate = v;
            }}
          >
            {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
              <option key={r} value={r}>
                {r}×
              </option>
            ))}
          </select>
        </label>
        {captionsUrl && (
          <IconButton
            label="Captions"
            className={cc ? "text-gold" : ""}
            onClick={() => {
              const el = ref.current;
              const next = !cc;
              setCc(next);
              if (el?.textTracks[0]) el.textTracks[0].mode = next ? "showing" : "hidden";
            }}
          >
            <Subtitles className="size-4" />
          </IconButton>
        )}
        <Button size="sm" variant="secondary" onClick={() => void ref.current?.requestFullscreen()}>
          <Maximize className="size-3.5" /> Fullscreen
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            const el = ref.current;
            if (el && "requestPictureInPicture" in el) void el.requestPictureInPicture();
          }}
        >
          PiP
        </Button>
      </div>
    </div>
  );
}

function isFormField(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable;
}

function AudioView({ nodeId, blob }: { nodeId: string; blob: Blob }) {
  const url = useUrl(nodeId, blob);
  const audio = useRef<HTMLAudioElement>(null);
  const [el, setEl] = useState<HTMLAudioElement | null>(null);
  const node = useFiles((s) => s.nodes[nodeId]);
  const player = useFiles((s) => s.player);
  const autoPlay = useFiles((s) => s.settings.autoPlay);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const [vol, setVol] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);

  useEffect(() => {
    return bindMediaSession(node?.name ?? "Audio", {
      play: () => {
        void audio.current?.play();
        useFiles.getState().setPlaying(true);
      },
      pause: () => {
        audio.current?.pause();
        useFiles.getState().setPlaying(false);
      },
    });
  }, [node?.name]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-6">
      <BrandMark className="size-28" />
      {el && <AudioViz el={el} />}
      <p className="max-w-xl truncate text-sm">{node?.name}</p>
      <audio
        key={url}
        ref={(n) => {
          audio.current = n;
          setEl(n);
        }}
        src={url}
        className="hidden"
        autoPlay={autoPlay}
        onEnded={() => useFiles.getState().playerSkip(1)}
        onPlay={() => useFiles.getState().setPlaying(true)}
        onPause={() => useFiles.getState().setPlaying(false)}
        onTimeUpdate={() => {
          if (audio.current) setT(audio.current.currentTime);
        }}
        onLoadedMetadata={() => {
          if (audio.current) setDur(audio.current.duration || 0);
        }}
      />
      <div className="flex w-full max-w-xl items-center gap-3">
        <span className="min-w-10 text-xs text-muted tabular-nums">{formatDuration(t)}</span>
        <input
          type="range"
          min={0}
          max={dur || 0}
          step={0.1}
          value={t}
          aria-label="Seek"
          className="h-1 flex-1 accent-gold"
          onChange={(e) => {
            const v = Number(e.target.value);
            setT(v);
            if (audio.current) audio.current.currentTime = v;
          }}
        />
        <span className="min-w-10 text-right text-xs text-muted tabular-nums">{formatDuration(dur)}</span>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <IconButton label="Previous track" onClick={() => useFiles.getState().playerSkip(-1)}>
          <SkipBack className="size-5" />
        </IconButton>
        <IconButton
          label={player?.playing ? "Pause" : "Play"}
          onClick={() => {
            const a = audio.current;
            if (!a) return;
            if (a.paused) void a.play();
            else a.pause();
          }}
        >
          {player?.playing ? <Pause className="size-6" /> : <Play className="size-6" />}
        </IconButton>
        <IconButton label="Next track" onClick={() => useFiles.getState().playerSkip(1)}>
          <SkipForward className="size-5" />
        </IconButton>
        <IconButton
          label={muted ? "Unmute" : "Mute"}
          onClick={() => {
            const a = audio.current;
            if (!a) return;
            a.muted = !a.muted;
            setMuted(a.muted);
          }}
        >
          {muted || vol === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </IconButton>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={muted ? 0 : vol}
          aria-label="Volume"
          className="h-1 w-20 accent-gold"
          onChange={(e) => {
            const v = Number(e.target.value);
            setVol(v);
            setMuted(v === 0);
            if (audio.current) {
              audio.current.volume = v;
              audio.current.muted = v === 0;
            }
          }}
        />
        <label className="text-xs text-muted">
          Speed
          <select
            className="ml-2 h-8 rounded-md bg-elevated px-2 text-foreground hairline"
            value={rate}
            onChange={(e) => {
              const v = Number(e.target.value);
              setRate(v);
              if (audio.current) audio.current.playbackRate = v;
            }}
          >
            {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
              <option key={r} value={r}>
                {r}×
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

function AudioViz({ el }: { el: HTMLAudioElement }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    let ctx: AudioContext;
    try {
      ctx = new AudioContext();
    } catch {
      return;
    }
    let src: MediaElementAudioSourceNode;
    try {
      src = ctx.createMediaElementSource(el);
    } catch {
      void ctx.close();
      return;
    }
    const anal = ctx.createAnalyser();
    anal.fftSize = 256;
    src.connect(anal);
    anal.connect(ctx.destination);
    const data = new Uint8Array(anal.frequencyBinCount);
    const g = cv.getContext("2d");
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      if (!g) return;
      anal.getByteFrequencyData(data);
      const { width, height } = cv;
      g.clearRect(0, 0, width, height);
      const styles = getComputedStyle(document.documentElement);
      const gold = styles.getPropertyValue("--gold").trim() || "#c6a15b";
      const silver = styles.getPropertyValue("--silver").trim() || "#c8ccd4";
      const w = width / data.length;
      for (let i = 0; i < data.length; i++) {
        const h = (data[i] / 255) * height;
        g.fillStyle = i % 4 === 0 ? gold : silver;
        g.fillRect(i * w, height - h, Math.max(1, w - 1), h);
      }
    };
    draw();
    const resume = () => void ctx.resume();
    el.addEventListener("play", resume);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("play", resume);
      void ctx.close();
    };
  }, [el]);
  return <canvas ref={canvas} width={560} height={120} className="h-24 w-full max-w-xl" />;
}

function bindMediaSession(
  title: string,
  opts: { play: () => void; pause: () => void },
) {
  if (!("mediaSession" in navigator)) return () => undefined;
  navigator.mediaSession.metadata = new MediaMetadata({
    title,
    artist: "Media Manager",
    album: "621 / FileManager",
    artwork: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  });
  navigator.mediaSession.setActionHandler("play", opts.play);
  navigator.mediaSession.setActionHandler("pause", opts.pause);
  navigator.mediaSession.setActionHandler("previoustrack", () => useFiles.getState().playerSkip(-1));
  navigator.mediaSession.setActionHandler("nexttrack", () => useFiles.getState().playerSkip(1));
  return () => {
    navigator.mediaSession.setActionHandler("play", null);
    navigator.mediaSession.setActionHandler("pause", null);
    navigator.mediaSession.setActionHandler("previoustrack", null);
    navigator.mediaSession.setActionHandler("nexttrack", null);
  };
}

function PdfView({ blob }: { blob: Blob }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [zoom, setZoom] = useState(1.15);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const pdfRef = useRef<import("pdfjs-dist").PDFDocumentProxy | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
        pdfjs.GlobalWorkerOptions.workerSrc = String(worker.default);
        const data = await blob.arrayBuffer();
        const doc = await pdfjs.getDocument({ data }).promise;
        if (!alive) return;
        pdfRef.current = doc;
        setPages(doc.numPages);
        setPage(1);
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : "Could not open PDF");
      }
    })();
    return () => {
      alive = false;
    };
  }, [blob]);

  useEffect(() => {
    const doc = pdfRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;
    let cancel = false;
    (async () => {
      const pg = await doc.getPage(page);
      if (cancel) return;
      const viewport = pg.getViewport({ scale: zoom });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      await pg.render({ canvasContext: ctx, canvas, viewport }).promise;
    })();
    return () => {
      cancel = true;
    };
  }, [page, zoom, blob, pages]);

  async function search() {
    const doc = pdfRef.current;
    if (!doc || !q.trim()) return;
    const needle = q.toLowerCase();
    let count = 0;
    for (let i = 1; i <= doc.numPages; i++) {
      const pg = await doc.getPage(i);
      const text = await pg.getTextContent();
      const hay = text.items
          .map((it) => (typeof it === "object" && it && "str" in it ? String(it.str) : ""))
          .join(" ")
          .toLowerCase();
      if (hay.includes(needle)) {
        count += 1;
        if (count === 1) setPage(i);
      }
    }
    setHits(count);
  }

  if (err) {
    return <PdfFallback blob={blob} err={err} />;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <IconButton label="Previous page" onClick={() => setPage((p) => Math.max(1, p - 1))}>
          <ChevronLeft className="size-5" />
        </IconButton>
        <span className="text-xs text-muted tabular-nums">
          {page} / {pages}
        </span>
        <IconButton label="Next page" onClick={() => setPage((p) => Math.min(pages, p + 1))}>
          <ChevronRight className="size-5" />
        </IconButton>
        <IconButton label="Zoom out" onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))}>
          <ZoomOut className="size-5" />
        </IconButton>
        <IconButton label="Zoom in" onClick={() => setZoom((z) => Math.min(3, z + 0.15))}>
          <ZoomIn className="size-5" />
        </IconButton>
        <form
          className="ml-auto flex min-w-0 flex-1 items-center gap-2 sm:max-w-xs"
          onSubmit={(e) => {
            e.preventDefault();
            void search();
          }}
        >
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search text" />
          <IconButton label="Search" onClick={() => void search()}>
            <Search className="size-4" />
          </IconButton>
        </form>
        {hits > 0 && <span className="text-xs text-gold tabular-nums">{hits} pages</span>}
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-elevated p-4">
        <canvas ref={canvasRef} className="mx-auto max-w-full bg-card shadow-xl" />
      </div>
    </div>
  );
}

function PdfFallback({ blob, err }: { blob: Blob; err: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-sm text-muted">{err}</p>
      {url && <object data={url} type="application/pdf" className="h-80 w-full max-w-xl" />}
    </div>
  );
}

function TextView({ nodeId, blob, name }: { nodeId: string; blob: Blob; name: string }) {
  const [text, setText] = useState("");
  const [find, setFind] = useState("");
  const [repl, setRepl] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    void blob.text().then(setText);
  }, [blob]);
  const html = highlight(text, name);

  function findNext() {
    const ta = area.current;
    if (!ta || !find) return;
    const from = ta.selectionStart + (ta.selectionEnd > ta.selectionStart ? 1 : 0);
    let i = text.indexOf(find, from);
    if (i < 0) i = text.indexOf(find);
    if (i < 0) return;
    ta.focus();
    ta.setSelectionRange(i, i + find.length);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <Input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find" className="max-w-40" />
        <Input value={repl} onChange={(e) => setRepl(e.target.value)} placeholder="Replace" className="max-w-40" />
        <Button size="sm" variant="secondary" onClick={findNext}>
          Find
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => find && setText((t) => t.replaceAll(find, repl))}
        >
          Replace all
        </Button>
        <Button
          size="sm"
          onClick={() => {
            void useFiles
              .getState()
              .replaceBlob(nodeId, new Blob([text], { type: blob.type || "text/plain" }))
              .then(() => undefined);
          }}
        >
          Save
        </Button>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
        <textarea
          ref={area}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="h-full min-h-64 resize-none bg-background p-4 font-mono text-sm outline-none"
          spellCheck={false}
        />
        <pre
          className="hidden h-full overflow-auto bg-elevated p-4 font-mono text-sm lg:block"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}

function escapeHtml(src: string): string {
  return src
    .replace(/&/g, "\u0026amp;")
    .replace(/</g, "\u0026lt;")
    .replace(/>/g, "\u0026gt;");
}

function highlight(src: string, name: string): string {
  const esc = escapeHtml(src);
  if (name.endsWith(".md")) {
    return esc
      .replace(/^### (.*)$/gm, '<span class="tok-fn">### $1</span>')
      .replace(/^## (.*)$/gm, '<span class="tok-fn">## $1</span>')
      .replace(/^# (.*)$/gm, '<span class="tok-kw"># $1</span>')
      .replace(/`([^`]+)`/g, '<span class="tok-str">`$1`</span>');
  }
  return esc
    .replace(/(\/\/.*|#.*)$/gm, '<span class="tok-cm">$1</span>')
    .replace(
      /\b(const|let|var|export|import|from|return|function|async|await|type|interface|as const)\b/g,
      '<span class="tok-kw">$1</span>',
    )
    .replace(/("[^"]*"|'[^']*')/g, '<span class="tok-str">$1</span>')
    .replace(/\b(\d+)\b/g, '<span class="tok-num">$1</span>');
}

function HexView({ blob }: { blob: Blob }) {
  const [rows, setRows] = useState<{ off: string; hex: string; ascii: string }[]>([]);
  const [total, setTotal] = useState(0);
  useEffect(() => {
    void blob.arrayBuffer().then((buf) => {
      const view = new Uint8Array(buf);
      setTotal(view.byteLength);
      const max = Math.min(view.byteLength, 64 * 1024);
      const out = [];
      for (let i = 0; i < max; i += 16) {
        const slice = view.subarray(i, Math.min(i + 16, max));
        const hex = [...slice].map((b) => b.toString(16).padStart(2, "0")).join(" ");
        const ascii = [...slice].map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : ".")).join("");
        out.push({ off: i.toString(16).padStart(8, "0"), hex, ascii });
      }
      setRows(out);
    });
  }, [blob]);
  return (
    <div className="h-full overflow-auto p-4 font-mono text-xs">
      <p className="mb-3 text-subtle">
        Showing {Math.min(total, 65536).toLocaleString()} of {total.toLocaleString()} bytes
      </p>
      <table className="w-full border-separate border-spacing-y-0.5">
        <tbody>
          {rows.map((r) => (
            <tr key={r.off}>
              <td className="pr-4 text-gold tabular-nums">{r.off}</td>
              <td className="pr-4 text-silver">{r.hex}</td>
              <td className="text-muted">{r.ascii}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ArchiveView({ blob }: { blob: Blob }) {
  const [entries, setEntries] = useState<{ name: string; size: number; dir: boolean }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const zipRef = useRef<import("jszip") | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const JSZip = (await import("jszip")).default;
        const zip = await JSZip.loadAsync(blob);
        zipRef.current = zip;
        if (!alive) return;
        const list = Object.values(zip.files).map((f) => ({
          name: f.name,
          size: (f as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0,
          dir: f.dir,
        }));
        setEntries(list);
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : "Could not read archive. ZIP is supported; RAR/7z need extra codecs.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [blob]);

  async function extract(name: string) {
    const zip = zipRef.current;
    if (!zip) return;
    const file = zip.file(name);
    if (!file) return;
    const buf = await file.async("arraybuffer");
    const blobOut = new File([buf], name.split("/").pop() ?? name);
    await useFiles.getState().ingestFiles([blobOut]);
  }

  if (err) return <p className="p-6 text-sm text-muted">{err}</p>;
  return (
    <div className="h-full overflow-auto p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-wider text-subtle">{entries.length} entries</p>
        <Button
          size="sm"
          variant="secondary"
          onClick={async () => {
            const zip = zipRef.current;
            if (!zip) return;
            const files: File[] = [];
            for (const e of entries) {
              if (e.dir) continue;
              const file = zip.file(e.name);
              if (!file) continue;
              const buf = await file.async("arraybuffer");
              files.push(new File([buf], e.name.split("/").pop() ?? e.name));
            }
            if (files.length) await useFiles.getState().ingestFiles(files);
          }}
        >
          Extract all
        </Button>
      </div>
      <ul className="divide-y divide-border rounded-lg hairline">
        {entries.map((e) => (
          <li key={e.name} className="flex items-center justify-between gap-3 px-3 py-2">
            <span className="truncate text-sm">{e.name}</span>
            {!e.dir && (
              <Button size="sm" variant="secondary" onClick={() => void extract(e.name)}>
                Extract
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SqliteView({ blob }: { blob: Blob }) {
  const [tables, setTables] = useState<string[]>([]);
  const [table, setTable] = useState("");
  const [cols, setCols] = useState<string[]>([]);
  const [rows, setRows] = useState<unknown[][]>([]);
  const [sql, setSql] = useState("SELECT name FROM sqlite_master WHERE type='table';");
  const [err, setErr] = useState<string | null>(null);
  const dbRef = useRef<{ exec: (s: string) => { columns: string[]; values: unknown[][] }[] } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const initSqlJs = (await import("sql.js")).default;
        const wasm = await import("sql.js/dist/sql-wasm.wasm?url");
        const SQL = await initSqlJs({ locateFile: () => wasm.default });
        const data = new Uint8Array(await blob.arrayBuffer());
        const db = new SQL.Database(data);
        if (!alive) return;
        dbRef.current = db;
        const res = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;");
        const names = (res[0]?.values ?? []).map((v: (string | number | null | Uint8Array)[]) => String(v[0]));
        setTables(names);
        if (names[0]) {
          setTable(names[0]);
          runOn(db, `SELECT * FROM "${names[0]}" LIMIT 200;`);
        }
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : "Could not open SQLite file");
      }
    })();
    return () => {
      alive = false;
    };
  }, [blob]);

  function runOn(db: NonNullable<typeof dbRef.current>, q: string) {
    try {
      const res = db.exec(q);
      const first = res[0];
      setCols(first?.columns ?? []);
      setRows(first?.values ?? []);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Query failed");
    }
  }

  if (err && !tables.length) return <p className="p-6 text-sm text-muted">{err}</p>;
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap gap-2 border-b border-border px-3 py-2">
        {tables.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTable(t);
              if (dbRef.current) runOn(dbRef.current, `SELECT * FROM "${t}" LIMIT 200;`);
            }}
            className={cn(
              "h-8 rounded-md px-3 text-xs",
              table === t ? "bg-gold text-gold-fg" : "bg-elevated text-muted",
            )}
          >
            {t}
          </button>
        ))}
      </div>
      <form
        className="flex gap-2 border-b border-border p-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (dbRef.current) runOn(dbRef.current, sql);
        }}
      >
        <Input value={sql} onChange={(e) => setSql(e.target.value)} className="font-mono text-xs" />
        <Button size="sm">Run</Button>
      </form>
      {err && <p className="px-3 py-2 text-xs text-danger">{err}</p>}
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-card">
            <tr>
              {cols.map((c) => (
                <th key={c} className="border-b border-border px-3 py-2 text-xs font-medium text-gold">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="odd:bg-elevated/50">
                {r.map((c, j) => (
                  <td key={j} className="px-3 py-1.5 font-mono text-xs">
                    {String(c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InfoView({ nodeId }: { nodeId: string }) {
  const node = useFiles((s) => s.nodes[nodeId]);
  const parent = useFiles((s) => (node ? s.nodes[node.parentId] : undefined));
  if (!node) return null;
  const rows = [
    ["Name", node.name],
    ["Location", parent?.name ?? "Library"],
    ["Type", node.kind === "folder" ? "Folder" : node.mime],
    ["Size", formatBytes(node.size)],
    ["Created", formatDate(node.createdAt)],
    ["Modified", formatDate(node.updatedAt)],
    ["Favorite", node.favorite ? "Yes" : "No"],
  ];
  return (
    <dl className="mx-auto max-w-lg space-y-3 p-6">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 border-b border-border py-2">
          <dt className="text-xs uppercase tracking-wider text-subtle">{k}</dt>
          <dd className="text-sm">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function MiniPlayer() {
  const player = useFiles((s) => s.player);
  const node = useFiles((s) => (player ? s.nodes[player.queue[player.index]] : undefined));
  const viewer = useFiles((s) => s.viewerId);
  const [url, setUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);

  useEffect(() => {
    if (!player || !node) return;
    const kind = viewerKind(node.mime, node.name);
    if (kind !== "audio") {
      setUrl(null);
      return;
    }
    void useFiles
      .getState()
      .getBlob(node.id)
      .then((b) => {
        if (b) setUrl(objectUrlFor(node.id, b));
      });
  }, [player, node]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (player?.playing) void el.play().catch(() => undefined);
    else el.pause();
  }, [player?.playing, url]);

  useEffect(() => {
    if (!node) return;
    return bindMediaSession(node.name, {
      play: () => useFiles.getState().setPlaying(true),
      pause: () => useFiles.getState().setPlaying(false),
    });
  }, [node]);

  if (!player || !node || viewer) return null;
  const kind = viewerKind(node.mime, node.name);
  if (kind !== "audio") return null;

  return (
    <div className="relative flex items-center gap-3 border-t border-border bg-card px-3 py-2">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-elevated">
        <div className="h-full bg-gold" style={{ width: `${dur ? Math.min(100, (t / dur) * 100) : 0}%` }} />
      </div>
      <button
        type="button"
        className="shrink-0"
        onClick={() => useFiles.getState().openViewer(node.id)}
        aria-label="Open player"
      >
        <BrandMark className="size-9" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{node.name}</p>
        <p className="text-xs text-subtle tabular-nums">
          {formatDuration(t)} / {formatDuration(dur)}
        </p>
      </div>
      <IconButton label="Previous" onClick={() => useFiles.getState().playerSkip(-1)}>
        <SkipBack className="size-4" />
      </IconButton>
      <IconButton
        label={player.playing ? "Pause" : "Play"}
        onClick={() => useFiles.getState().setPlaying(!player.playing)}
      >
        {player.playing ? <Pause className="size-4" /> : <Play className="size-4" />}
      </IconButton>
      <IconButton label="Next" onClick={() => useFiles.getState().playerSkip(1)}>
        <SkipForward className="size-4" />
      </IconButton>
      {url && (
        <audio
          ref={audioRef}
          src={url}
          onEnded={() => useFiles.getState().playerSkip(1)}
          onTimeUpdate={() => {
            const el = audioRef.current;
            if (el) {
              setT(el.currentTime);
              setDur(el.duration || 0);
            }
          }}
          className="hidden"
        />
      )}
    </div>
  );
}

export function formatPlayTime(sec: number) {
  return formatDuration(sec);
}
