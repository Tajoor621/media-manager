# Media Manager 621

Luxury media manager PWA — browse, preview, share, and install as a home-screen app.

**Live (GitHub Pages):** https://tajoor621.github.io/media-manager/

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

## GitHub Pages

This repo deploys the static PWA automatically on push to `main` via GitHub Actions.

1. Settings → Pages → Source: **GitHub Actions** (first deploy may ask you to approve the `github-pages` environment).
2. After the workflow is green, open https://tajoor621.github.io/media-manager/
3. Android: Chrome → Install app. iPhone: Safari → Share → Add to Home Screen.
4. APK: paste the Pages URL into [PWABuilder](https://www.pwabuilder.com).

Works on Pages: library, photos/videos/audio/PDF/ZIP/SQLite viewers, upload, drag-and-drop, offline cache, home-screen install.

Needs a Node host (Vercel/Netlify, not Pages): Google Drive RPC, Nearby WebRTC signaling.

## Vercel (full app)

Connect this GitHub repo to Vercel. Use `npm run build`. Root `/`.

## PWA

- `public/manifest.webmanifest` — standalone, theme `#0A0A0B`
- `public/sw.js` — offline cache + share target
- Icons: `icon-180.png`, `icon-192.png`, `icon-512.png`, `favicon.svg`
- Brand lockup: `public/brand/logo.jpg`

## License

Private project for Tajoor Enterprises / 621 FileManager.
