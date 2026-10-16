import { toast } from "sonner";

/** A cancelled share is not an error and should never trigger a surprise download. */
export async function shareOrCopy(options: { title?: string; text?: string; url?: string; files?: File[] }): Promise<"shared" | "copied" | "cancelled" | "failed"> {
  const { files, title, text, url } = options;
  const payload: ShareData = { title, text, url };
  if (files?.length && navigator.canShare?.({ files })) payload.files = files;
  if (typeof navigator.share === "function") {
    try {
      await navigator.share(payload);
      toast.success("Shared successfully");
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      // Unsupported share targets fall back to clipboard, not automatic download.
    }
  }
  const fallback = [text, url].filter(Boolean).join("\n") || title || files?.map((f) => f.name).join("\n") || "";
  if (!fallback) { toast.error("Nothing to share"); return "failed"; }
  try {
    await navigator.clipboard.writeText(fallback);
    toast.success("Copied to clipboard");
    return "copied";
  } catch {
    toast.error("Sharing and clipboard access are unavailable in this browser");
    return "failed";
  }
}

export async function copyPath(path: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(path);
    toast.success("Path copied");
    return true;
  } catch {
    toast.error("Clipboard permission denied");
    return false;
  }
}
