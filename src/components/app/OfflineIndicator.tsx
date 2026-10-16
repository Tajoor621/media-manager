import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OfflineIndicator() {
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);
  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => { window.removeEventListener("online", sync); window.removeEventListener("offline", sync); };
  }, []);
  if (!offline) return null;
  return (
    <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 border-b border-gold/20 bg-gold/10 px-3 py-2 text-center text-xs text-foreground">
      <WifiOff className="size-4 shrink-0 text-gold" aria-hidden="true" />
      Offline mode · Your saved library works. Previously granted device folders may work where the browser permits.
    </div>
  );
}
