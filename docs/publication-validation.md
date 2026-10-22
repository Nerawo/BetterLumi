# Publication validation

The public repository is a fresh source-only snapshot with a single main-branch root commit, no private development ancestry, no backup tags and no remote. The private development repository and its pre-publication Git bundle remain separate.

## Sanitization

Only tests, documentation and .gitignore changed. All 128 production source modules/styles match the private checkpoint after Git line-ending normalization. Database identity, schema, migrations, application origin and runtime behavior are unchanged.

Synthetic examples are documented in synthetic-test-data.md. Regression assertions were updated for the fictional measurements, unit conversions, BMI and additional exercise expenditure. Stable IDs, chronological ordering, goal-history safety and safety-boundary behavior remain covered. Private screenshots, reports, browser profiles and exported user data are excluded.

## Checks

- TypeScript check: passed.
- Unit tests: 46 files, 319 tests passed.
- Affected browser coverage: 57 unique cases passed using isolated Chrome contexts on the test origin, including Chinese/English, 390/430px, selected desktop cases, goal application, persistence and timestamp synchronization. The calculator suite was rerun at final mobile widths after an interrupted development reload; all 28 cases passed in that stable run.
- Production build: passed; the existing large-JavaScript-chunk advisory remains.
- Existing code audit: reports three retained, unreachable OCR compatibility modules (label-ocr.ts, LabelOcrPanel.tsx, nutrition-label.ts); no missing literal translations. These unrelated modules were retained.
- Privacy/secret scan: the publication snapshot has no detected common-format credentials, personal account paths, concrete private LAN addresses, reported measurement fixture or complete user exports.
- Ignore rules: designated private directories, browser storage/auth exports, default application backups and build/test artifacts are excluded; legitimate source JSON remains eligible for Git.

No everyday browser profile or user database was opened or altered. Tests used fake IndexedDB or fresh browser contexts; no GitHub repository, push or deployment was performed. Physical iPhone Safari still requires device testing. Pattern scanning is not a guarantee against every possible secret; maintain review of staged files and keep all future fixtures synthetic.
