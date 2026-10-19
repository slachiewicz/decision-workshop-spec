# Decision workshop

A static single-page app that walks a client and an architect through the platform decisions of a data-platform engagement, topic by topic, and exports the outcome as architecture decision records (Markdown, PDF, JSON). It ships two content packs, Microsoft Fabric and Databricks. State lives in the browser; there is no backend.

- [SPEC.md](SPEC.md): what the workshop covers and how a session flows
- [CATALOG.md](CATALOG.md): the topic catalog
- [docs/AUDIT.md](docs/AUDIT.md): audit of the content and its sources
- [app/docs/CONTRACT.md](app/docs/CONTRACT.md): the contract between engine, packs and UI

## Run

```bash
cd app && npm ci && npm run dev
```

## Checks

```bash
cd app
npm run check       # typecheck, pack lint, engine tests
npm run test:e2e    # Playwright against a production build
```

The e2e tests use the installed Google Chrome locally and the bundled Chromium when `CI` is set.

## Deploy

Live: <https://decision-workshop.slachiewicz.workers.dev> (Cloudflare Workers static assets).

The build output is `app/dist/`, served with hash routing, so any static host works.

- Cloudflare: `cd app && npm run build && npx wrangler deploy`
- Vercel: import the repository with the root directory set to `app`

Both configurations send the same Content-Security-Policy and security headers.

## Licences

Code is MIT ([LICENSE](LICENSE)). Pack content is CC BY 4.0 ([app/packs/LICENSE](app/packs/LICENSE)).
