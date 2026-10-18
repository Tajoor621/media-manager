## Phase 1 — SAF-first native Android architecture

**Status:** Phase 1 implementation under verification. The native Android application keeps its original package ID `com.media.manager621` and Android 8.0 minimum (`minSdk 26`). The application UI still uses Kotlin Views; a Compose/Room migration is planned but not falsely represented as complete.

**Build flavors:** `standard` (optional All files access), `foss` (same storage option, no ads or analytics), `play` (SAF only, no All files permission), and `system` (reserved for future privileged functionality; no system-only permissions are declared). No commercial SDK is bundled in any flavor.

**Permissions and purpose:**

| Declaration | Flavors | User-facing reason |
| --- | --- | --- |
| Persisted SAF URI grants (no manifest permission) | All | Access only the folder/document chosen through Android's picker |
| `MANAGE_EXTERNAL_STORAGE` | standard, foss, system | Optional internal shared-storage explorer on Android 11+; requires a separate Android Settings approval |
| `INTERNET` | None | No network server/client is implemented yet |
| Notification/foreground service/boot/install permissions | None | Future features must implement the matching functionality before requesting them |

**Native app modules:** `app` contains the launcher, optional app lock, vault, SAF and internal browser, file operations and the secure FileProvider. `core:files` provides reusable SAF operations, filename validation and boundary checks, with unit tests.

**Build and test:**

```bash
cd android-native
gradle :core:files:testDebugUnitTest :app:testStandardDebugUnitTest
gradle :app:assembleStandardDebug :app:assembleFossDebug :app:assemblePlayDebug :app:assembleSystemDebug
```

Download the latest successful `media-manager-621-native-standard-debug-apk` artifact from [GitHub Actions](../.github/workflows/android-native.yml), extract it, and install `app-standard-debug.apk`. **Do not use PWABuilder** to test native storage functionality. A build passing CI does not guarantee installation on every device.

**External file opening:** The exported activity handles granted `content://` VIEW intents for images, video, audio and plain text. Other file types and additional intent actions will be introduced with their actual viewers in Phase 2.

See [Phase 1 acceptance checklist](PHASE1.md) and [Android security policy](SECURITY.md). Phase 2 will not start until Phase 1 is reviewed.

# Media Manager 621 — Native Android alpha

This is a **separate native Android source project**, not the PWABuilder Trusted Web Activity. It introduces Android's Storage Access Framework, user-approved persisted tree grants, an optional All files access settings link, a native explorer, a private encrypted vault and an optional app lock. It is not an unrestricted system-file browser.

## Build and install

Use Android Studio (JDK 17, Android SDK 35), open `android-native/`, sync Gradle and build `app` debug. The CI workflow builds a debug APK artifact for testing. The APK is not signed for Play Store distribution.

## Native navigation update (X-plore-style goal)

On Android 11+, open the native app, choose **Grant broad storage access (Android Settings)** and explicitly enable **Allow access to manage all files**. Return to the app. It now automatically opens **Internal shared storage** with a directory list, used/free storage meter, Private Vault and an **Installed apps (launchable)** view. Subsequent launches open internal shared storage automatically while the permission is retained. SD cards or provider-specific document trees may still require separate user-approved SAF access.

The installed-apps view shows **launchable apps visible to Android's package manager**, not every system package. It links to Android App Info without accessing other apps' private data. Android continues to protect certain directories even after All files access is granted.

## Permissions and boundaries

- **Choose folder** uses `ACTION_OPEN_DOCUMENT_TREE`, takes persistable read/write URI grants and browses the approved tree.
- **All files access** opens the Android **system Settings** approval screen for `MANAGE_EXTERNAL_STORAGE` on Android 11+. Approval is optional, cannot be granted programmatically, and Android blocks protected paths even after approval. Google Play limits this permission to qualifying file-management apps.
- The native explorer browses user-approved SAF folders and, after Android explicitly grants All files access, offers a separate native internal-storage explorer. Android still protects system and app-private paths.
- **Hide** is a dot-prefix rename where the SAF provider allows it. This is not security; encrypted Vault is used for private files.
- **Vault** encrypts a private copy using AES-256-GCM with a non-exportable Android Keystore key. It does not erase the original. To avoid false security guarantees, vault files are not exportable until an explicit authenticated export workflow is implemented.
- The app opens unlocked by default. Under **Security & app lock**, users can optionally set a 1–64 character alphanumeric password, choose biometric-only authentication if supported and enrolled, or turn the lock off. A one-character password is weak and should not be relied on to protect sensitive information. Password verification uses PBKDF2-HMAC-SHA256 with a random salt. The vault encryption key is bound to the app installation, not the app password; the password only locks the UI. Removing app data deletes encrypted files and key material.
- **Biometric** uses Android BiometricPrompt for optional biometric-only unlock without requiring an app password. A supported strong biometric must be enrolled first; the device screen lock remains managed by Android.
- Audio/video/image/text preview uses Android's native viewers within the app. Some formats and editing capabilities are not supported.
- This is an **alpha**: requires Android device testing and hardening before a production security claim.

## Troubleshooting — App won't open

**Use the native APK:** Open [Build native Android debug APK](../.github/workflows/android-native.yml) in GitHub Actions, choose the latest **successful** run, download `media-manager-621-native-standard-debug-apk`, extract the archive and install `app-standard-debug.apk`. The native APK package is `com.media.manager621`. A **PWABuilder APK** is a web wrapper and cannot provide native all-files storage access.

**Uninstall older test builds when installation fails:** Android requires compatible signing certificates for in-place updates. A locally built APK, an APK from another GitHub Actions runner, and a PWABuilder package can be signed differently. If Android reports `INSTALL_FAILED_UPDATE_INCOMPATIBLE`, back up app-owned files first, uninstall the conflicting installation, then install the new APK. **Uninstalling or clearing app data deletes app-private Vault content and its Keystore key; encrypted copies may become unrecoverable.** Never uninstall until needed data is exported or safely backed up.

**Check Android version and permissions:** The project supports Android 8.0+ (`minSdk 26`), targets API 35, and needs real-device testing across Android 8–16. Android 11+ uses Settings → Special app access → All files access for the optional internal shared-storage explorer. On Android 8–10 use the system folder picker. Protected system folders remain inaccessible.

**Capture a startup crash log:** Enable Developer options and USB debugging on your own test phone, connect to a computer with Android SDK Platform Tools, then run:

```bash
adb devices
adb logcat -c
adb shell am force-stop com.media.manager621
adb shell monkey -p com.media.manager621 1
adb logcat -d -v time -s AndroidRuntime:E MM621:D > media-manager-launch.log
```

If the app is not installed, use `adb install -r app-standard-debug.apk` and read the exact error. Share the relevant exception and stack trace from the log, **after removing personal paths, file names and other private data**. Android Studio's Logcat view can filter by `com.media.manager621` and `MM621`.

**If the app opens but no files appear:** Approve All files access on Android 11+ or choose a folder using the Storage Access Framework picker. The first screen now explains the permission process. The app's lock is **off by default**; optional passwords can contain 1–64 characters, and supported biometric-only locking is available from Security & app lock.

**Build troubleshooting:** Use JDK 17, Android SDK Platform 35, Gradle 8.10.2+ and AGP 8.7.3. GitHub Actions builds `app-standard-debug.apk` with a pinned Gradle setup. A successful build does not replace a launch test on physical devices.

## Source organization

- `MainActivity.kt`: entry, lifecycle, basic navigation and startup recovery dialog.
- `StorageExplorer.kt`: SAF and internal storage browsing, folder listings and storage permissions.
- `FileOperations.kt`: file management, previews, rename, move/copy and ZIP operations.
- `SecurityScreen.kt`: optional password/biometric app lock settings and unlock.
- `VaultScreen.kt`: encrypted vault import, listing, preview and delete UI.
- `Vault.kt` and `PinSecurity.kt`: Keystore encryption and password verification.
- `res/values/themes.xml`, `res/values/colors.xml`, `res/mipmap-anydpi-v26/`: Material 3 theme and adaptive launcher icon.

Folder listings and ZIP archive operations are scheduled off the main UI thread to reduce freezes. Startup exceptions are logged under `MM621` and displayed using a recovery dialog when Android can render the UI.

## Web / iPhone

The existing GitHub Pages PWA remains the iPhone and web edition. iOS web apps cannot access the whole filesystem; use authorized imports and in-app library/vault features when implemented for web. Native Android-only features cannot be silently added to an iPhone PWA.
