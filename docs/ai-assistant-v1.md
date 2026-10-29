# AI Assistant v1 — Stage 4 import and Today integration

## Review status and scope

The bilingual v1.3 candidate was conditionally approved by the user. The three requested refinements are now incorporated and locally tested. The original previously tested prompt was not recovered; this reviewed candidate is not claimed to be identical to it or externally AI-tested. Interchange format remains betterlumi-meal version 1.

Stages 1–3 provide the reviewed prompt, draft, source matching and compact preview. Stage 4 now enables validated atomic import into Quick Entry snapshots and the Today handoff. The approved Stage 3 layout, icons and links remain unchanged; its hint was already 10px with 12px grid separation (16px including the platform link padding). No commit, push or deployment was performed. Historical Stage 3 notes below describe the earlier preview-only boundary; the Stage 4 section records the current behavior.

## Stage 1 refinements

- Both prompts require exactly one text-summary line per actual food: food name · actual consumed amount · calories in kcal, followed by one total-calorie line. No introduction, unsolicited advice or commentary. Unknown amounts/calories must be labelled unknown rather than fabricated.
- Photos are supporting evidence, not a complete consumption list. When the user specifies only certain foods, other visible foods must not be added to JSON.
- Both JSON structures are schema illustrations. Placeholders must be replaced with actual identified data, while truly unknown nullable fields remain null. Empty-name, placeholder and invented foods are prohibited. Existing parser validation already rejected blank names; explicit regressions now cover empty and whitespace-only names in both food rows and split components.
- Field names, null handling, non-recursive splitSuggestions and original-serving fraction semantics are unchanged. Suggestions never contribute to initial nutrition totals; consumedFraction never scales the already-consumed nutrition again.

## Stage 2 architecture

### Draft state and recovery

- ai-meal-state.ts stores detached original AI rows, current editable rows, an immutable nutrition baseline, per-nutrient manual overrides and an explicit quantity/weight scaling axis. No local record is changed.
- Parsing is an explicit action. Editing raw text alone does not replace the valid preview. Failed parsing preserves the last valid, edited rows together with the failed text and error. A successful explicit reparse deliberately rebuilds the preview; the UI asks for confirmation before replacing an existing preview.
- Unknown dates and meal types remain null. groupAIMealDraft returns unresolved rows separately from complete date/type groups, without inventing context.
- Drafts use versioned JSON under aiMealDraft:v1:<id> in the existing settings table. saveAIMealDraft validates snapshots and checks revision inside the write transaction; a stale tab cannot overwrite a newer draft. Removed or malformed drafts are not silently recreated, overwritten or deleted.
- loadAIMealDraft restores detached snapshots without consulting mutable Pantry/Recipe records. The existing Backup 10 settings boundary preserves drafts losslessly. Stage 3 adds autosave/recovery through useAIMealDraft, described below.

### Unified read-only matching

- ai-meal-matching.ts composes active Pantry choices (including built-ins) and saved/built-in Recipes into one ranked result list. It reuses current everyday-food visibility, reference IDs, aliases and serving-unit functions.
- NFKC/case/whitespace-normalized exact names rank first, exact aliases next, and partial search suggestions last. A unique exact name or alias is eligible as an automatic candidate; matching never automatically changes a row's selected source or AI nutrition. Ties, including Pantry/Recipe ties, require a choice. Approximate spelling/substring matches are suggestions only; no speculative fuzzy auto-selection is implemented.
- Archived ingredients and deleted local records are excluded. Raw/cooked, skin-on/skinless and other meaningful distinctions are not stripped. Explicit variant searches continue through existing aliases. No preferences, foods or recipes are created or modified.

### Nutrition scaling and source changes

- All four nutrients scale from the immutable full-precision baseline using existing scaleNutrition. Null remains unknown and genuine zero remains zero. Calories are independent; no 4/4/9 recomputation or consumedFraction multiplication occurs.
- Quantity editing supports null while cleared, explicit zero and re-entry. Compatible known weight follows quantity changes; an explicit weight edit selects weight-based scaling. Unsupported conversions produce unresolved-portion and unknown calculated nutrients, rather than a guessed factor or stale-looking total.
- Manual nutrient overrides survive quantity/weight changes. Changing source with manual overrides requires explicit confirmation; an explicit recalculation clears overrides. Restore Original AI Estimate restores the original detached row (including original context/portion), not any historical meal.
- Pantry sources reuse personalNutrition, personal/official conversion precedence and localized unit labels. A known local unit conversion is used instead of an AI weight guess. No implicit density conversion, unknown-unit default, or automatic 100 g assumption is made. Existing custom-ingredient blank-macro normalization is reused only for explicitly selected local ingredients; AI unknown nutrition never enters that custom-ingredient normalization boundary.
- Recipe sources reuse existing per-serving nutrition snapshots and yield behavior. Recipes lack reliable final cooked weight, so grams cannot safely become recipe servings. Users must explicitly resolve servings; no raw-ingredient-weight approximation is introduced. Selected source snapshots remain stable if the local record changes later.

## Stage 3 UI and interaction

- Today has a lightweight assistant entry. /assistant and /assistant/meals use the existing hash/base-path helpers. Session validation accepts these routes; the four bottom navigation tabs are unchanged. Recipe Recognition is a noninteractive Coming Soon section, without OCR wiring.
- Prompt copying uses the current UI language, local calendar date and IANA timezone. Only successful clipboard writes reveal ChatGPT, Doubao, DeepSeek and Qwen shortcuts. They open in a new tab with noopener/noreferrer and no meal data in their URLs. No external AI API is called.
- Pasted replies stay in a local draft. A failed explicit preview keeps the raw response and last valid edited rows. Reparse confirmation prevents accidentally replacing an edited preview.
- The compact preview shows one calorie total (or a clearly labelled known subtotal), pending count, grouped/collapsible meals, editable group dates, and flat unresolved rows without an Unassigned card. Each food row displays kcal. Missing nutrition stays unknown; zero/duplicate advisories do not delete or merge foods. Collapsed summaries show at most three names plus the remaining count.
- The existing Modal and NumberInput are reused. Shared modal/keyboard code is unchanged. Food editors preserve numeric precision, clearable numeric buffers, text spaces while typing, null nutrition and explicit manual overrides. Source switching uses the Stage 2 adapters; replacing manual nutrition is explicit. Recipe servings must be provided when no reliable cooked-weight conversion exists. AI fallback and full original-row restore are both available.
- Official household unit labels are localized in the editor and preview, while stable unit keys stay in the draft. Existing personal/official conversions and preference precedence are reused.
- Splitting is collapsed initially. Suggested and user-named components can be edited, sourced from Pantry/Recipes, added or removed. Accepting components replaces the parent only when Save Changes is pressed. Original versus component calories/macros are shown, preserving unknowns. Undo restores the detached parent snapshot, including its source/manual edits. Cancel never persists an editor's pending changes.
- Split parents are kept in optional draft-only history; component paths are nonrecursive. These are additive fields in internal draft version 1, not changes to the AI interchange contract or any database table. Stage 2 drafts without split fields remain valid. Removing every component still leaves an undo action.
- Dragging starts only from left handles, with pointer capture/touch-action control, bounded internal-list auto-scroll and Escape/pointer-cancel cleanup. Drop targets include individual rows, collapsed group headers and the flat list. Moving into a group adopts date/type; moving outside clears only mealType. The Move To dialog supports explicit new context and ordering as a keyboard/touch alternative. Nutrition does not change on movement.

### Autosave and recovery boundary

- The module-level draft controller survives route unmounts. It waits for hydration, serializes writes, and uses the Stage 2 transactional revision check. Stale tabs cannot overwrite a newer IndexedDB draft.
- A per-tab localStorage write-ahead recovery copy protects edits before the asynchronous IndexedDB commit; visibility/pagehide trigger flushing. Recovery copies are local only and never included in an external link. Different tabs never share a writable recovery key. Conflicts stop saving and offer copying the draft; malformed or conflicting data is not silently discarded.
- Only committed IndexedDB draft settings are covered by Backup 10. Pending recovery journals are separate browser-local protection, not a claimed live-data backup. A storage/revision conflict requires explicit recovery/export before further editing; no force overwrite is provided.
- Modal edits are intentionally committed to the draft only by Save Changes. Refreshing mid-editor discards those unconfirmed modal changes, consistent with Cancel. The last saved preview/raw draft remains recoverable.

## Stage 3 verification (historical)

- Stage 3 targeted unit run: 93 tests passed across ai-meal-preview (11), ai-meal-state (11), ai-meal-storage (11), ai-meal-matching (8), ai-meal-parser (34), ai-meal-prompt (8), route-urls (6) and session-state (4). One existing route-specific update.test check is additionally run at final validation.
- Browser verification: 20 Stage 3 cases passed (10 mobile WebKit and 10 desktop Chrome), plus 2 long-list auto-scroll/cancellation checks (one per engine). They cover hash routes, bilingual copy/links, JSON/prose parsing and errors, navigation/refresh recovery, source switching, manual/null nutrition, component editing and undo, editable/collapsed groups, pointer drops and Move To, concurrent drafts, simulated keyboard viewport changes and official unit labels/keys. Runtime page-error assertions passed.
- Responsive checks cover 320, 375, 390 and 430 px, both languages and all four existing themes. Modal bounds, internal scrolling, footer visibility, calorie units and page-level horizontal overflow are checked. A mobile preview screenshot was visually inspected.
- Every browser case asserts that the seeded historical meal remains unchanged and no extra foodLogs are created. Unit compatibility checks cover old drafts, full precision, null/zero distinction, backup/reopen, atomic failure rollback and split-history restoration.
- TypeScript passes. Root and /BetterLumi/ production builds/PWA generation were exercised; the final build uses /BetterLumi/. Existing chunk-size and static/dynamic food-storage import warnings remain.
- npm run check:code still exits 1 solely for pre-existing unreachable label-ocr.ts, LabelOcrPanel.tsx and nutrition-label.ts. All assistant modules are reachable and new literal translations resolve in both languages. No OCR restoration, cleanup or checker bypass was performed.
- Early browser runs exposed an inherited Chrome channel in the isolated WebKit configuration, unstable implicit label lookups and a split-panel expansion loss after component editing. These were corrected locally. A precision assertion now uses numerical tolerance without rounding stored data, and the serving-unit persistence assertion waits for the asynchronous draft commit. The final targeted cases pass.
- Tests use isolated test-browser/fake IndexedDB data. Synthetic touch pointer events and simulated visualViewport changes are not native iPhone keyboard or Home Screen PWA verification. No full browser or unit regression suite was run.
- Schema 7, Backup 10, database BetterLumi, historical records, reference data, serving conversions, inventory transactions, deployment configuration and shared modal code are untouched. src/editorial-directories.css retains SHA256 8630E4C0AD3D8705C53AE0F0D961E595E4CCA60C76275F0E58A7818642B9CE85.

## Stage 3 changed files (15)

- src/main.tsx
- src/routing.ts
- src/session-state.ts
- src/ai-meal-state.ts
- src/AIAssistant.tsx (new)
- src/AIMealFoodEditor.tsx (new)
- src/AIMealPreview.tsx (new)
- src/ai-assistant.css (new)
- src/ai-meal-locale.ts (new)
- src/ai-meal-preview.ts (new)
- src/ai-meal-preview.test.ts (new)
- src/useAIMealDraft.ts (new)
- tests/ai-meal-preview.spec.ts (new)
- playwright.assistant.config.ts (new, test-only configuration)
- docs/ai-assistant-v1.md

Other Stage 1/2 modules remain as previously implemented. All AI work remains uncommitted alongside the preserved pre-existing Recipes stylesheet change.

## Stage 3 remaining checks and Stage 4 boundary (historical)

- Verify real iPhone Safari and installed PWA: app switching/reopen, native keyboard, long-list touch dragging/auto-scroll, safe-area footer, external-link return and clipboard permission behavior.
- Validate external-AI recognition quality using the reviewed bilingual prompt; no live external-AI output was evaluated here.
- Stale/corrupt draft conflicts deliberately block writes and preserve copies. Automatic conflict merging is not implemented. Recipe grams-to-servings remains unresolved without real yield information; no nutritional guess is made.
- The pre-existing unreachable OCR code-check failure needs a separate scope decision before claiming a completely clean code check. It does not justify reintroducing the removed OCR feature or bypassing the check.
- Stage 4 still requires explicit approval and implementation of atomic production import, duplicate-history confirmation, retry/idempotency protection and automatic Today navigation/highlighting. No data-model blocker was found, but none of those production behaviors are claimed to be implemented.

## Stage 3 visual refinement

- Assistant-only masthead/page heading replaces the inherited oversized title. Back remains a 44px icon target, while the title and directory entry text share one alignment. The primary meal entry is an open editorial row; recipe recognition is a smaller, muted Coming Soon row. No new navigation tab or feature was added.
- The copy-template heading, action/status row and external links form a compact stack. The inherited global header height (91px) and padding were overridden only for assistant headers; step headings are now 28px. Copied status sits beside the button. The empty entry's Preview Meals action is above bottom navigation at 390px. An untouched empty draft no longer displays the parser's empty-input message as a JSON error; real nonempty parse failures are unchanged.
- Editor labels no longer inherit the global 16px top/bottom margins on top of grid gaps. Numeric controls retain 44px touch heights and 16px input text; nutrition remains a two-column grid. All four nutrition inputs fit in the initial 390px editor viewport. Notes, section gaps and dialog chrome are tighter without changing calculations or editing semantics.
- Change Source opens a separate compact Modal view inside the editor workflow. Closing it restores pending edits; choosing a source uses the same Stage 2 adapters. It no longer expands the main form. The close control is an unframed X with a 44px touch target and a visible keyboard-only focus indicator. The split checkbox and description now align horizontally.
- The compact meal preview, per-row kcal, collapsible groups, drag handles, bottom navigation and disabled Stage 4 import action retain their approved behavior. Shared Modal/keyboard infrastructure and src/editorial-directories.css were not edited.
- This refinement changes six files: src/main.tsx, src/AIAssistant.tsx, src/AIMealFoodEditor.tsx, src/ai-assistant.css, tests/ai-meal-preview.spec.ts and this report. It does not change schemas, nutrition formulas, stored histories or source libraries.
- Verification: 22 relevant state/preview unit tests passed; 22 existing assistant browser cases plus 4 new visual/overlay cases passed in mobile WebKit and desktop Chrome. The new checks cover hierarchy/alignment, fresh-draft messaging, visible entry actions, nutrition-field visibility, close target size, overlay cancellation and inline checkbox alignment. TypeScript and the /BetterLumi/ production build/PWA generation pass; existing bundle/import warnings remain. No full regression or new code-check run was performed in this visual pass.
- Final 390px WebKit screenshots are in work/screenshots/ai-stage3-refined/: 01-assistant-directory-390.png, 02-meal-entry-copied-390.png, 03-food-editor-390.png, 04-source-chooser-390.png and 05-editor-splitting-390.png. They use realistic browser-only sample drafts, with zero foodLogs. The images were visually reviewed. These captures are ignored local artifacts, not application assets.
- Schema 7, Backup 10 and BetterLumi identity remain unchanged. The protected stylesheet retains SHA256 8630E4C0AD3D8705C53AE0F0D961E595E4CCA60C76275F0E58A7818642B9CE85. Native iPhone Safari/PWA keyboard and touch checks remain device-verification work. No Stage 4, commit, push or deployment was performed.

## Chinese reviewed candidate

The context placeholders below are filled with the actual local calendar date and IANA timezone when generating the prompt; they are not sample meal data.

你是帮助用户整理实际饮食记录的助手。可结合用户文字、语音转写、食物照片或它们的组合识别本次实际食用内容。

优先采用用户关于实际吃了什么、吃了多少的明确陈述。照片只是辅助证据，不是全部已食用食物的清单。用户仅指出吃了某些食物时，不得把照片中其他可见食物加入 JSON。照片中出现但未食用的食物不计入；同一食物出现在多张照片时只计一次。排除骨头、果皮等未食用部分。

对实际食用的可食部分作合理估算，结合相关烹调用油、酱料、饮料和酒精，不要遗漏，也不要凭空添加。只有确有必要时，最多提出一个简短澄清问题。

相对日期必须按下方提供的当地日期和 IANA 时区解释，不要用 UTC 换算改变日历日期。用户指定的餐食日期和餐别延续用于随后提及的食物，直到用户改变上下文。

未知日期或餐别保留 null，不能猜成今天或默认餐别。餐别仅允许 breakfast、lunch、dinner、snack 或 null。日期须为有效的 YYYY-MM-DD。

同组上下文写在组的 date、mealType。食物明确不同的日期或餐别写在食物字段并覆盖组值；食物字段为 null 时继承组值，组值也未知则保持 null。

amount、unit 描述实际食用数量与单位；weightG 是实际食用可食部分的克重。未知数量或克重用 null，未知单位用空字符串。不要把原份量比例误当成实际克重或份数。

仅当用户明确说明吃了原始份量的某个比例时填写 consumedFraction，取值范围为 0 到 1；否则必须为 null。nutrition 已对应实际食用量，绝不能再乘一次 consumedFraction。

nutrition 必须包含 calories（kcal）、protein（g）、carbs（g）、fat（g）。能合理估算时应给数值；确实无法估算则明确用 null，不得用 0 代替未知。数值必须有限且非负；真实的 0 可保留。

热量独立估算，不要强迫 calories 等于蛋白质、碳水、脂肪按 4/4/9 计算的结果。不要输出维生素、矿物质或其他营养字段。estimated 必须是布尔值，并如实反映是否估算。notes 可为简短说明或 null。

混合菜肴默认保留为一个食物。可选 splitSuggestions 仅是一层组成项数组，所有组成项对应已食用的部分，不得递归嵌套。各项必须有 name、amount、unit、nutrition（含四项营养）和 estimated；weightG 可省略或为 null。组成项不得再有 splitSuggestions、date、mealType 或 consumedFraction。

拆分只是可选建议，不加入食物总计；不能同时计入原菜肴和组成项。没有建议时使用空数组。

文字摘要每个食物只占一行，严格使用「食物名称 · 实际食用量 · 热量 kcal」，最后只加一行总热量。未知数量或热量明确标为未知，不编造数值。不得添加开场白、未经请求的建议或其他评论。随后输出一个完整的 JSON 代码块。不得在 JSON 中添加注释、额外字段、占位食物或示例数值。JSON 的 format 固定为 betterlumi-meal，version 固定为 1。下方 JSON 仅为 schema 结构示意，所有占位字段必须替换为实际识别到的食物数据；确实未知的可空字段仍须为 null。绝不输出空名称、占位或虚构食物记录。

当前当地日期：{{LOCAL_DATE}}
IANA 时区：{{IANA_TIMEZONE}}

JSON 结构：
```json
{
  "format": "betterlumi-meal",
  "version": 1,
  "meals": [
    {
      "date": null,
      "mealType": null,
      "items": [
        {
          "name": "",
          "date": null,
          "mealType": null,
          "amount": null,
          "unit": "",
          "weightG": null,
          "consumedFraction": null,
          "nutrition": {
            "calories": null,
            "protein": null,
            "carbs": null,
            "fat": null
          },
          "estimated": true,
          "notes": null,
          "splitSuggestions": []
        }
      ]
    }
  ]
}
```

可选拆分组成项结构：
```json
{
  "name": "",
  "amount": null,
  "unit": "",
  "weightG": null,
  "nutrition": {
    "calories": null,
    "protein": null,
    "carbs": null,
    "fat": null
  },
  "estimated": true
}
```

## English reviewed candidate

Help the user record what they actually consumed, using text, transcribed voice descriptions, food photos, or combinations of these inputs.

Prioritize explicit statements about what and how much was consumed. Photos are supporting evidence, not a list of everything consumed. When the user identifies only certain foods as eaten, do not add other visible foods to the JSON. Exclude visible food that was not eaten. Count the same food only once across multiple photos, and exclude non-edible or uneaten parts.

Estimate reasonable edible consumed portions, including relevant cooking oil, sauces, drinks, and alcohol, without inventing additional foods. Ask at most one brief clarification only when necessary.

Interpret relative dates using the supplied local date and IANA timezone below. Do not shift calendar dates through UTC conversion. Apply a stated meal date and type to subsequent foods until the user changes the context.

Keep unknown dates or meal types null; never invent today or a default type. Valid types are breakfast, lunch, dinner, snack, or null. Dates must be valid YYYY-MM-DD calendar dates.

Put shared context in the group date and mealType. Explicit item-level dates or meal types override the group; null item fields inherit the group, remaining null when the group is also unknown.

amount and unit describe the actual amount consumed; weightG is its edible consumed weight in grams. Use null for unknown amounts or weights and an empty string for an unknown unit. Do not confuse an original-serving fraction with consumed grams or servings.

Set consumedFraction only when the user explicitly states a fraction of an original serving, between 0 and 1; otherwise it must be null. nutrition already describes the consumed amount and must never be multiplied by consumedFraction again.

nutrition must contain calories (kcal), protein (g), carbs (g), and fat (g). Give numeric estimates whenever reasonable; otherwise use explicit null, never zero as a substitute for unknown. Numbers must be finite and nonnegative. A genuine zero is valid.

Estimate energy independently; do not force calories to equal a 4/4/9 macro calculation. Do not add micronutrients or other nutrient fields. estimated must be a truthful boolean. notes may be a short explanation or null.

Keep a mixed dish intact by default. Optional splitSuggestions is a non-recursive array of components of the consumed dish. Each component requires name, amount, unit, nutrition with the same four nutrients, and estimated; weightG may be omitted or null. Components must not have splitSuggestions, date, mealType, or consumedFraction.

Suggestions do not contribute to the meal total. Never count both the original dish and its components. Use an empty array when no breakdown is suggested.

Use exactly one text-summary line per food: food name · actual consumed amount · calories in kcal, followed by one total-calorie line. Explicitly label unknown amounts or calories as unknown rather than inventing values. No introduction, unsolicited advice, or extra commentary. Then output one complete JSON code block. Do not add comments, unexpected fields, placeholder foods, or example nutrition numbers. format must be betterlumi-meal and version must be 1. The JSON below is a schema illustration only. Replace all placeholders with actual identified food data; genuinely unknown nullable fields must remain null. Never output empty-name, placeholder, or invented food records.

Current local date: {{LOCAL_DATE}}
IANA timezone: {{IANA_TIMEZONE}}

JSON structure:
```json
{
  "format": "betterlumi-meal",
  "version": 1,
  "meals": [
    {
      "date": null,
      "mealType": null,
      "items": [
        {
          "name": "",
          "date": null,
          "mealType": null,
          "amount": null,
          "unit": "",
          "weightG": null,
          "consumedFraction": null,
          "nutrition": {
            "calories": null,
            "protein": null,
            "carbs": null,
            "fat": null
          },
          "estimated": true,
          "notes": null,
          "splitSuggestions": []
        }
      ]
    }
  ]
}
```

Optional split component structure:
```json
{
  "name": "",
  "amount": null,
  "unit": "",
  "weightG": null,
  "nutrition": {
    "calories": null,
    "protein": null,
    "carbs": null,
    "fat": null
  },
  "estimated": true
}
```

### Final Stage 3 visual refinement (2026-10-29)

External platform links now use a four-column, local-asset icon selector after successful copying, with localized platform names and an understated bilingual alternative-AI hint. Original destinations and safe new-tab behavior are unchanged. Asset URLs, processing and SHA-256 hashes are recorded in src/assets/ai-platforms/provenance.json. Icons identify external services only; each mark belongs to its respective owner. OpenAI usage follows its linked brand guidelines. No external image request is needed at runtime; Vite bundles the imports under the configured production base.

Split rows now show explicit edit/remove glyphs with comfortable touch targets; the replacement checkbox has a separated, readable label. The source overlay groups Cancel and the selected-source action in one compact right-aligned row. Landing-page layout and Stage 4 boundaries remain unchanged.

Validation: TypeScript passed; 22 draft/preview unit tests passed; 28 focused browser cases passed (14 mobile WebKit and 14 desktop Chrome), including both languages and all four themes. Production /BetterLumi/ build and PWA generation passed. Local screenshots: work/screenshots/ai-stage3-icons/ (320px and 390px, selector and editor overlays). Screenshot contexts wrote zero foodLogs. Native iPhone keyboard behavior remains a device verification item. Existing build warnings about bundle size and mixed food-storage imports remain unchanged. Protected editorial-directories.css SHA-256 remained 8630e4c0ad3d8705c53ae0f0d961e595e4cca60c76275f0e58a7818642b9ce85.

## Stage 4 — production import and Today integration

### Snapshot and validation boundary

- Every final effective row becomes one insert-only foodLog with source quick, quantity 1, unit entry, consumptionPercent 100 and matching nutrition/baseNutrition snapshots. The preview's edited precision, nulls, zeros and estimated flag are retained. Original consumed quantities/units/edible weight and explicitly supplied original-serving fractions remain readable in cookingNote alongside the user's notes, following the Stage 1-approved compatibility mapping. Fractions are descriptive only, including zero: they never scale nutrition a second time.
- Import requires a nonempty effective list, explicit valid local dates and meal types, positive actual quantities, a nonempty consumed unit, a positive known edible weight, and finite nonnegative known nutrition or explicit null. Unresolved source portions and empty split replacements require review. Only rows are imported; split history and unused suggestions never become additional meals. Draft structure/baseline/manual-override validation also runs at the service boundary.
- Field-specific messages appear on affected preview rows; the footer opens the first unresolved item. Invalid pasted replies remain visible and block import until corrected and previewed again. No date, meal type, nutrition, density or recipe finished weight is guessed.

### Atomicity, receipts and duplicate warnings

- Draft version 1 gains an optional importId field; old Stage 2/3 drafts receive one through normal revision-checked saving. No IndexedDB schema or Backup format change is needed.
- Import identities, record IDs and detached snapshots are prepared before a single Dexie transaction scoped to foodLogs/settings. The transaction checks the exact saved draft, checks prior receipts, detects possible same-date/type/name matches, bulkAdds all new meals, adds the string-valued receipt, and replaces only the completed draft setting with an empty draft using a new importId and the next revision.
- Only Dexie operations are awaited inside the transaction. IDs use the existing UUID generator and deterministic ai-meal:<importId>:<index> record IDs. Add never overwrites historical records. Any meal/receipt/draft-transition failure aborts the entire batch.
- Receipts at aiMealImport:v1:<importId> retain the committed IDs/date/type and canonical request. Exact canonical comparison avoids hash collisions and works on LAN HTTP without crypto.subtle. Replaying the same ID/request returns the receipt without writing or replacing a newer draft. A different request reusing the ID is rejected. Receipts are retained in settings and included in Backup 10; they are not injected into user notes.
- Possible duplicates use normalized name plus exact local date and meal type, not calories alone. They do not remove or merge anything. A compact inline warning offers Review or explicit Import anyway; checking again inside the transaction covers concurrent independent attempts. Identical names can flag legitimate repeated meals, which users may deliberately import.

### Draft recovery and Today

- The draft controller flushes pending edits before import, shares one in-flight submission, and fences editing/autosaves while saving. Failure leaves the editable draft intact. Success updates memory only after commit. The empty replacement's advancing revision and old-import receipt prevent stale revision-zero saves and stale tabs from recreating completed content.
- Startup verifies receipts before retiring matching recovery journals. Malformed receipts stop recovery rather than destroying the draft. Unrelated settings/drafts are unchanged. A receipt retry does not overwrite a newly started draft.
- Success selects the lexically latest valid local YYYY-MM-DD date at /today?date=..., switches to the Food tab, uses existing session/date persistence and shows a localized count toast. Existing Today meal groups are already expanded. New IDs are briefly highlighted; scrolling runs once and respects reduced motion. The highlight expires independently of navigation. Other imported dates remain in the existing calendar. No separate success page is added.

### Stage 4 verification

- TypeScript passed. Full unit suite: 747 tests in 77 files passed, including 15 new import-service tests. These cover edited snapshots, multiple dates, null versus zero, full precision, descriptive fractions, Pantry/Recipe snapshots, source/history preservation, splits, missing context/invalid numerics, injected failures at meal/receipt/draft writes, concurrent submissions, replay after reopen/restore, stale autosaves, malformed receipts and independent duplicate attempts.
- Focused browser coverage: 44 distinct cases passed across final runs (22 mobile WebKit and 22 desktop Chrome: 14 existing preview cases plus 8 import cases per engine). Import cases cover loading/double clicks, validation review, duplicate confirmation, editable failures/retry, stale-journal recovery, split replacement, Today toast/date/scroll/highlight, refresh/back/forward, Chinese/English, 320/390px and UTC-positive/negative timezones. Existing preview cases additionally cover 375/430px, themes, source editing and simulated keyboard viewport behavior.
- An initial new assertion read geometry before smooth scrolling completed; it now polls the visible result. Earlier dates outside the selected week are selected through the existing calendar date picker. No application navigation logic was altered to satisfy those test assumptions.
- Production /BetterLumi/ build and PWA generation passed (121 precache entries). Existing chunk-size and mixed static/dynamic food-storage import warnings remain. The temporary preview server needed the same APP_BASE environment as the build; no production configuration was changed.
- Isolated production-preview WebKit smoke: zero foodLogs before import, five local sample logs afterwards across two dates, one receipt, latest date 2026-10-29, four visible latest-date rows, no runtime page errors, normal refresh and offline PWA refresh passed. The existing update notice was dismissed through Later. No real production browser/profile was accessed.
- check:code still reports only the pre-existing unreachable label-ocr.ts, LabelOcrPanel.tsx and nutrition-label.ts. It was not bypassed and no OCR feature was restored.
- Schema remains 7, Backup remains 10, identity remains BetterLumi. db.ts, domain.ts, deployment/PWA configuration, reference nutrition, household weights and shared keyboard code are unchanged. editorial-directories.css remains byte-identical to the starting file (SHA256 8630e4c0ad3d8705c53ae0f0d961e595e4cca60c76275f0e58a7818642b9ce85); its earlier uncommitted work is outside this task.

### Exact Stage 4 changed files (15)

- src/ai-meal-import.ts (new)
- src/ai-meal-import.test.ts (new)
- src/ai-meal-state.ts
- src/ai-meal-storage.ts
- src/useAIMealDraft.ts
- src/AIAssistant.tsx
- src/AIMealPreview.tsx
- src/ai-meal-locale.ts
- src/ai-assistant.css
- src/main.tsx
- src/Meals.tsx
- tests/ai-meal-import.spec.ts (new)
- tests/ai-meal-preview.spec.ts
- playwright.assistant.config.ts (test-only file selection)
- docs/ai-assistant-v1.md

### Screenshots and remaining acceptance

Screenshots are ignored local artifacts in work/screenshots/ai-stage4/: 01-enabled-preview-390.png, 02-enabled-preview-320.png, 03-today-result-390.png, 04-today-full-page-390.png, 05-today-result-after-toast-390.png. capture-report.json records the isolated production smoke result. Test sample records are confined to disposable browser contexts/fake IndexedDB, never the live site.

Native iPhone Safari/Home Screen PWA verification is still required: clipboard and returning from an external AI, native keyboard and safe-area footer, actual touch interactions, app switching/reopen, import double taps, duplicate review and Today scroll/highlight. Automated WebKit and simulated viewport tests do not establish native keyboard correctness. Modal edits are saved to the draft only through Save Changes, as in Stage 3; receipt-based recovery protects committed previews, not unconfirmed modal buffers. Unknown recipe grams-to-servings and corrupt/stale draft conflicts still require explicit resolution/recovery, not guessing or forced merging. Receipts are retained for retry safety and therefore grow with completed imports.

Manual acceptance: (1) paste a multi-date result and edit nutrition; (2) verify missing date/type prevents import until resolved; (3) accept/undo a split and inspect final totals; (4) double-tap import and check one batch, latest Today date, toast and brief highlight; (5) inspect earlier dates and refresh/reopen offline; (6) deliberately import matching content and review/proceed; (7) confirm existing records and source recipes/ingredients remain unchanged. Use user-controlled test records/backup on the intended device. No commit, push or deployment has been performed.

## iPhone Safari/LAN compatibility pass (2026-10-29)

### Causes and focused fixes

- The template handler previously unconditionally called navigator.clipboard.writeText. Real HTTP LAN browser tests confirmed isSecureContext=false and navigator.clipboard undefined. WebKit documents this secure-context restriction: https://webkit.org/blog/10855/async-clipboard-api/ . The new assistant-only clipboard helper prefers the async API and tries a temporary, read-only selectable textarea with execCommand('copy') if absent or rejected. Temporary elements are removed in finally; focus, input/document selections, ancestor scroll offsets and page position are restored as far as the browser permits. No body-scroll or viewport lock is introduced.
- Automatic success is shown only after the async method resolves or legacy copy returns true. Complete failure opens the entire unchanged prompt in an existing shared Modal with selectable read-only text, localized instructions, Select all and explicit I've copied it acknowledgement. Selecting text or merely opening the modal never claims success. Acknowledging manual copying shows Ready to paste and the original external-platform selector; this is user confirmation, not programmatic clipboard verification. Cancellation preserves all draft content.
- Assistant language/back controls inherited generic button hover styling, which can remain active after iOS taps. Assistant-scoped appearance/background/border/shadow resets now make both controls transparent, including hover/active states, with retained 44px touch targets and visible keyboard focus. Both routes, languages and desktop/mobile dimensions are tested. Icons, platform links and header composition are unchanged.
- Today already uses viewport-fit=cover, but its mobile page padding was a fixed 12px/18px without safe-area-inset-top. There is no fixed/sticky hero/header to reposition. The fix adds env(safe-area-inset-top) exactly once on the mobile Today page; the masthead/date/hero receive no second inset, no guessed status-bar height, and desktop remains unchanged. See WebKit's guidance: https://webkit.org/blog/7929/designing-websites-for-iphone-x/ . Existing viewport metadata and PWA configuration are untouched.
- Floating navigation naturally overlays content during intermediate scrolling. Tests confirmed existing page bottom padding already lets the final meal content scroll completely above it, so no additional blank page padding or navigation resizing was needed. Mobile Today now has root scroll-padding-bottom (90px + the bottom inset) so scrollIntoView targets, including the meal heading/actions, settle above the floating bar. Navigation shape, dimensions and content structure remain unchanged.

### Verification and limits

- Final focused browser run: 61 passed, 1 expected skip, 0 failed. Both WebKit mobile and desktop Chrome cover successful async copying, denied permission, missing API, legacy success, complete failure/manual acknowledgement, exact prompt content, focus/text-selection/scroll restoration, bilingual controls at 320/390/1280px, Today header/meal clearance, and all existing Stage 3/4 preview/import cases. Existing record/draft preservation, transaction rollback and idempotency checks continue to pass.
- The actual non-secure LAN smoke ran in disposable browser contexts against the same machine's LAN interface on the temporary test port. Both engines reported secure=false, clipboard undefined, and successful legacy copying. BETTERLUMI_LAN_HOST opts into this test; no personal IP is hard-coded in source. The assistant-only test server binds to all local interfaces for this test. No deployment server/settings were changed.
- Secure-context behavior was exercised on trusted localhost; no claim is made of a native iPhone HTTPS run. Chromium protocol emulation applied top=47px/bottom=34px and confirmed mobile top padding=59px, zero-inset padding=12px and unchanged desktop padding=18px. The WebKit-native inset emulation case is skipped because this engine offers no equivalent override. Standalone display-mode emulation was probed but is unsupported in the available browser; actual Home Screen PWA testing remains manual. Protocol reference: https://chromedevtools.github.io/devtools-protocol/tot/Emulation/#method-setSafeAreaInsetsOverride .
- Related unit tests: 23 passed (8 prompt contract tests and 15 import-service tests). TypeScript and /BetterLumi/ production build/PWA generation passed (121 precache entries). Existing bundle-size and mixed food-storage import warnings remain.
- check:code still exits 1 only for the pre-existing unreachable label-ocr.ts, LabelOcrPanel.tsx and nutrition-label.ts. No OCR restoration or bypass occurred.
- New scrolling tests were adjusted to wait for existing route restoration and request instantaneous observation rather than sampling a smooth scroll mid-animation. Desktop retains its existing layout; new scroll-target clearance is mobile-only.
- Local ignored screenshots: work/screenshots/ios-compat/manual-copy-390-zh.png, manual-copy-320-zh.png, assistant-header-320-zh.png and today-simulated-insets-390.png. The Today inset image is explicitly Chromium emulation, not a native-iPhone capture. Capture contexts created zero meal records.
- Native-device acceptance: open the LAN URL on iPhone Safari, paste the copied template into another app, exercise the manual fallback if OS permissions deny both paths, switch languages/back routes, inspect Today at scroll-top with expanded/collapsed browser chrome, verify the last meal and Add Meal remain reachable, and repeat safe-area/keyboard checks in the installed PWA over its existing secure origin. Automated execCommand success cannot establish native OS clipboard/paste behavior on the user's phone. Manual copying remains available if the deprecated legacy API is unsupported or the async rejection loses the user gesture.

### Exact files changed in this pass (8)

- src/ai-meal-clipboard.ts (new)
- src/AIAssistant.tsx
- src/ai-meal-locale.ts
- src/ai-assistant.css
- src/graphic-today.css
- tests/ai-mobile-compat.spec.ts (new)
- playwright.assistant.config.ts (test-only matching and LAN server binding)
- docs/ai-assistant-v1.md

Prompt text, parser, matching, import/state/storage services, db.ts, domain.ts, official icon assets, deployment configuration and editorial-directories.css are byte-identical to this pass's starting versions. Schema 7, Backup 10 and identity BetterLumi remain unchanged. All existing uncommitted work is preserved; no commit, push or deployment was performed.
