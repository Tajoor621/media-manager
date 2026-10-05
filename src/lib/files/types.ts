export const ROOT_ID = "root";
export const TRASH_ID = "trash";

export const FOLDER_IDS = {
  photos: "folder-photos",
  videos: "folder-videos",
  music: "folder-music",
  documents: "folder-documents",
  downloads: "folder-downloads",
  archives: "folder-archives",
  projects: "folder-projects",
} as const;

export type FileKind = "file" | "folder";

export type FileNode = {
  id: string;
  parentId: string;
  name: string;
  kind: FileKind;
  mime: string;
  size: number;
  createdAt: number;
  updatedAt: number;
  favorite: boolean;
  bookmark: boolean;
  originalParentId?: string;
  source?: string;
};

export type PlaceId =
  | "internal"
  | "photos"
  | "videos"
  | "music"
  | "documents"
  | "downloads"
  | "archives"
  | "projects"
  | "favorites"
  | "recents"
  | "bookmarks"
  | "trash"
  | "device"
  | "drive"
  | "nearby";

export type Tab = {
  id: string;
  title: string;
  place: PlaceId;
  folderId: string;
};

export type ViewMode = "grid" | "list" | "details";
export type SortKey = "name" | "date" | "size" | "type";
export type ThemeMode = "dark" | "light";

export type Transfer = {
  id: string;
  name: string;
  kind: "upload" | "download" | "copy" | "extract" | "cloud" | "nearby" | "device";
  status: "running" | "done" | "error";
  progress: number;
  detail?: string;
};

export type DeviceEntry = {
  name: string;
  path: string;
  kind: "file" | "folder";
  size: number;
  mime: string;
  lastModified: number;
};

export type DriveItem = {
  id: string;
  name: string;
  mimeType: string;
  isFolder: boolean;
  size: number;
};

export type ViewerKind =
  | "image"
  | "video"
  | "audio"
  | "pdf"
  | "text"
  | "archive"
  | "sqlite"
  | "hex"
  | "folder";

export type ClipboardOp = {
  mode: "copy" | "cut";
  ids: string[];
};

export type Settings = {
  theme: ThemeMode;
  viewMode: ViewMode;
  sort: SortKey;
  sortDir: "asc" | "desc";
  showHidden: boolean;
  autoPlay: boolean;
};

export type NamePrompt = {
  title: string;
  value: string;
};
