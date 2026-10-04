/** Prefix a public-folder path with Vite `BASE_URL` so GitHub Pages subpaths work. */
export function publicUrl(path: string): string {
  const base = import.meta.env.BASE_URL || "/";
  const rel = String(path || "").replace(/^\//, "");
  if (!rel) return base;
  return `${base}${rel}`;
}
