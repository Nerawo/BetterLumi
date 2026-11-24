# Yozai typography-only refinement

Official latest release verified: v0.868, published 2025-09-12. Source/size/hash, conversion and OFL details: src/assets/journal/README.md and yozai-manifest.json. Source is official lxgw/yozai-font release only. Original license is release-pinned and retained; renamed derived family avoids reserved primary names.

## Changes

- Added six journal-ink-0..5.woff2 files, yozai-OFL.txt, yozai-manifest.json and src/journal-yozai-font.css (six local Unicode-range faces).
- Removed journal-only wenkai.woff2 and wenkai-OFL.txt after confirming no other runtime use. Caveat and its license unchanged.
- src/cooking-journal.css imports the generated faces and replaces obsolete WenKai aliases. Chinese method text, ingredient names, group headings and intentionally journal-styled labels in Detail/Editor use JournalChinese with existing system fallbacks. Inputs and primary titles are excluded.
- src/cooking-mode-compact.css replaces only the Chinese font alias. All sizes, line heights, flex wrapping, 52/48 columns, checkbox targets, compact spacing and fallback layout remain unchanged. CSS ranges exclude Latin/ordinary numeric glyphs; quantities, buttons, stepper, progress, titles, dates and nutrition remain on their existing faces. English Method/Ingredients stay Caveat.
- public/fonts/journal-licenses.html updated for offline-distributed Caveat + Yozai notices.
- tests/cooking-journal-visual.spec.ts verifies actual CJK face load (simplified + traditional) and mixed long labels, while retaining prior interaction and inventory assertions.

## Payload and coverage

26006 Unicode mappings, 7881036 bytes total WOFF2 (7.52 MiB), largest file 1494288 bytes. Source TTF 15,605,374 bytes. No extremely narrow sample-only subset. The broad-coverage handwriting payload is larger than the old WenKai subset; initial offline caching costs about 7.5 MiB, an intentional consistency tradeoff. Six files fit the existing precache cap without changing PWA/deployment configuration.

## Verification

- TypeScript PASS; production Pages-subpath build and PWA generation PASS (128 precache entries, all font blocks included).
- 18 targeted WebKit cases PASS: 320/375/390/430, zh/en, four themes, short/long/mixed labels, checks, grouping, persistence, stepper confirmation, source inventory preservation.
- Fresh production preview offline reload PASS: all six font blocks + license page cached; simplified/traditional glyph face loads; no external font requests or runtime errors. See work/yozai-offline.log.
- 390px sample content height 366.125px versus prior 365.5625px; rows remain 44px. No spacing compensation needed.
- Schema 7, Backup 12, database identity, recipes, sessions, stable IDs, grouping, nutrition, inventory and historical records unchanged. editorial-directories.css unchanged (SHA256 8630e4c0ad3d8705c53ae0f0d961e595e4cca60c76275f0e58a7818642b9ce85).

## Review images

work/screenshots/yozai-cooking-390.png
work/screenshots/yozai-checked-390.png
work/screenshots/yozai-cooking-320.png
work/screenshots/yozai-detail-390.png

Native iPhone Safari/PWA verification is still required. Unsupported characters retain system fallbacks rather than substituted glyphs. Earlier local implementation work remains preserved. No commit, push or deployment.
