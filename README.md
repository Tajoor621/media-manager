# Media Manager 621

Luxury media manager PWA — browse, preview, share, and install as a home-screen app.

**Live URL (after Pages is on):** https://tajoor621.github.io/media-manager/

**PWABuilder:** https://www.pwabuilder.com/?url=https://tajoor621.github.io/media-manager/

## Enable GitHub Pages (one click)

The site is already built on the `gh-pages` branch. GitHub will not serve it until you turn Pages on:

1. Open https://github.com/Tajoor621/media-manager/settings/pages
2. **Build and deployment → Source:** Deploy from a branch
3. **Branch:** `gh-pages` / `/ (root)` → Save
4. Wait ~1 minute, then open https://tajoor621.github.io/media-manager/

After that you can paste the live URL into PWABuilder for an Android APK.

A GitHub Actions workflow (`.github/workflows/pages.yml`) also rebuilds on every push to `main`. Optional: switch Source to **GitHub Actions** once you have approved the `github-pages` environment.

## Stack

- React 19 + TypeScript
- TanStack Start / Router
- Vite 8 + Tailwind CSS 4
- IndexedDB library, File System Access, Web Share, service worker

## Scripts

| Command | Purpose |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Local development |
| `npm run build` | Production Node/Vercel build |
| `npm run build:pages` | Static GitHub Pages build → `dist/` |
| `npm run typecheck` | TypeScript check |

**Output directory (Pages):** `dist/`

## What runs where

Works on GitHub Pages: library, photos/videos/audio/PDF/ZIP/SQLite viewers, upload, drag-and-drop, offline cache, home-screen install.

Needs a Node host (Vercel, not Pages): Google Drive RPC, Nearby WebRTC signaling.

## Vercel (full app)

Connect this GitHub repo to Vercel. Use `npm run build`. Root `/`.

## PWA

- `public/manifest.webmanifest` — standalone, theme `#0A0A0B`
- `public/sw.js` — offline cache + share target
- Icons: `icon-180.png`, `icon-192.png`, `icon-512.png`, `favicon.svg`
- Brand lockup: `public/brand/logo.jpg`

## License

Private project for Tajoor Enterprises / 621 FileManager.
