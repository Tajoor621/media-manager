# Open Graph and PWA brand assets

## Brand-asset pass:

1. Inspect `src/lib/og/site.json` and the existing public assets before making changes.
2. Create or verify a custom 1200×630 Open Graph image at `public/og.jpg`, optimized below 600 KB. Set `"card": "custom"` in `src/lib/og/site.json` only when the custom image exists.
3. If the app needs an X feed banner, create a 1200×264 JPEG at `public/x-banner.jpg`, optimized below 600 KB.
4. Stage generated assets outside `public/` on the same filesystem, then use the atomic hand-over helper. Example commands:
   - `node scripts/write-atomic.mjs /workspace/.grok/og.jpg.tmp public/og.jpg`
   - `node scripts/write-atomic.mjs /workspace/.grok/x-banner.jpg.tmp public/x-banner.jpg`
   - `node scripts/write-atomic.mjs /workspace/.grok/site.json.tmp src/lib/og/site.json`
5. Run `node scripts/brand-check.mjs --root .` and the repository tests after changes.
6. Do not claim a production build passed unless the actual build command completed successfully.

The workspace-only marker is `/workspace/.grok/og-pending`; treat it as stale after 10 minutes. Do not commit credentials, temporary images, or generated workspace state.
