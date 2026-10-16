# Media Manager 621 — Native Android alpha

This is a **separate native Android source project**, not the PWABuilder Trusted Web Activity. It introduces Android's Storage Access Framework, user-approved persisted tree grants, an optional All files access settings link, a native explorer, a private encrypted vault and a PIN lock. It is not an unrestricted system-file browser.

## Build and install

Use Android Studio (JDK 17, Android SDK 35), open `android-native/`, sync Gradle and build `app` debug. The CI workflow builds a debug APK artifact for testing. The APK is not signed for Play Store distribution.

## Permissions and boundaries

- **Choose folder** uses `ACTION_OPEN_DOCUMENT_TREE`, takes persistable read/write URI grants and browses the approved tree.
- **All files access** opens the Android **system Settings** approval screen for `MANAGE_EXTERNAL_STORAGE` on Android 11+. Approval is optional, cannot be granted programmatically, and Android blocks protected paths even after approval. Google Play limits this permission to qualifying file-management apps.
- The native explorer initially browses user-approved SAF folders. A separate internal-storage explorer for the special all-files permission is not yet implemented.
- **Hide** is a dot-prefix rename where the SAF provider allows it. This is not security; encrypted Vault is used for private files.
- **Vault** encrypts a private copy using AES-256-GCM with a non-exportable Android Keystore key. It does not erase the original. To avoid false security guarantees, vault files are not exportable until an explicit authenticated export workflow is implemented.
- A locally stored PIN verifier uses PBKDF2-HMAC-SHA256 with a random salt. The vault encryption key is bound to the app installation, not the PIN; the PIN locks the UI. Removing app data deletes encrypted files and key material.
- **Biometric** uses Android BiometricPrompt for optional unlock. It does not replace the PIN or device screen lock.
- Audio/video/image/text preview uses Android's native viewers within the app. Some formats and editing capabilities are not supported.
- This is an **alpha**: requires Android device testing and hardening before a production security claim.

## Web / iPhone

The existing GitHub Pages PWA remains the iPhone and web edition. iOS web apps cannot access the whole filesystem; use authorized imports and in-app library/vault features when implemented for web. Native Android-only features cannot be silently added to an iPhone PWA.
