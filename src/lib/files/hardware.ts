import { hasFileSystemAccess } from "./fs-access";

export type HardwareInfo = {
  ramGb: number | null;
  ramBytes: number | null;
  heapUsed: number | null;
  heapLimit: number | null;
  romUsed: number;
  romQuota: number;
  cores: number | null;
  platform: string;
  persisted: boolean;
  fsa: boolean;
  directoryInput: boolean;
};

type NavPlus = Navigator & {
  deviceMemory?: number;
  userAgentData?: { platform?: string };
};

type PerfPlus = Performance & {
  memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
};

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

export async function readHardware(): Promise<HardwareInfo> {
  const nav = navigator as NavPlus;
  const ramGb = typeof nav.deviceMemory === "number" ? nav.deviceMemory : null;
  const mem = (performance as PerfPlus).memory;
  let romUsed = 0;
  let romQuota = 0;
  let persisted = false;
  try {
    const est = await navigator.storage?.estimate?.();
    romUsed = est?.usage ?? 0;
    romQuota = est?.quota ?? 0;
  } catch {
    /* ignore */
  }
  try {
    persisted = (await navigator.storage?.persisted?.()) === true;
  } catch {
    /* ignore */
  }
  const probe = document.createElement("input");
  return {
    ramGb,
    ramBytes: ramGb != null ? ramGb * 1024 * 1024 * 1024 : null,
    heapUsed: mem?.usedJSHeapSize ?? null,
    heapLimit: mem?.jsHeapSizeLimit ?? null,
    romUsed,
    romQuota,
    cores: navigator.hardwareConcurrency || null,
    platform: platformName(),
    persisted,
    fsa: hasFileSystemAccess(),
    directoryInput: "webkitdirectory" in probe,
  };
}

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) === true;
  } catch {
    return false;
  }
}
