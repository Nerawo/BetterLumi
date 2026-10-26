# BetterLumi — Public repository preparation

## Public source and private development history

Publish only the separately prepared, sanitized source snapshot. Its main branch has one initial commit and no ancestry from the private development repository. An origin remote is already configured for Nerawo/BetterLumi; a configured remote does not establish whether a push has happened previously. This release-preparation run performed no fetch, push, repository creation or deployment.

The publication copy now includes the current application source, static reference catalogs, recipe image and tests. The earlier full browser validation failed; targeted repair now passes all affected families, but one final full release validation is still pending. No final release commit was created. Review [publication validation](publication-validation.md) before any upload; do not publish the older committed tree as though it contained the newly tested source.

The original development repository, its commits, backup branches and historical tags remain local and private. A verified Git bundle and a pre-publication backup branch protect the original checkpoint. Do not push that repository, use a mirror push, or copy its .git directory into the public snapshot. Cleaning a current file does not remove earlier versions from Git history.

## Where user data lives

BetterLumi stores wellness records, images, profile settings and goal history in the browser's origin-scoped IndexedDB database named BetterLumi. Page state and unsaved goal drafts use sessionStorage. Publishing the source repository or creating a static build does not publish that browser database. No database identity, origin, schema, migrations or user records need to change for publication.

Explicit JSON exports contain database tables and may include private food, weight, exercise, body, goal, note and image data. Keep all exported backups outside Git, preferably outside the repository. Never put private files under public/: Vite copies that directory into the deployed output.

## Synthetic tests only

Programmatically generating a fixture does not make it anonymous. Do not copy real measurements, timestamps, personal profile combinations, user notes or private exports into tests, documentation or screenshots intended for publication. Regression tests use explicitly fictional adult profiles and measurement timelines; see [synthetic test data](synthetic-test-data.md). Maintain mathematical and boundary coverage when changing fixtures.

The source review found no common-format credentials or complete user database exports. Earlier development history included identifying machine paths and health-derived scenarios; it is deliberately excluded from the public repository. The original historical versions remain only in the private development backup. Pattern scans are helpful but cannot prove the absence of every secret.

## Ignored local artifacts

Dependencies, dist, generated OCR assets, work, test reports, local environments, common credentials, private database dumps and default BetterLumi backup names are ignored. Additional protected directories include screenshots, profiles, local-data and data-exports. Browser authentication state and IndexedDB/Local Storage dump directories are also excluded.

Ignore patterns do not protect already tracked files and cannot identify every arbitrarily named private JSON file. Inspect staged content before each publication. Do not upload a ZIP of the whole development folder or force-add ignored files. Local screenshots and test browser profiles are not publication artifacts.

## Validation and deployment

Run npm ci, npm run typecheck, npm test and npm run build. Browser tests use fresh isolated contexts, never the user's everyday browser profile or localhost:5173 storage. This run served the public source on isolated ports 5192/5194 and the production build on 5193. The default test configuration uses 5190; ensure it is serving the intended checkout rather than reusing another development server. Touch-dependent suites require hasTouch: true. Do not seed tests from a personal browser or export. Existing old visual tests can describe retired layouts; investigate them without changing unrelated application behavior to satisfy them.

The database remains BetterLumi schema 6 and the primary JSON backup format remains version 9. Built-in food/exercise/recipe definitions remain static references, not seeded user records. Logged nutrition and exercise values remain independent snapshots. This publication sync adds no schema migration and changes neither the normal development port nor the user's browser storage.

Future static deployment uses npm run build and publishes dist over HTTPS. Paths currently assume a domain root; a GitHub Pages repository subpath needs separate validation. A new domain is a different browser-storage origin; transfer private data only through explicit local backup/import if desired.

Review image redistribution rights before distribution and select a project license intentionally. Existing font license files remain included. A public repository does not automatically grant a project-wide open-source license.

No GitHub creation, push, public upload or deployment is part of local preparation. Publish only after explicit approval.


See [browser triage and targeted repair](browser-triage.md) for the October 26 follow-up: 259 targeted development cases, one production-preview case and 27 overlapping touch cases passed. These targeted results do not replace the final complete release gate.
