# Media Manager 621

Luxury media manager PWA — browse, preview, share, and install as a home-screen app.

**Live URL (after Pages is on):** https://tajoor621.github.io/media-manager/

**PWABuilder:** https://www.pwabuilder.com/?url=https://tajoor621.github.io/media-manager/

## Enable GitHub Pages (one click)

1. Open https://github.com/Tajoor621/media-manager/settings/pages
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. Push to `main` or open **Actions → Deploy GitHub Pages → Run workflow**.
4. Wait for the workflow to finish successfully, then open https://tajoor621.github.io/media-manager/.

This repository uses `.github/workflows/pages.yml` as the single source of truth for deployment. Do not select the `gh-pages` branch deployment method while using this workflow. The workflow builds `dist/` and deploys it using the official GitHub Pages actions.

After deployment, you can paste the live URL into PWABuilder to package the PWA for Android.

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
| `npm test` | Unit and regression tests |
| `npm run lint` | ESLint checks |

**Output directory (Pages):** `dist/`

## What runs where

Works on GitHub Pages: library, photos/videos/audio/PDF/ZIP/SQLite viewers, upload, drag-and-drop, offline cache, home-screen install.

Needs a Node host (Vercel, not Pages): Google Drive RPC, Nearby WebRTC signaling and server-backed authentication. The GitHub Pages build explicitly disables authentication because static hosting cannot run the auth server.

## Vercel (full app)

Connect this GitHub repo to Vercel. Use `npm run build`. Root `/`.

## PWA

- `public/manifest.webmanifest` — standalone, theme `#0A0A0B`
- `public/sw.js` — offline cache + share target
- Icons: `icon-180.png`, `icon-192.png`, `icon-512.png`, `favicon.svg`
- Brand lockup: `public/brand/logo.jpg`

## License

Private project for Tajoor Enterprises / 621 FileManager.


## App environment

`config/app-env.json` contains public build flags only. Never put secrets, API keys, passwords, or private credentials in this file. The GitHub Pages build is configured for local/offline use with authentication disabled; enable authentication only on a server deployment with the required environment variables and database configured.
