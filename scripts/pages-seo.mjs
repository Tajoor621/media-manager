/**
 * Head tags for the static GitHub Pages document.
 * Keep the title, description, and canonical URL aligned with src/lib/site-meta.ts.
 */
export const SITE_URL = "https://tajoor621.github.io/media-manager/";
export const SITE_TITLE = "Media Manager 621 — Luxury file and media library";
export const SITE_DESCRIPTION =
  "Offline-first luxury file and media organizer. Import, browse, preview, organize, and share photos, videos, music, and documents on this device.";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function ensurePagesSeo(html) {
  const extra = [];
  if (!/name=["']description["']/i.test(html)) {
    extra.push(`<meta name="description" content="${escapeHtml(SITE_DESCRIPTION)}" />`);
  }
  if (!/rel=["']canonical["']/i.test(html)) {
    extra.push(`<link rel="canonical" href="${SITE_URL}" />`);
  }
  if (!/property=["']og:title["']/i.test(html)) {
    const image = `${SITE_URL}og.jpg`;
    extra.push(
      `<meta property="og:title" content="${escapeHtml(SITE_TITLE)}" />`,
      `<meta property="og:description" content="${escapeHtml(SITE_DESCRIPTION)}" />`,
      `<meta property="og:type" content="website" />`,
      `<meta property="og:url" content="${SITE_URL}" />`,
      `<meta property="og:image" content="${image}" />`,
      `<meta property="og:site_name" content="Media Manager 621" />`,
    );
  }
  if (!/name=["']twitter:card["']/i.test(html)) {
    extra.push(
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:title" content="${escapeHtml(SITE_TITLE)}" />`,
      `<meta name="twitter:description" content="${escapeHtml(SITE_DESCRIPTION)}" />`,
      `<meta name="twitter:image" content="${SITE_URL}og.jpg" />`,
    );
  }
  if (!/application\/ld\+json/i.test(html)) {
    const data = {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "Media Manager 621",
      url: SITE_URL,
      description: SITE_DESCRIPTION,
    };
    extra.push(`<script type="application/ld+json">${JSON.stringify(data)}</script>`);
  }
  if (!extra.length || !html.includes("</head>")) return html;
  return html.replace("</head>", `${extra.join("\n")}\n</head>`);
}
