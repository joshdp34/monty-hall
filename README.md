# The Monty Hall Problem

Live app: https://joshdp34.github.io/monty-hall/

The frontend runs on GitHub Pages. The backend is the `monty-hall-api` Cloudflare Worker in the owner's Cloudflare account, using the `monty-hall` D1 database. **Every session is stored in relational database columns**, including the 25 original sessions and all sessions played in the app. The app does not load a historical JSON file or store sessions as JSON blobs.

## Database

The schema is in `worker/migrations/0001_sessions.sql`. Each session row contains its name, win points, loss penalty, starting/current bank, stay losses/wins, switch losses/wins, status, timestamps, and private round state. Database constraints enforce nonnegative counts and the bank calculation. Updates use version checks and idempotency identifiers so concurrent tabs and network retries cannot count a round twice. The prize is generated on the server and hidden from clients until the final decision.

All original sessions have status `ended` and use the same archive display as subsequently ended sessions. The archive is sorted by name descending. Active sessions show `In progress` and contribute completed rounds only.

The original input is retained as an offline reference at `data/historical-sessions.json`; it is not deployed as a public asset or imported by the API. `worker/seed-historical.sql` is a one-time, repeat-safe database import. Historical starting banks were inferred from supplied final balances; the first session's inferred starting bank remains −10. The original 25 sessions contain 464 games (stay loss 127, stay win 81, switch loss 93, switch win 163).

**Download JSON** is an optional database export, not the storage mechanism. The API transports JSON over HTTP; the underlying records are SQL rows.

The original Sites URL remains a compatibility frontend: its API forwards to the same Cloudflare Worker. It no longer reads its old database or appends a JSON seed. The old Sites database is retained without deletion as a migration backup.

## Run and deploy

Install dependencies using `npm ci` (Node 24 recommended). Authenticate with Cloudflare using Wrangler. No Cloudflare secret is embedded in the frontend.

- `npm run dev:api`: start the Worker locally.
- `npm run db:migrate`: apply pending D1 schema migrations to the remote database.
- `npm run deploy:api`: deploy the Worker to the owner's account.
- `npm run build:pages`: build the GitHub Pages frontend. Set `NEXT_PUBLIC_API_BASE` to the Worker origin.
- Push `main` to publish GitHub Pages through the included workflow.

For an isolated local database, use Wrangler's `--local --persist-to .wrangler/cloudflare` options with `worker/wrangler.jsonc`, apply migrations, and execute `worker/seed-historical.sql`. Start the API on port 8787 and the frontend with `NEXT_PUBLIC_API_BASE=http://127.0.0.1:8787` using `vite --config vite.pages.config.ts --port 5173`.

The existing Sites build remains available with `npm run build` for updating that compatibility frontend; its `.openai/hosting.json` identifies the original deployment. Never apply the standalone Worker's migrations to the old Sites database.

## Verification

`npm test` verifies all prize/choice combinations, scoring, state transitions, and the historical dataset. `tests/integration.mjs` checks the local Worker at port 8787 for shared persistence, hidden prizes, save retries, authorization, concurrency, and ending an unfinished round. `tests/browser.cjs` verifies the frontend using the bundled local Playwright runtime and Edge; set `APP_URL` if using another local port. These integration checks create test sessions and should be run against a local database.

Results are shared publicly. A random edit key is remembered in the browser and stored hashed in the database. Clearing browser data loses edit access to the current session, while recorded results remain in D1. Play continues until End game; the bank can become negative.
