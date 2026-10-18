# Phase 1 — scope, acceptance and review

## Implemented

- [x] Kept the existing application ID `com.media.manager621` for continuity; did not copy any proprietary branding.
- [x] Added Android library module `core:files` for SAF operations, leaf-name validation and root boundary checks.
- [x] Kept the existing native browser, folder picker, internal storage mode, optional app lock, vault and file operations.
- [x] Made SAF the default path and limited optional All files access to build flavors that declare it.
- [x] Added `standard`, `system`, `play`, and `foss` product flavors with separate merged permission manifests.
- [x] Restricted the FileProvider to app-owned `shared/` directories; internal preview remains in-process.
- [x] Added narrow external `ACTION_VIEW` handling for content URIs with image/audio/video/plain-text MIME types.
- [x] Added network security config, safe filename validation, and initial unit tests.
- [x] Updated CI to assemble all flavors, run core unit tests, verify the standard APK signature, and publish the standard APK.
- [x] Documented security model, permissions, known gaps and install troubleshooting.

## Pending validation / intentionally deferred

- [ ] Confirm all four variants compile and unit tests pass on GitHub Actions.
- [ ] Install and launch `standardDebug` on Android 8, 10, 11, 13, 14, 15 and 16.
- [ ] Test SAF permission revocation, folder listing, rename and provider-backed copy with real providers.
- [ ] Test external VIEW intents and protected storage boundaries.
- [ ] Add instrumented tests and lifecycle-safe background transfers.
- [ ] Complete Compose/Room/ViewModel architecture migration incrementally; current UI remains legacy Kotlin Views.
- [ ] All Phase 2+ features, including Media3, servers, sync, shell, ads/billing and Firebase.

## APK installation warning

A GitHub Actions **debug** APK may use a different signing key from a previous debug build. Android rejects an update when the package name matches but the signature differs. If you need to replace an installed debug app, **export your data first**: uninstalling erases app-private data and may make Vault copies unrecoverable. Deleting an APK from Downloads does not uninstall an installed app.

Use the artifact `media-manager-621-native-standard-debug-apk` and install the extracted `app-standard-debug.apk`. This is a native Android package, not a PWABuilder APK.

## Review gate

Do not begin Phase 2 until the user reviews Phase 1 and the native install/launch/SAF smoke tests have been completed.
