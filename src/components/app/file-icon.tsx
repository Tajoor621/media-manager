import {
  Archive,
  Database,
  File,
  FileCode,
  FileText,
  Film,
  Folder,
  ImageIcon,
  Music,
} from "lucide-react";
import type { ViewerKind } from "@/lib/files/types";
import { cn } from "@/lib/utils";

export function FileGlyph({
  kind,
  folder,
  className,
}: {
  kind: ViewerKind;
  folder?: boolean;
  className?: string;
}) {
  const cls = cn("size-5 shrink-0", className);
  if (folder) return <Folder className={cn(cls, "text-gold")} />;
  switch (kind) {
    case "image":
      return <ImageIcon className={cn(cls, "text-gold")} />;
    case "video":
      return <Film className={cn(cls, "text-silver")} />;
    case "audio":
      return <Music className={cn(cls, "text-gold")} />;
    case "pdf":
      return <FileText className={cn(cls, "text-silver")} />;
    case "text":
      return <FileCode className={cn(cls, "text-silver")} />;
    case "archive":
      return <Archive className={cn(cls, "text-gold")} />;
    case "sqlite":
      return <Database className={cn(cls, "text-silver")} />;
    default:
      return <File className={cn(cls, "text-muted")} />;
  }
}
