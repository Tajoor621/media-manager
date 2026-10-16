import type { ComponentType } from "react";
import { Archive, Clock, Database, FileSearch, FolderOpen, HardDrive, Heart, Images, Music, Star, Trash2, Upload, Video, type LucideProps } from "lucide-react";
import { Button } from "@/components/ui";
import { useFiles } from "@/lib/files/store";
import type { PlaceId } from "@/lib/files/types";

type EmptyConfig = { title: string; description: string; icon: ComponentType<LucideProps>; action: string; destination?: PlaceId };
const content: Record<string, EmptyConfig> = {
  internal: { title: "Your collection begins here", description: "Import your first files or connect a device folder to start exploring.", icon: FolderOpen, action: "Add files" },
  photos: { title: "A gallery waiting for memories", description: "Add photos to see them beautifully arranged here.", icon: Images, action: "Add photos" },
  videos: { title: "Your private cinema", description: "Import videos to preview and play them.", icon: Video, action: "Add videos" },
  music: { title: "Set the soundtrack", description: "Add music to create your listening library.", icon: Music, action: "Add music" },
  documents: { title: "Everything in its place", description: "Keep documents close, organized and easy to find.", icon: FileSearch, action: "Add documents" },
  downloads: { title: "Nothing downloaded yet", description: "Files you save to Downloads will appear here.", icon: Upload, action: "Browse library", destination: "internal" },
  archives: { title: "Archives, elegantly organized", description: "Import an archive to browse its contents.", icon: Archive, action: "Add archive" },
  projects: { title: "A space for your projects", description: "Create a folder for your next project.", icon: Database, action: "New folder" },
  device: { title: "Connect a device folder", description: "Choose a folder to grant browser access to its supported contents. Access may be remembered, but Android may request it again.", icon: HardDrive, action: "Allow folder access" },
  trash: { title: "A clean slate", description: "Deleted library items will appear here until permanently removed.", icon: Trash2, action: "Go to library", destination: "internal" },
  favorites: { title: "Keep the best close", description: "Star a file to make it easy to find again.", icon: Star, action: "Explore library", destination: "internal" },
  recents: { title: "Your story starts here", description: "Recently opened files will appear as you explore.", icon: Clock, action: "Explore library", destination: "internal" },
  bookmarks: { title: "Your favorite places", description: "Bookmark folders to return to them instantly.", icon: Heart, action: "Explore library", destination: "internal" },
};

export function LuxuryEmptyState({ place, search }: { place: string; search?: string }) {
  const config = search
    ? { title: "No matching files", description: `Nothing matches “${search}”. Try a different search.`, icon: FileSearch, action: "Clear search" }
    : content[place] ?? content.internal;
  const Icon = config.icon;
  const run = () => {
    const store = useFiles.getState();
    if (search) { store.setSearch(""); return; }
    if (config.destination) { store.goPlace(config.destination); return; }
    if (place === "device") { void store.connectDevice(); return; }
    if (place === "projects") {
      void store.askName("New folder", "New project").then((name) => { if (name) void useFiles.getState().createFolder(name); });
      return;
    }
    document.dispatchEvent(new CustomEvent("mm-open-upload"));
  };
  return (
    <section className="flex min-h-72 w-full flex-col items-center justify-center rounded-2xl border border-gold/15 bg-card/40 px-5 py-10 text-center" aria-label={config.title}>
      <div className="mb-5 flex size-20 items-center justify-center rounded-2xl border border-gold/25 bg-gold/5 shadow-sm">
        <Icon className="size-10 text-gold/70" strokeWidth={1.25} aria-hidden="true" />
      </div>
      <h2 className="font-display text-xl text-foreground">{config.title}</h2>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">{config.description}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button onClick={run}>{config.action}</Button>
        {place !== "device" && !search && (
          <Button variant="secondary" onClick={() => useFiles.getState().goPlace("device")}>Connect device folder</Button>
        )}
      </div>
    </section>
  );
}
