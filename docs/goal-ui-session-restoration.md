# Personal Goals UI and session restoration

## UI changes

- Target units now sit immediately after their inputs. Calories remains primary; macros use two compact columns from 360px upward and one column below that width.
- Two touch/keyboard information controls: Calories and Detailed Nutrition Planning. The shared macro explanation reads the saved tolerance preferences; no hardcoded displayed tolerances.
- Existing enable flags, modes, dates, range calculations, history, themes, and validation remain unchanged.

## Investigation

No application visibility/focus/pageshow handler was found that reloads or navigates merely on resume. The former 30-second date interval only called React state with the local date; it did not reload the page. It is now a single local-midnight timer while visible, refreshed on resume, with no background polling.

Confirmed state-loss paths were memory-only Today tab selection and goal form state, plus in-memory scroll positions. Leaving Today unmounts its editor; a genuine reload also lost those values. In English, initial Chinese rendering before saved-language hydration caused a small scroll offset. Saved-language/theme initialization now happens before paint and scroll restoration waits for the correct language.

Development Vite 6.4.4 has a separate reconnect reload path: `node_modules/vite/dist/client/client.mjs`, the `vite:ws:disconnect` handler waits for a successful ping and calls `location.reload()`. This is a plausible development-only cause when an iPhone suspends networking, not a confirmed diagnosis of the reported physical-device incident. PWA registration uses prompt updates; no application resume-triggered service-worker reload was found. React StrictMode's initial development remount is not a 20-second timer.

## Restoration and safety

- Session storage retains the route, Today tab, selected date and page scroll positions. The selected local date is explicit in the Today URL, so midnight does not silently replace the edited date. Explicit deep links are respected; the PWA root launch can resume the last route.
- Goals drafts use separate per-date `betterlumi.goal-draft.v1:*` session keys, matched to the saved goal version. Empty numeric fields, disabled values, advanced expansion and unsaved dates/modes are retained. Cancel discards the draft; successful explicit save discards it after creating the ordinary dated version.
- Drafts never enter IndexedDB, active goal evaluation, or JSON backups. No database schema, migrations, committed records, tolerance preferences, or backup format changes.
- A bounded local lifecycle trace (`betterlumi.lifecycle.v1`, last 20 events) records document time origin, navigation type and lifecycle events. A different document time origin indicates a new document; the same origin across foreground events rules out a full reload. No telemetry, network work or polling is added.
- iOS can terminate a Safari/PWA process under memory pressure. This cannot be prevented by application code. Restoration is best effort if the same tab's session storage survives. Closing the tab, storage eviction/denial, or starting an unrelated new session may lose drafts. Other modules' unsaved forms have not gained reload persistence in this focused Personal Goals task.

## Physical-phone test without development hot reload

Keep the same URL/origin, including the computer IP and port. Stop the existing Vite server in its own terminal with Ctrl+C, then run from the project directory:

```powershell
npm.cmd run build
npm.cmd run preview:mobile
```

Open the same `http://<computer-local-IP>:5173` on the phone. This serves the production build without the Vite HMR client; strict port 5173 prevents fallback. Normal `npm.cmd run dev` and its configuration remain unchanged. Build again to test later edits. Do not run both servers on 5173. This is local preview, not public deployment. Plain LAN HTTP does not provide the secure context required for full service-worker/install testing on iPhone.

## Automated verification

Session validators cover damaged/unavailable storage, blank and zero values, draft/version matching, and local routes. Browser tests cover 390px/430px Chinese/English in Chrome and WebKit, saved custom tolerances, two-column controls, popup dismissal, simulated background events, page changes, real reload, selected date/tab/scroll restoration, cancel/save isolation and unchanged old goal records. A production-preview smoke test also waits 21 real seconds through simulated lifecycle events without an HMR client. These tests do not reproduce an actual iOS process kill or prove the physical incident's trigger.

Validation: TypeScript and production build pass; 167 unit tests pass. Browser suites comprise 8 focused UI/session cases, 12 tolerance/history/weekly regression cases, and 2 production-preview cases. The existing code audit still reports the previously unreachable OCR modules (`label-ocr.ts`, `LabelOcrPanel.tsx`, `nutrition-label.ts`); no missing literal translation keys. The production build retains its existing large-bundle warning.

Files for this task: `GoalCards.tsx`, `GoalTargetInfo.tsx`, `goal-tolerances-locale.ts`, `journal-shared.css`, `main.tsx`, `TodayTabs.tsx`, `useLocalToday.ts`; new `session-state.ts`, `useGoalDraft.ts`, `usePageSession.ts`, session unit/browser tests and browser configs; updated tolerance browser selector; the `preview:mobile` package script and this document. Pre-existing working changes were preserved. The active branch remains `design/graphic-editorial`; backup branches/tags were not touched.
