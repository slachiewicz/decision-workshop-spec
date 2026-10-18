# Brief: engine (agent E)

You build the pure TypeScript engine. There is no UI and no DOM code.

## Read first

1. `src/packs/types.ts`: every type you produce or consume.
2. `docs/CONTRACT.md` §2 to §5: session state, rule evaluation, ADR format, canvas model.
3. `src/packs/merge.ts` and the example topics (`packs/*/topics/01-*.yaml`, `16-*.yaml`).

## Write

- `src/engine/rules.ts`: `evaluate`, `needsReview`, `effectiveRecommendation`,
  `canSignOff`
- `src/engine/adr.ts`: `renderAdr(pack, session, today)`
- `src/engine/canvas.ts`: `buildCanvas(pack, session)`
- `src/engine/session.ts`: `newSession`, `setDecision`, `exportSession`, `importSession`
  (validates `kind` and `schema_version`), and a `StorageAdapter` interface with an
  in-memory implementation (the IndexedDB adapter comes in phase 3)
- `src/engine/load.ts`: build a `Pack` from raw YAML strings, so both Node tests and Vite
  can use it
- `tests/engine/*.test.ts`: unit tests for every operator and severity in §3, and
  golden-file tests: `tests/engine/fixtures/<pack>-session.json` must render
  `tests/engine/golden/<pack>-adr.md` byte for byte

Build fixture sessions from the example topics (1 and 16) plus small synthetic topics
defined inside the tests, for any rule shapes the examples don't cover (`not_in`,
`none_of`, modifiers, adaptive recommendation, a blocked chosen option).

## Constraints

- Pure functions, no I/O outside `load.ts` and the storage adapter. `today` is passed in,
  never read from the clock.
- Don't edit `packs/`, `src/packs/types.ts` or `docs/CONTRACT.md`. If the contract is
  wrong or incomplete, say so in the hand-back.

## Gate

```bash
npm run typecheck && npm run check:engine
```

## Hand back

- the gate output
- the list of files you wrote
- every place where you had to interpret the contract, with the choice you made
