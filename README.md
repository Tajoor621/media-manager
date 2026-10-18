# Media Manager 621

**An offline-first media library and file-management platform for Android, iPhone, iPad, and the web.**

[Launch Web App](https://tajoor621.github.io/media-manager/) · [Android Source](android-native/) · [iOS Source](ios-native/) · [Build Status](../../actions) · [Technical Audit](docs/PLATFORM-AUDIT.md)

Media Manager 621 brings personal files, photos, videos, music, and documents into a single organized workspace. Its interface uses a distinctive dark-and-gold design, with platform-specific applications built around the storage and security capabilities of each operating system.

The project includes a browser-based Progressive Web App (PWA), a native Android implementation, and a native SwiftUI iOS implementation. **These are separate application builds:** installing the PWA or a PWABuilder APK does not install the native Android file manager.

> **Development status:** The web app is deployed. The Android and iOS applications are in active **alpha development**. Features listed below reflect implemented source code, not a guarantee of successful operation on every device. The native apps are not yet production-certified or equivalent to a mature system file manager.

## Product capabilities

### Personal file library

- Import selected photos, videos, music, documents, and other supported files.
- Organize imported content into folders and browse it inside Media Manager.
- Search, sort, and inspect files; manage supported library items using rename, copy, move, delete, favorites, and other available actions.
- Preview supported image, audio, video, PDF, and text formats without leaving the application when the platform supports them.
- Share or export files through the operating system's supported sharing interfaces.
- Keep the web app shell available offline after its initial successful load, subject to browser storage policies.

### Media viewing and playback

- Open supported photos and documents in an integrated viewer.
- Play supported audio and video formats using the device's browser or native media frameworks.
- Edit small text documents where the relevant editor is available.
- Playback formats and capabilities depend on the platform; unsupported codecs may require another application.

### Privacy and local storage

- Local-first file organization; basic file browsing does not require a user account or paid API.
- Encrypted **Private Vault** copies: Web Crypto in the PWA, Android Keystore-based encryption in the native Android alpha, and CryptoKit/Keychain-based encryption in the native iOS alpha.
- Platform-specific PIN, biometric, or device-owner authentication where implemented.
- File hiding by name is **not encryption**. Vault copies are separate from original files, which remain in their existing locations unless explicitly managed.
- Local data may be lost if app data is cleared, an app is uninstalled, a browser evicts storage, or encryption keys are lost. Keep independent backups.

## Choose your platform

| Capability | Web / Home Screen PWA | Native Android alpha | Native iOS alpha |
| --- | --- | --- | --- |
| Installable app-like interface | Yes | Yes, via APK | Yes, after Xcode signing |
| Local personal library | Yes | SAF-selected folders and internal shared-storage explorer | App-owned Documents library |
| Device file import | Browser file/folder picker | Android Storage Access Framework | Native Files and Photos pickers |
| Browse shared internal storage without choosing each folder | No | Android 11+ after explicit **All files access** approval | No |
| File/folder operations | Implemented for imported library items | Native rename, copy/move, create, delete and hide/unhide foundations | Native create, rename, delete, search and favorites foundations |
| Media preview and playback | Browser-supported formats | Native supported image/audio/video/text | Quick Look, AVPlayer and text editor |
| Private encrypted copies | Browser IndexedDB vault | Android Keystore vault | CryptoKit/Keychain vault |
| App lock | Browser vault passphrase | Optional 1–64 character password or biometric-only lock (off by default) | Face ID, Touch ID or device passcode |
| Offline operation | Cached web shell and stored local files | Native local functionality | Native local functionality |
| Maturity | Deployed PWA; device-dependent | Alpha; physical-device acceptance pending | Alpha; physical-device acceptance pending |

**Storage access is controlled by the operating system.** No edition can bypass protected system folders or another app's private sandbox. In particular, iOS does not offer Android-style All files access, and the web app cannot silently enumerate a phone's filesystem.

## Web application

**Live:** https://tajoor621.github.io/media-manager/

The web edition is a responsive PWA built with React, TypeScript, Vite, Tailwind CSS, Zustand, and IndexedDB. It supports local file import, an in-app library, file viewers, and a web encrypted vault. It can be added to a phone's Home Screen for a standalone-style launch.

**Install on iPhone:** Open the live URL in Safari, then use **Share → Add to Home Screen**. Open the installed icon and import content through the app's library controls. Imported content is stored within the web app's storage; it is not a mirror of the iPhone's entire Files or Photos libraries.

**Install on Android:** Open the live URL in Chrome and use **Install app** or **Add to Home Screen**. A PWABuilder package uses web capabilities and **does not** acquire native file-manager permissions.

**Using the library:** Import files, open the Library, select an item to preview or play it, and use available item actions to organize, share, or export it. Browser storage can be cleared or evicted; export important files to a separate location.

## Native Android application

**Source:** [`android-native/`](android-native/) · **Build workflow:** [Native Android debug APK](.github/workflows/android-native.yml)

The native Android edition is written in Kotlin and uses Android's Storage Access Framework (SAF). On Android 11 and later, the **standard**, **foss**, and **system** variants can request optional **All files access** for shared internal storage. The **play** variant uses SAF only. This permission must be approved by the user in Android Settings.

### Install and open device files

1. Open [GitHub Actions](../../actions/workflows/android-native.yml) and select the latest **successful** native Android build.
2. Download the **`media-manager-621-native-standard-debug-apk`** artifact, extract the ZIP, and install **`app-standard-debug.apk`** on your Android test device.
3. Open **Media Manager 621 — Native**, open the app without a mandatory lock, then select **Enable internal storage access**.
4. In Android Settings, explicitly allow **Manage all files** for Media Manager 621, then return to the app.
5. When permission is active, the app should open the **shared internal storage explorer** automatically. Tap a folder to browse it; tap a supported file to open it; long-press an item for file actions.
6. If broad access is unavailable, use **Choose a folder** to authorize a supported directory through Android's system picker.

The native Android application includes source-level implementations for storage capacity information, a file/folder browser, name search, sorting, hidden-file toggle, details, copy/move, ZIP creation/extraction, selected-file previews, launchable-app listing, and encrypted private copies. **These functions remain alpha and must be validated on physical devices.** Large file operations and archive handling require further performance and reliability work.

**Troubleshooting: no files shown**

- Confirm you installed the **native Kotlin APK**, not a PWABuilder/TWA APK. They are different packages and do not have the same storage access.
- Check **Android Settings → Apps → Special app access → All files access** (wording varies by Android version), then return to Media Manager.
- If access is denied or unsupported, select a permitted folder using the SAF picker.
- Android may still restrict `Android/data`, `Android/obb`, root/system paths, and other apps' private files.
- A successful CI build proves compilation, **not** that storage browsing works on your phone. If the screen remains empty, record the Android version, exact APK source/build, and what happens when you select storage access so the failure can be reproduced.

Read the [Android development and permission notes](android-native/README.md).

## Native iPhone and iPad application

**Source:** [`ios-native/`](ios-native/) · **Build workflow:** [iOS simulator compilation](.github/workflows/ios-native.yml)

The native iOS edition uses SwiftUI, native Files and Photos pickers, Quick Look previews, AVPlayer playback, an app-owned document library, and a CryptoKit/Keychain vault foundation. Its native navigation, file operations, and authentication are separate from the Safari PWA.

The project uses **XcodeGen** to generate an Xcode project:

```bash
cd ios-native
brew install xcodegen
xcodegen generate
open MediaManager621.xcodeproj
```

A compatible Mac and Xcode are required. Select your Apple Account's Personal Team in Xcode signing settings to test on a personal iPhone where permitted by Apple's provisioning rules. The GitHub iOS workflow checks simulator compilation; it does **not** produce a signed, installable iPhone IPA.

Read the [iOS build and security notes](ios-native/README.md).

## Development

### Web

Requires Node.js 22 and npm.

```bash
npm ci
npm run dev
npm run typecheck
npm test
npm run lint
npm run build:pages
```

The GitHub Pages deployment is built from the web source and published to the `gh-pages` branch. Some optional cloud or nearby-sharing features require server-side infrastructure and are **not automatically available** on the static GitHub Pages deployment.

### Android

Requires JDK 17 and an Android SDK compatible with the project. From `android-native/`:

```bash
gradle :app:assembleDebug
```

GitHub Actions also builds the debug APK and attaches it to the workflow run. This is a development build, not a signed production release.

### iOS

Requires macOS, Xcode, and XcodeGen. Generate the project as shown above, then build with Xcode for a simulator or a properly provisioned personal device.

## Repository layout

```text
media-manager/
├── src/                       # React/TypeScript web application
│   ├── components/app/        # Navigation, library, viewers, vault UI
│   └── lib/files/             # File state, browser access, IndexedDB, vault
├── public/                    # PWA manifest, service worker and assets
├── android-native/            # Native Android Kotlin application
├── ios-native/                # Native iOS SwiftUI application
├── docs/                      # Platform audit and technical notes
├── scripts/                   # Web build and validation utilities
└── .github/workflows/         # Quality, web, Android and iOS CI
```

## Roadmap

Development priorities are **reliable storage onboarding**, native-device testing, scalable file lists, batch selection and operations, background copy/move with progress and cancellation, better media playback, stronger vault lifecycle testing, and improved accessibility. More advanced archive, network, and cloud capabilities will be introduced only after their implementations can be validated.

See [the platform audit](docs/PLATFORM-AUDIT.md) for feature gaps and engineering risks.

## Security and platform boundaries

Media Manager operates within Android, iOS, and browser permission models. All files access on Android is a user-approved special permission, **not** unrestricted root access. iOS Files and Photos imports are user-selected, and neither iOS nor a web PWA grants silent access to every device folder. Never use the encrypted vault as the sole copy of irreplaceable files without a tested backup and recovery plan.

## License

Copyright © Media Manager 621 contributors. No open-source license is currently declared; use and redistribution rights are reserved unless a license is added.
