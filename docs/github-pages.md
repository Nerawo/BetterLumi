# GitHub Pages compatibility

The production target is https://nerawo.github.io/BetterLumi/. Browser routes use
the hash, for example `/BetterLumi/#/today?date=2037-10-20` and
`/BetterLumi/#/recipes/builtin-recipe-tagliatelle-ragu-bolognese`. Hash routes do not
require a server-side SPA rewrite or a custom 404 bridge. Existing local links
such as `/today?date=...` still normalize to hash routes on the development server.

## Build configuration

`APP_BASE` is the single build/development setting. It defaults to `/`, keeping
local development on its existing port 5173. The Pages workflow sets it to
`/BetterLumi/`. Vite exposes the resolved path through `import.meta.env.BASE_URL`;
routes, manifest launch/scope/icons, service-worker scope/fallback, built-in images
and local OCR resources follow that base. CSS and HTML assets are rebased by Vite.

For PowerShell:

```powershell
$env:APP_BASE='/BetterLumi/'
npm run build
Remove-Item Env:APP_BASE
npx playwright test --config playwright.pages.config.ts
```

The Pages tests serve `dist` using a test-only static server under `/BetterLumi/`.
Unknown paths return 404; there is no Vite middleware or SPA fallback. The server's
in-memory worker revision endpoint is only a test fixture and is never uploaded.
The production-only suites are excluded from the development browser suite and
run with their dedicated configurations. Root production preview requires a
root-base build before `playwright.goal-preview.config.ts` is run.

## Updates and data

Service-worker registration uses the configured application scope. A waiting
worker produces a small bilingual update notice. Users can choose Later, or
save their edits and explicitly choose Update and reload. Activation in another
tab never forces this tab to reload. There is no polling, visibility-triggered
reload, automatic form submission, storage reset or database cleanup. Ordinary
browser registration checks discover updates; long-open tabs can also discover
them through the browser's normal worker update lifecycle.

Only application assets are precached. Workbox's application cache lifecycle is
independent of the `BetterLumi` IndexedDB database (schema 6) and backup format 9.
This patch adds no database migration and rewrites no user records or snapshots.
Changing a build never copies the local developer's browser storage into `dist`.

Localhost and `https://nerawo.github.io` are different storage origins. A production
visit starts with its own browser-local data. Subsequent deployments on that same
origin and with the same database identity retain the production database, subject
to normal browser storage availability and user clearing. All project sites on
`nerawo.github.io` share an origin; a path alone does not isolate IndexedDB.

## Deployment, only after review

The official-action SHAs in `.github/workflows/pages.yml` are pinned. The workflow
installs locked dependencies on Node 24, checks TypeScript, runs unit tests, builds
with the Pages base and uploads only `dist`. Build and deployment are separate
jobs, with deployment permissions restricted to the latter. Deployments are
serialized. Generated output remains ignored and must not be committed.

1. Review and commit the compatibility changes locally when satisfied.
2. On GitHub, choose Settings > Pages > Build and deployment > Source > GitHub Actions.
3. Leave Custom domain unset. Review any `github-pages` environment protection rules.
4. When ready to publish, push `main` or use the workflow's Run workflow action.
   A push to `main` triggers this workflow; do not push it merely to preview a patch.
5. Confirm the deployment URL, hash-route refresh, installed launch, offline assets
   and a subsequent update on the intended browsers, including physical iPhone Safari.

No personal token, analytics, cloud sync or wellness upload is required. Browser
wellness data stays local; do not put private JSON backups or screenshots in `public`.

For a later custom domain, build with `APP_BASE=/` and update the workflow setting.
The hash router needs no second rewrite. A new domain is a new data origin; any
private transfer must be a separate explicit user backup/import, never deployment logic.

## Compatibility validation — October 26, 2026

- TypeScript passed; 462 unit tests passed in 59 files.
- Complete development-browser regression: 444 passed, 0 failed, 4 optional LAN cases skipped. Production-only cases were excluded and run separately.
- Root-base production preview: 2 passed (Chrome and WebKit).
- Project-subpath production tests: 6 passed (Chrome and WebKit), including first entry, routing, history, refresh, recipe links, dates, manifest/worker scope, static resources, OCR cache, offline reload, and real waiting-worker activation.
- Update prompts were inspected in Chinese and English at mobile/desktop widths. Cross-tab activation did not reload the editing tab; the draft survived the explicit update, and no active goal was created from that unfinished draft.
- Root and /BetterLumi/ builds passed. The existing large-JavaScript-chunk advisory remains. Dependency installation retained the existing upstream glob deprecation warning; no dependency upgrade was made.
- Database and backup implementation files are byte-for-byte unchanged from the checkpoint: BetterLumi schema 6, backup format 9. No real user browser profile was accessed.

An initial parallel regression run exposed an existing test race: the sticky-note test reloaded immediately after clicking an asynchronous save. The test now waits for the created note before reloading and verifies it again afterwards. Application save logic was not changed; the subsequent complete regression passed.

Physical iPhone Safari/PWA behavior and the actual GitHub-hosted Actions deployment remain manual checks. No push, deployment, GitHub release or local commit was created for this patch. Generated output, browser profiles and reports remain ignored.

## Changed-file inventory

- `vite.config.ts`: configurable validated base and scoped PWA resources/fallback.
- `src/route-urls.ts`, `src/routing.ts`: hash transport with deployment-independent logical routes.
- `src/main.tsx`, `src/session-state.ts`, `src/usePageSession.ts`, `src/Recipes.tsx`: routing consumers, session/scroll restoration and recipe links.
- `src/pwa-updates.ts`, `src/PwaUpdatePrompt.tsx`, `src/pwa-update.css`: consent-gated update controller and compact bilingual notice.
- `.github/workflows/pages.yml`: pinned official Actions, isolated build/deploy jobs and dist-only artifact.
- `playwright.config.ts`, `playwright.pages.config.ts`: separate development and subpath-production suites.
- `src/route-urls.test.ts`, `src/pwa-updates.test.ts`, `tests/github-pages.spec.ts`, `tests/support/pages-server.mjs`: focused route, consent, static-host and worker tests.
- `tests/review.spec.ts`: expected hash URL.
- `tests/update.spec.ts`: wait for asynchronous note save before reload.
- `docs/github-pages.md`: build, safety, deployment and validation instructions.
