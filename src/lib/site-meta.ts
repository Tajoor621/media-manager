/** Canonical presentation for the published GitHub Pages app. */
export const SITE_URL = "https://tajoor621.github.io/media-manager/";
export const SITE_NAME = "Media Manager 621";
export const SITE_TITLE = "Media Manager 621 — Luxury file and media library";
export const SITE_DESCRIPTION =
  "Offline-first luxury file and media organizer. Import, browse, preview, organize, and share photos, videos, music, and documents on this device.";
export const SITE_IMAGE = `${SITE_URL}og.jpg`;
export const SITE_IMAGE_ALT = "Media Manager 621 library on a dark gold desktop";

export const SITE_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE_NAME,
  url: SITE_URL,
  applicationCategory: "UtilitiesApplication",
  operatingSystem: "Web, Android, iOS",
  browserRequirements: "Requires a modern browser with IndexedDB",
  description: SITE_DESCRIPTION,
  image: SITE_IMAGE,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  featureList: [
    "Local file library",
    "Photo, video, audio, PDF, and text preview",
    "Device folder access where the browser allows it",
    "Search, sort, and organize",
    "Offline app shell",
    "Optional encrypted private vault",
  ],
};
