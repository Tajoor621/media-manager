# Media-Manager Android Security

## Phase 1 baseline

- **SAF first.** File browsing works through the Android system folder picker without storage runtime permissions. Persisted URI grants are scoped to the selected tree and can be revoked in Android Settings.
- **Optional All files access.** Only the `standard`, `foss`, and `system` variants declare `MANAGE_EXTERNAL_STORAGE`. The `play` variant does not. This special permission is never required to use SAF; Android still protects other apps' private data. Distribution through Google Play requires independent policy review.
- **Sharing.** The non-exported `FileProvider` exposes only app-owned `shared/` cache/files directories. The former unrestricted `<external-path path="."/>` mapping was removed. Native previews use in-process file URIs and must not send `file://` URIs to other applications.
- **External opening.** The exported launcher handles narrow `ACTION_VIEW` content URI intents for supported image, audio, video, and plain text types. Unknown schemes are rejected. The app does not claim PDF, archive, or arbitrary network URL handling yet.
- **Name/path validation.** `core:files` validates leaf names and root boundaries; a unit test covers traversal and malformed names. Android content providers remain responsible for enforcing their own grants.
- **App lock and vault.** The app lock is optional and off by default; single-character passwords are permitted but insecure. Vault uses Android Keystore AES-GCM encrypted copies. A lock-screen password is not the vault encryption key. Clearing app data can permanently destroy vault keys.
- **Network.** The base manifest declares no `INTERNET` permission; cleartext traffic is disabled. No LAN server is implemented in Phase 1.
- **Components.** The launcher is exported for Android launch and content VIEW intents. The FileProvider is not exported. No unnecessary boot, tile, receiver, or foreground service entries are declared.
- **Privacy.** Diagnostic logs should not include file paths, file contents, tokens, passwords, or encryption keys. Review Logcat output before sharing it.

## Build flavors

| Flavor | Broad storage declaration | Ads/analytics/billing | Status |
| --- | --- | --- | --- |
| `standard` | Optional special access | None | Phase 1 |
| `foss` | Optional special access | None | Phase 1 |
| `play` | No | None | Phase 1 policy-friendly baseline; not a Play release |
| `system` | Optional special access | None | Placeholder for later privileged work; no privileged permissions yet |

These are build-time distribution boundaries, not complete commercial integrations. No Google or Amazon SDK is included in any flavor.

## Reporting security issues

Do not post passwords, encryption keys, private paths, or personal files in public issues. Provide minimal reproduction steps, affected build/flavor and Android version, and sanitized logs. For severe vulnerabilities, use GitHub private vulnerability reporting when enabled by the repository owner.

## Limitations

Phase 1 does not yet implement transfer foreground services, trash, network sharing, comprehensive external viewers, backups, sync, or privileged shell execution. Archive operations and some legacy file actions still need further reliability and lifecycle testing. Do not treat the alpha vault as your only backup.
