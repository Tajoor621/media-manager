import { hasDirectoryInput, hasFileSystemAccess } from "./fs-access";

export type HardwareInfo = {
  ramGb: number | null;
  ramBytes: number | null;
  ramSource: "device" | "heap" | "unknown";
  heapUsed: number | null;
  heapLimit: number | null;
  romUsed: number;
  romQuota: number;
  romDetail: string;
  cores: number | null;
  platform: string;
  model: string;
  persisted: boolean;
  fsa: boolean;
  directoryInput: boolean;
  embedded: boolean;
  secure: boolean;
};

type NavPlus = Navigator & {
  deviceMemory?: number;
  userAgentData?: {
    platform?: string;
    getHighEntropyValues?: (hints: string[]) => Promise<{
      platform?: string;
      platformVersion?: string;
      model?: string;
      architecture?: string;
      bitness?: string;
      formFactor?: string[];
    }>;
  };
};

type PerfPlus = Performance & {
  memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number; totalJSHeapSize: number };
};

export function isEmbeddedFrame(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function platformName(): string {
  const ua = navigator.userAgent || "";
  const fromHints = (navigator as NavPlus).userAgentData?.platform;
  if (fromHints) return fromHints;
  if (/iPhone|iPod/.test(ua)) return "iPhone";
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Win/.test(ua)) return "Windows";
  if (/Mac/.test(ua)) return "macOS";
  if (/Linux/.test(ua)) return "Linux";
  return "This device";
}

function androidRamGuess(ua: string): number | null {
  if (!/Android/i.test(ua)) return null;
  if (/SM-S9|Pixel 8|Pixel 9| ram[._-]?8/i.test(ua)) return 8;
  if (/ram[._-]?12/i.test(ua)) return 12;
  if (/ram[._-]?16/i.test(ua)) return 16;
  if (/ram[._-]?6/i.test(ua)) return 6;
  if (/ram[._-]?4/i.test(ua)) return 4;
  return null;
}

export function readHardwareSync(): HardwareInfo {
  const nav = navigator as NavPlus;
  const ua = navigator.userAgent || "";
  const ramGb =
    typeof nav.deviceMemory === "number" && nav.deviceMemory > 0
      ? nav.deviceMemory
      : androidRamGuess(ua);
  const mem = typeof performance !== "undefined" ? (performance as PerfPlus).memory : undefined;
  const heapLimit = mem?.jsHeapSizeLimit ?? null;
  const heapUsed = mem?.usedJSHeapSize ?? null;
  const ramSource: HardwareInfo["ramSource"] =
    typeof nav.deviceMemory === "number" && nav.deviceMemory > 0
      ? "device"
      : heapLimit
        ? "heap"
        : ramGb
          ? "device"
          : "unknown";
  const ramBytes =
    ramGb != null ? ramGb * 1024 * 1024 * 1024 : heapLimit != null ? heapLimit : null;
  return {
    ramGb,
    ramBytes,
    ramSource,
    heapUsed,
    heapLimit,
    romUsed: 0,
    romQuota: 0,
    romDetail: "",
    cores: navigator.hardwareConcurrency || null,
    platform: platformName(),
    model: "",
    persisted: false,
    fsa: hasFileSystemAccess() && !isEmbeddedFrame(),
    directoryInput: hasDirectoryInput(),
    embedded: isEmbeddedFrame(),
    secure: typeof window !== "undefined" ? window.isSecureContext : false,
  };
}

export async function readHardware(): Promise<HardwareInfo> {
  const info = readHardwareSync();
  try {
    const est = await navigator.storage?.estimate?.();
    info.romUsed = est?.usage ?? 0;
    info.romQuota = est?.quota ?? 0;
    const details = (est as { usageDetails?: Record<string, number> } | undefined)?.usageDetails;
    if (details) {
      const parts = Object.entries(details)
        .filter(([, n]) => n > 0)
        .map(([k, n]) => `${k} ${formatRough(n)}`);
      if (parts.length) info.romDetail = parts.join(" · ");
    }
  } catch {
    /* ignore */
  }
  try {
    info.persisted = (await navigator.storage?.persisted?.()) === true;
  } catch {
    /* ignore */
  }
  try {
    const hints = await (navigator as NavPlus).userAgentData?.getHighEntropyValues?.([
      "model",
      "platform",
      "platformVersion",
      "architecture",
      "formFactor",
    ]);
    if (hints?.model) info.model = hints.model;
    if (hints?.platform) {
      info.platform = hints.platformVersion
        ? `${hints.platform} ${hints.platformVersion}`
        : hints.platform;
    }
  } catch {
    /* ignore */
  }
  return info;
}

function formatRough(n: number): string {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} GB`;
  if (n >= 1024 ** 2) return `${Math.round(n / 1024 ** 2)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) === true;
  } catch {
    return false;
  }
}
