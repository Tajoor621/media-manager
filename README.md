# Media Manager 621

An offline-first, black-and-gold media and file library for desktop, Android, and iPhone. Built with React 19, TypeScript, TanStack Router/Start, Vite 8, Tailwind CSS 4, Zustand, and IndexedDB.

**Live iPhone/Android/desktop PWA:** https://tajoor621.github.io/media-manager/  
**PWABuilder packaging and manifest checks:** https://www.pwabuilder.com/  
**GitHub Actions:** https://github.com/Tajoor621/media-manager/actions  
**Repository:** https://github.com/Tajoor621/media-manager

## What works

| Feature | GitHub Pages PWA | Android PWA / PWABuilder TWA | iPhone Safari / Home Screen |
| --- | --- | --- | --- |
| Local library: import, folders, rename, copy, move, trash, favorites, search | Yes | Yes | Yes |
| Photos, video, audio, PDF, text, ZIP, SQLite and hex preview | Browser-supported formats | Browser-supported formats | Browser-supported formats |
| Offline app shell and previously cached assets | Yes, after first online visit | Yes, after first online visit | Subject to Safari storage and cache policies |
| Select individual photos and files | Yes | Via Android file picker | Via iOS Files / photo picker |
| Select a directory of files | Supported browser picker required | Device/browser dependent; may be blocked in TWA | Not reliable; use individual file selection |
| Reopen previously selected directory without prompting | Browser dependent | Browser dependent | Not available as unrestricted directory access |
| Unrestricted Android storage / MANAGE_EXTERNAL_STORAGE | **No** | **No: requires separate native Android implementation and OS approval** | Not applicable |
| Google Drive connector | Needs compatible hosted backend/connector | Same | Same |
| Nearby/WebRTC signaling | Needs compatible hosted backend | Same | Same |

**A PWABuilder APK is normally a Trusted Web Activity (TWA) wrapper of the live HTTPS site.** It does not turn JavaScript's folder picker into Android's system-wide storage permission. Android may prohibit selection of the storage root or protected folders. This app **never bypasses Android/iOS sandboxing**.

## In-app media workflow and accurate storage meters

Media Manager is intended to be the place where selected or imported media is browsed, previewed, played, edited when a compatible editor is implemented, organized, and shared. The operating system's Files/Photos picker is used **only to authorize or import files** where required; it cannot be replaced with an unrestricted web-only scanner.

The dashboard shows three separate metrics: **RAM information** (browser-reported estimate, if available), **App storage** (browser-origin usage/quota, not total ROM), and **Selected device files** (files the user explicitly allowed the app to read). CPU cores are not RAM; indexed file size is not phone storage capacity. None of these cards is a drive to navigate.

An internal viewer does not guarantee an internal editor for every file type. Unsupported formats, protected files, and native share sheets may still require OS assistance. Sharing to another app necessarily invokes a platform share interface.

## First run and phone storage

The app opens in **Library** so the user can immediately import, preview, organize, and share files without granting storage permissions.

1. Open **Device storage** to browse external files.
2. Tap **Choose a device folder** or **Select folder**. On supported desktop browsers this uses the File System Access API; on phones it prefers a user-initiated file/directory input.
3. Select a folder the OS allows. On phones where directory selection is unavailable, tap **Photos & files** to select individual files instead.
4. Files selected through a picker are accessible for the current browser session. A stored directory handle may be resumed on browsers that support it; it is not a permanent Android permission.
5. To keep copies inside Media Manager, use **Copy into library** (up to 400 files per operation), or upload selected files into the Library. Browser IndexedDB data can be lost if site data is cleared or the OS evicts storage. Back up important files elsewhere.

**If the APK appears stuck on a permission screen:** open Library from the bottom navigation; try Photos & files; test the live URL in Chrome. If Chrome works but the installed APK does not, the wrapper's picker/permission behavior is different. Regenerate the TWA package after publishing updates; the web UI updates over HTTPS, but changes to native permissions require rebuilding the APK/AAB.

### Android install and APK

- Open the live URL in current Chrome on Android; choose **Install app** or **Add to Home screen** from Chrome's menu.
- To create an APK/AAB, paste the live URL into [PWABuilder](https://www.pwabuilder.com/), check the manifest, and package for Android.
- A TWA may require **Digital Asset Links** verification for a fullscreen trusted launch. Supply the signing certificate SHA-256 fingerprint and package name to generate the correct `/.well-known/assetlinks.json` at the **origin root**. GitHub Pages project sites cannot independently control the `https://tajoor621.github.io/.well-known/` origin-root path from this `/media-manager/` repository. Use a domain/origin you control, or the appropriate Android packaging/browser fallback. **Do not assume verification is configured.**
- This repository now also includes **`android-native/`**, a separate Kotlin Android app (alpha) with Android's Storage Access Framework, optional All files access Settings link, file browser, hide/unhide by renaming, native image/audio/video/text previews, local PIN/biometric app lock and AES-GCM encrypted private copies. It is **not the same binary as the PWABuilder TWA**. The native explorer currently browses user-approved SAF folders; its optional all-files permission does not yet power a full-device explorer. See [Native Android build and limitations](android-native/README.md) and the [native APK build workflow](.github/workflows/android-native.yml).
- For a true native Android file manager, implement a separate Android bridge using the Storage Access Framework, persistable URI grants where permitted, runtime media permissions, and user-visible permission rationale. Special all-files access is restricted by Android/Play policy.

### iPhone / iPad

1. Open the live URL in **Safari**.
2. Tap **Share → Add to Home Screen** (or the equivalent menu in your iOS version).
3. Open Media Manager from its Home Screen icon.
4. Use **Library → Upload** or **Device storage → Photos & files** to select files from Files or Photos. Safari does not offer unrestricted iPhone file-system access to a PWA.
5. Test online and offline after the first load; offline cached assets do not guarantee persistent copies of all imported data.

## Private Vault on iPhone and web

Settings now includes a **Private Vault** for locally encrypted copies. It uses Web Crypto PBKDF2 (310,000 SHA-256 iterations) to derive an AES-256-GCM key from a passphrase of at least 12 characters. Files and filenames are encrypted in browser IndexedDB; the app locks the vault when hidden. Import supports up to 20 MB per file, with manual export. Originals remain unchanged. This is not a whole-phone hide/unhide feature. Browser data eviction, forgotten passphrases, and unbacked-up data can result in permanent loss.

## Features and structure

- `src/components/app/AppShell.tsx` — main responsive interface, navigation, library controls, settings, viewer integration, service-worker registration.
- `src/components/app/Panels.tsx` — device browser, settings, storage meters, optional cloud/nearby panels.
- `src/lib/files/store.ts` — Zustand library and device state, imports, previews, navigation, persistence.
- `src/lib/files/fs-access.ts` — browser directory/file picker, selected-file tree, browser handle permissions.
- `src/lib/files/idb.ts` — IndexedDB metadata and file blobs.
- `src/lib/files/private-vault.ts` — encrypted browser vault.
- `src/components/app/PrivateVaultPanel.tsx` — vault controls integrated into Settings.
- `android-native/` — separate native Android Kotlin alpha and debug APK workflow.
- `public/manifest.webmanifest` — PWA identity, icons, maskable icon, shortcuts, screenshots, share target.
- `public/sw.js` — offline caching and web share-target handling.
- `public/tools/file-workbench.html` — standalone file workbench.
- `public/screenshots/` — real desktop and mobile UI screenshots.
- `scripts/capture-pwa-screenshots.mjs` — screenshot and maskable icon generation.
- `scripts/check-pwa-manifest.mjs` — validates manifest assets and dimensions.
- `scripts/build-pages.mjs` — static GitHub Pages build.
- `.github/workflows/pages.yml` — builds `main`, validates and publishes `dist/` to `gh-pages`.

## GitHub Pages deployment

In repository **Settings → Pages**, select **Deploy from a branch**, branch **`gh-pages`**, directory **`/ (root)`**. Do not switch to GitHub Actions source while using the branch-publishing workflow.

Each push to `main` runs `npm ci`, builds the PWA, captures genuine screenshots, checks the manifest, and publishes `dist/` to `gh-pages`. GitHub Pages then deploys that branch. The latest deployed build can be checked under **Actions** and **Deployments**. The live URL may lag behind the source branch briefly.

## Local development and verification

Requires Node.js 22 and npm.

```bash
npm ci
npm run dev
npm run typecheck
npm test
npm run lint
npm run build:pages
node scripts/capture-pwa-screenshots.mjs
node scripts/check-pwa-manifest.mjs
```

Production `npm run build` is for the Node/Vercel server deployment; `npm run build:pages` generates the static site in `dist/`. Server-only connectors (for example Google Drive and Nearby signaling) are **not** automatically functional on GitHub Pages.

## Repository audit and known limitations

See [Platform audit and Android/iPhone acceptance matrix](docs/PLATFORM-AUDIT.md) for resolved issues, outstanding native-platform work, and the checks required before claiming full device compatibility.

## Security and data limitations

- Files are selected by the user. The app cannot silently enumerate all files or protected app directories on Android or iOS.
- IndexedDB is local to the browser/app origin. Clearing site data can delete the library; importing is not the same as making a device-wide backup.
- The UI's ROM/device-file measurements describe browser-reported quota or indexed accessible files, **not authoritative total phone storage usage**.
- Browser APIs, playback codecs, sharing, and offline persistence differ between Chrome, Safari, and Android wrappers.
- A successful CI build or manifest check does not certify the APK's native permission behavior or a particular PWABuilder score. Validate on real devices.

## License

Project maintained by Tajoor621. No open-source license is declared in this repository; all rights remain with their respective owners unless a license is added.
