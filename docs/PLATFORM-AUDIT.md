# Media Manager 621 — repository and platform audit

Updated: 2026-10-16. This document separates source-verified fixes from Android/iPhone behavior that requires device testing.

## Scope inspected

- Root configuration: `package.json`, lockfile presence, `vite.config.ts`, `.gitignore`, `.env.example`, `README.md`.
- `.github/workflows/`: Pages branch publication, screenshot/manifest validation, and quality CI.
- `scripts/`: static Pages build, screenshot generation, manifest validation, Grok head injection, and legacy test suite.
- `public/`: manifest, service worker, icons, screenshots, brand, samples, and standalone file workbench.
- `src/components/app/`: navigation, storage picker, file and media UI, optional connectors.
- `src/lib/files/`: IndexedDB persistence, browser file-system access, mounted file paths, Zustand state.
- `src/routes/`: main app and share-target route.
- `server/`, `src/lib/auth/`, `src/lib/cloud/`, `src/lib/multiplayer/`: server-only and connector-dependent features.
- Native Android source: now present in `android-native/`, including Kotlin/Gradle, AndroidManifest, SAF explorer, native internal-storage explorer (after special permission approval), PIN/biometric lock, and Keystore-encrypted Vault. CI builds an APK artifact; on-device tests remain necessary.

This is a source-level and CI audit, not a certification of every line or a substitute for testing on physical Android/iPhone devices.

## Issues and resolutions

| Priority | Finding | Status |
| --- | --- | --- |
| P0 | App started in Device Storage with no permission, appearing stuck | Fixed: default tab opens the usable local Library |
| P0 | Android wrapper may expose an unusable `showDirectoryPicker` | Mitigated: mobile-first, user-initiated file/directory input and individual-file fallback |
| P0 | Device-file paths derived from `webkitRelativePath` differed from mounted normalized paths | Fixed: store now uses the mounted tree's canonical paths |
| P1 | App said a single permission grants the whole device | Fixed: honest selected-folder/file copy and OS sandbox messaging |
| P1 | Repeated file selections could create duplicate tree entries; large folders were slow | Fixed: linear-time path map and deduplication |
| P1 | iPhone install guide linked to a server-only query that does not work on static Pages | Fixed: visible Safari installation steps |
| P1 | Generic Grok head injection could compete with the product manifest | Fixed: respect the project manifest and correct the link-detection regex |
| P1 | Legacy tests depended on untracked private `.grok` files | Fixed test portability: skip those specific unavailable fixture tests with an explicit reason; other tests still execute |
| P1 | Existing ESLint error from empty catch block | Fixed with a documented fallback |
| P1 | No independent TypeScript/unit/lint workflow | Added `.github/workflows/quality.yml` |
| P1 | README described an obsolete Pages setup | Rewritten for current app, iOS, Android TWA, CI, and limitations |
| P2 | Multiple storage handles with the same display name can collide | Remaining: requires unique per-volume identity |
| P2 | Empty folders do not always survive full-directory indexing | Remaining: folder-only entries should be retained in the indexed tree |
| P2 | Android's system-wide storage permission is not available to web code | Separate native Android implementation added; OS approval still required, protected paths remain inaccessible |
| P2 | `gh-pages` is static; server-backed Google Drive and Nearby signaling are not available there | Requires a supported backend deployment |
| P2 | PWABuilder Android TWA fullscreen verification depends on Digital Asset Links at origin root | Requires verified signing fingerprint, package name, and control of origin-root `/.well-known/assetlinks.json` |
| P2 | Web Share Target may not preserve a POST attachment when no app window is open | Requires queued share-target ingestion and mobile validation |
| P2 | Files chosen from a picker are not guaranteed to survive browser restart | Documented; requires user-backed imports or native persistable URI grants |

## Platform acceptance checks

**Android Chrome:** app loads, Library is usable without permission, file import/preview works, Device picker opens on a direct tap, cancellation leaves the app usable, selected files can be opened, app works after refresh, offline shell loads after an online visit.

**Android PWABuilder APK/TWA:** all Android Chrome checks, picker behavior in installed wrapper, back navigation, share-in, fullscreen origin verification, downloads, file playback, permission denial/retry. A successful web build alone cannot certify these checks.

**iPhone Safari / Home Screen:** app loads on Safari, Add to Home Screen icon works, Files/Photos import, media previews, local library, offline shell after first load, behavior after browser restart, no misleading whole-device permission prompt.

**CI:** `npm ci`, `npm run typecheck`, `npm test`, `npm run lint`, `npm run build:pages`, real screenshot generation, manifest validator, `gh-pages` deployment, Pages deployment check.

## What is not claimed

- Unrestricted Android storage permission or access to protected folders.
- A verified native Android APK built from this repository.
- Successful iPhone Safari and Android device testing performed by the CI runner.
- Fully operational Google Drive / Nearby connectors on a static GitHub Pages site.
- A guaranteed PWABuilder score or Play Store approval.

The PWA's local file manager can be functional without those capabilities. A native Android alpha has now been implemented and compiled by CI; its runtime behavior, permissions, protected paths, vault UX, and secure login must still be verified on real devices. The iPhone/web app now also includes a locally encrypted Private Vault in Settings.

## X-plore feature-parity audit — 2026-10-17

**Reference:** user-supplied X-plore screenshots and feature requirements. This is a feature-gap comparison, **not** a claim that X-plore source, artwork, branding, or proprietary code has been copied.

### Repository security

- **Main branch is unprotected**: GitHub API returns an empty repository rulesets list. The GitHub connector cannot create branch protection rules. Owner must activate a ruleset under Settings → Rules → Rulesets; target `main`, restrict deletions, block force pushes. Do not require status checks until exact check names and merge workflow are verified.
- Quality workflow exists: TypeScript check, unit tests, ESLint and browser guard on push and PR. Native debug APK has its own compile workflow. CI passing does not mean feature-complete or device-tested.
- Branch-based Pages publication and separate native APK are distinct deliverables. A PWA/TWA cannot gain Android's native all-files access.

### Native Android feature matrix

| Feature | Current status | Next acceptance work |
| --- | --- | --- |
| Native internal shared storage, browse files/folders, storage meter | Implemented in source after user-approved All files access | Test on Android 11–16; protected paths still blocked |
| SAF folder selection, persisted grants | Implemented | Test removable SD/USB provider behavior |
| Installed apps | Launchable app names, package IDs and App Info link | Detailed app metadata, user/system filters and permitted package export |
| File preview | Native image/audio/video and small UTF-8 text | PDF, archives, large media, subtitles, thumbnails, playback resume |
| File rename, hide/unhide, folder creation, file delete | Implemented | Multi-select and undo/trash |
| File/folder copy or move between internal-storage directories | Added native source | Large-tree progress/cancel, storage-space preflight, error recovery |
| Folder search, sort, hidden-files toggle, file details | Added native source | Recursive search, filters, saved views, thumbnails |
| ZIP creation and extraction | Added native source with ZIP-slip path checks, entry and extraction-size limits | Progress/cancel, passwords, additional formats, archive integrity tests |
| Encrypted vault, PIN and biometric unlock | Present | Security review, recovery/export policy, threat-model tests |
| Two-pane expandable X-plore-style tree | Not implemented | Independent panes, back stack, tree state |
| Select one/select all, multi-select batch actions | Not implemented | Selection state, bulk move/copy/delete/share with confirmations |
| Disk map, storage analyzer, duplicate finder | Not implemented | Scanner, caching, safe read-only analysis |
| FTP/SFTP/SMB/WebDAV and Wi-Fi server | Not implemented | Authenticated servers, network hardening, TLS and local-network UX |
| Cloud storage connectors in native app | Not implemented | Per-provider OAuth and offline cache |
| Root explorer | Not implemented | Do not bypass Android protections; optional legitimate root handling would require explicit privileged environment |
| APK management, install/uninstall | Not implemented | System-mediated APK install/uninstall; no silent installs |
| Trash/recycle bin, restore, secure deletion | Not implemented | Transactional trash with restore and retention |
| Batch archive formats (7z/RAR/TAR), encryption | Not implemented | Licensed libraries, test archives, memory controls |
| Bluetooth, Wi-Fi Direct and LAN transfers | Not implemented | Secure pairing and transport integration |
| Photo editor, document editor, full media player | Partial | Dedicated editor/player modules |

### Important reliability and security risks

1. **Large file operations:** copy and ZIP creation still run synchronously on the UI thread in the alpha; implement background worker, cancellation, and progress before production.
2. **Partial copies:** a failed copy may leave a partial destination; implement temp-file/atomic-rename or cleanup and verify before removing sources.
3. **File permissions:** `MANAGE_EXTERNAL_STORAGE` is not universal access; protected `Android/data`, `Android/obb`, other apps' private data and root paths remain restricted. Play Store approval for broad storage is policy-dependent.
4. **Native release readiness:** Debug APK builds are not signed production releases. Device compatibility, runtime behavior, large folders, battery use and accessibility have not been independently verified.
5. **PWA and native UX diverge:** source is currently two separate implementations; parity requires a defined shared feature specification and per-platform tests.
6. **Performance:** directory listing renders at most 1,500 rows and has no recycler virtualization; large folders need a `RecyclerView` or Compose lazy list.
7. **User experience:** the native alpha uses basic Android buttons and lists, not the desired polished X-plore-inspired black/gold dual-pane layout.

**Status:** Feature work is ongoing. A successful CI compile verifies source buildability only; it does not establish that all X-plore features are cloned or that Android/iPhone restrictions have been removed.
