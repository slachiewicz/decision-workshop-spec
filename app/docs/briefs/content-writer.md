# Brief: content writer (agents A to D)

You write the prose for one range of topics in one pack. Everything you need is in this
repository. Don't read the rest of the spec or any chat history.

| Agent | Pack | Topic numbers | Extra file |
|---|---|---|---|
| A | fabric | 2–14, 30–33, 36, 39 | complete `choices.yaml: azure_regions` |
| B | fabric | 15, 17–29, 34, 35, 37, 38 | the naming form in topic 29 |
| C | databricks | 2–14, 30–33, 36, 39 | — |
| D | databricks | 15, 17–29, 34, 35, 37, 38 | the naming form in topic 29 |

Topics 1 and 16 are already written. They are the examples to match.

## Read first

1. `src/packs/types.ts`: the `TopicProse` and `OptionProse` interfaces.
2. `packs/<pack>/keys.yaml`: your topics' ids, option values, rules (`requires`, with
   `reason_id`), value fields and modifiers. **Never edit this file.**
3. `packs/<pack>/topics/01-medallion_layers.yaml` and `16-query_mode.yaml`: the shape,
   tone and depth to match.
4. `../CATALOG.md` (repo root): the one-line summary of each option for your pack.
5. `../docs/AUDIT.md` §2 (repo root): notes on topics 9, 10, 15, 16 and 37 to 39.

## Write

One file per topic, `packs/<pack>/topics/NN-<topic_id>.yaml`. Each file needs:

- every option value listed in `keys.yaml`, no more and no fewer
- a `rule_reasons` entry for every `reason_id` used in your topic's `requires`
- `value_field_labels` for every value field, at topic level or under the option that
  declares it
- `recommendation_note` exactly when `keys.yaml` gives a recommendation
- 2 to 4 intake questions: the discovery questions a facilitator asks before deciding

## Sources and facts

- Use only vendor documentation: Microsoft Learn (MCP tools `microsoft_docs_search` and
  `microsoft_docs_fetch`), docs.databricks.com, and project docs for dbt, Airflow, Delta
  and Iceberg. The lint rejects other hosts.
- **Never** use, fetch or reproduce text from workshop.datacrafters.io or any Data Crafters
  material. The decision scope is shared; the wording must be yours.
- Every option needs `sources` with at least one URL you actually read in this session,
  written without a locale (`learn.microsoft.com/fabric/...`, not `/en-us/`).
- Set `maturity` from what the docs page says (preview, gated, beta or deprecated), and set
  `as_of: '2026-10-18'`.
- If the docs contradict `CATALOG.md` or `keys.yaml` (a rename, a removed feature, a rule
  that's wrong), write what the docs say and list the conflict in your hand-back. Don't
  change `keys.yaml`.

## Style

- Plain, specific English: short sentences, active voice, second person in intake
  questions, and no marketing words ("seamless", "powerful", "robust").
- `adr_context` is past tense and impersonal ("X was chosen because…"), written as if the
  team had just made that choice.
- Pros and cons are concrete consequences, not restated labels. Keep them within the length
  limits in `packs/_schema/topic.schema.json`.

## Gate (must pass before you hand back)

```bash
npm run check:packs -- --pack <pack> --topics <your numbers>
npm run check:links -- <pack>
```

## Hand back

- the gate output, both commands
- the list of files you wrote
- facts you couldn't confirm from the docs, with the topic and option
- conflicts with `CATALOG.md` or `keys.yaml`, with the docs URL

No prose summary of the content.
