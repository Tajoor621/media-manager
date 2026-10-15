# Site identity

Set the intended `title` and `description` in `src/lib/og/site.json`. Set `"card": "custom"` only when the custom `public/og.jpg` asset is available. Stage the replacement outside the target directory and use:

`node scripts/write-atomic.mjs /workspace/.grok/site.json.tmp src/lib/og/site.json`
