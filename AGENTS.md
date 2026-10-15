# Repository instructions

## Development workflow

- Keep the GitHub Pages build self-contained and do not add secrets to public files.
- Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build:pages` before describing a release as verified.
- The GitHub Actions workflow in `.github/workflows/pages.yml` is the single deployment source of truth.

## Brand-asset pass

Never use `wait_tasks` or `get_task_output` to wait on background work. Inspect files directly and report only verified outcomes. The workspace-only marker is `/workspace/.grok/og-pending`; treat it as stale after 10 minutes.
