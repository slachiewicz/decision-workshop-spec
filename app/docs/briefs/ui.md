# Brief: UI (phase 3)

You build the single-page app on top of the existing engine. One agent builds all of it,
so the design stays consistent.

## Read first

1. `docs/CONTRACT.md`: all of it, especially §2 (session), §3 (rules), §5 (canvas model)
   and §6 (routes).
2. `src/packs/types.ts`, then the engine's public functions in `src/engine/*.ts`: `rules`,
   `adr`, `canvas`, `session`, `load`.
3. The example topics, `packs/*/topics/01-*.yaml` and `16-*.yaml`. Other topic files are
   being written in parallel and may appear later. The UI must work with any subset.

## Build

- **Entry:** `index.html`, `src/main.tsx` and `src/ui/**`. React 19, no UI framework, plain
  CSS in `src/ui/styles.css` with custom properties for light and dark themes
  (`prefers-color-scheme`, plus a toggle).
- **Pack loading:** `import.meta.glob('/packs/*/**/*.yaml', { query: '?raw', import: 'default' })`,
  loaded on demand, one dynamic chunk per pack, into `loadPack` from `src/engine/load.ts`.
  Missing topic files are allowed: pass `only` with the ids that have prose.
- **Routing:** hash routes exactly as in §6. No router library; a small `useHashRoute`
  hook is enough.
- **Storage:** an IndexedDB `StorageAdapter` (`src/ui/storage/indexeddb.ts`), falling back
  to `localStorage` and then to `MemoryStorage`. Wrap every call in try/catch.
- **Landing page:** pick a pack (Fabric or Databricks), enter a client name, and create a
  session. List saved sessions to resume or delete. Import a JSON file. Include a
  "Show proposed decisions" toggle.
- **Topic page:**
  - title, situation, and the intake questions as a collapsible "Ask first" list
  - option cards with label, description, trade-off, pros and cons, maturity badge for
    anything non-GA, and sources as links
  - the recommendation badge and note, from `effectiveRecommendation`
  - single or multi select
  - per-option rule state from `evaluate`: blocked options disabled with the reason;
    warn and pending shown, with the option still selectable
  - value fields, modifiers as switches, a note per option, and topic notes
  - "Park" and "Leave open" buttons
  - previous and next navigation in flow order, and a progress rail grouped by part
  - a needs-review banner when `needsReview` is true
- **Source mapper (ingestion topic):** a multi-select of mechanisms, plus a free-text list
  of source system names per mechanism, stored in `option_notes` as §5 describes.
- **Naming form (topic 29):** the fields from `naming_sections`, prefilled with defaults,
  stored in `naming`.
- **Canvas:** an SVG component drawing `buildCanvas()` output, following
  `docs/canvas/*.svg`. Undecided parts are dashed and grey. It's shown in a side panel on
  wide screens and a collapsible section on narrow ones.
- **Sign-off:** counts, the canvas, and three exports:
  - Markdown, from `renderAdr`, downloaded as a `.md` file
  - PDF, by rendering the Markdown to HTML in a print view and calling `window.print()`,
    with a print stylesheet
  - JSON, from `exportSession`

  Plus a lock button, gated by `canSignOff`, with the reasons listed when it's disabled.
- **Markdown to HTML:** write a tiny converter that covers only what `renderAdr` emits
  (headings, bold, lists, tables, paragraphs, links). Don't add a Markdown library.

## Quality bar

- Keyboard reachable, with visible focus, labels on every control, and WCAG 2.2 AA
  contrast in both themes.
- Works at 360 px wide with no horizontal page scroll.
- Initial JS of 250 KB gzip or less. Packs load in their own chunks.
- No network requests at runtime besides the app's own assets, and no third-party
  scripts, fonts or CDNs.

## Tests

Disk on this machine is nearly full:

- Do **not** download Playwright browsers. Install only
  `npm install -D --save-exact @playwright/test@1.63.0 @axe-core/playwright@4.13.0` with
  `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`.
- Configure `playwright.config.ts` with `use: { channel: 'chrome' }`; Google Chrome is
  installed. Use a `webServer` that runs `vite preview` after `vite build`.
- `e2e/walkthrough.spec.ts`: for each pack, create a session, visit every topic that has
  prose, choose the recommended options (or the first available), park one topic, then go
  to sign-off, export Markdown, and assert that it contains every visited topic's title and
  the executive summary.
- `e2e/a11y.spec.ts`: run axe on the landing page, a topic page and the sign-off page, and
  fail on serious or critical issues.

Add the scripts `"build"` (`tsc --noEmit && vite build`), `"preview"` and `"test:e2e"`
(`playwright test`).

## Gate

```bash
npm run typecheck && npm run check:engine && npm run build && npm run test:e2e
```

Report the gzip size of the initial JS chunk from the `vite build` output.

## Don't

- Don't edit `packs/`, `src/packs/`, `src/engine/` or `docs/CONTRACT.md`. If the engine is
  missing something the UI needs, wrap it in `src/ui/` and list it in the hand-back.
- No analytics, no external fonts, no CDN scripts.
