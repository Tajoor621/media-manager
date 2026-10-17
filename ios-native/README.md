# Media Manager 621 — Native iPhone / iPad (SwiftUI)

This is a **genuine SwiftUI iOS application source project**, not a Safari shortcut or WKWebView wrapper. It is separate from the existing React PWA and Kotlin Android app, under the same brand and GitHub repository.

## Implemented in the first native iOS source milestone

- Native SwiftUI navigation and file list, black/gold styling, search, sort by name/size, favorites, hidden-file toggle, file details, folder navigation and creation, rename and delete.
- Import multiple files from the **Files** document picker with security-scoped access, and import selected photos/videos with **PhotosPicker**. Files are copied into the app's own Documents/My Library folder.
- In-app **Quick Look** preview, **AVPlayer** for supported audio/video, UTF-8 text editor for files under 2 MB, and iOS share/export sheet.
- **LocalAuthentication** unlock using device-owner authentication (Face ID, Touch ID or iPhone passcode). The app locks when sent to the background.
- Encrypted private copies with **CryptoKit AES-256-GCM**, device-only Keychain symmetric key, file protection, authenticated vault export, and encrypted file names. Vault import leaves the original file intact.
- No account, cloud backend, subscriptions, paid APIs or analytics are required for local functionality.

## Build

Requires macOS with Xcode and XcodeGen. From `ios-native/`:

```sh
brew install xcodegen
xcodegen generate
open MediaManager621.xcodeproj
```

Choose the `MediaManager621` scheme and an iPhone simulator or a connected iPhone. **On-device installation requires Apple's signing/provisioning workflow**. A free Apple ID may permit personal device testing in Xcode subject to Apple's current restrictions; App Store/TestFlight distribution generally requires the Apple Developer Program. The GitHub Actions workflow compiles an **unsigned iPhone simulator build** and does not produce an installable iPhone IPA.

## Important iOS limits

- iOS **does not allow scanning every folder**, root filesystem or another app's private data. This native app uses user-selected Files/Photos imports and a fully managed sandbox library.
- iOS document-provider permissions can grant access to selected items, but the app cannot silently obtain all-files access.
- An installed native iOS app cannot be delivered to users merely by adding the GitHub Pages URL to the Home Screen.
- File imports are **copies**, not edits to the original source file.
- Hiding a file by prefixing its name with `.` is a library organization feature, **not encryption**. Use Private Vault for encrypted copies.
- Keychain keys use `WhenUnlockedThisDeviceOnly`; uninstalling, resetting or losing access to key material may make vault contents unrecoverable. No recovery, cloud backup or device migration is implemented.
- Photo import currently reads selected assets into memory and should be redesigned for very large videos.
- App locking protects the UI but is not a substitute for a formal penetration test; export temp files must be treated carefully.
- Media playback is restricted to formats supported by the installed iOS codecs. PDF/document Quick Look support varies by file type.

## Not yet implemented

Dual-pane explorer, batch move/copy, archive editing, full photo/video editors, network transfers, cloud OAuth providers, thumbnails, background transfers, reliable progress/cancellation for large files, import/export backups, biometric-gated per-file vault keys, accessibility/device testing, production app icon assets and App Store signing.

**Status:** native iOS source milestone / alpha. CI compile and real-device tests are needed before a release-readiness claim.
