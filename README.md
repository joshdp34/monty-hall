# The Door Lab — Monty Hall

A classroom game with a GitHub Pages frontend and a Sites-hosted API backed by shared D1 storage. Sessions are stored as JSON documents; **Download JSON** exports all recorded sessions, including the 25 original historical records. The original import is in `public/sessions.json`.

## Play

Start a named session and choose nonnegative whole-number values for the starting bank, win reward, and loss penalty. Pick a door, then stay or switch after the host reveals a donkey. Continue until **End game**. The bank can become negative. Completed rounds are saved immediately; ending during an unfinished round does not count that round.

The host knows the prize location, never opens the selected door or prize door, and always offers a switch. When both other doors contain donkeys, either is opened with equal probability. Prize placement and host choices use cryptographic randomness on the server. Clients cannot see the prize before the final decision.

## Data and statistics

Each session records `name`, `pointsForWin`, `pointsForLoss`, `startingPoints`, `finalPoints`, `stayLoss`, `stayWin`, `switchLoss`, and `switchWin`, plus identifiers/status/timestamps. Loss points are stored as positive penalties. Historical starting banks are inferred using:

`startingPoints = finalPoints - (stayWin + switchWin) * pointsForWin + (stayLoss + switchLoss) * pointsForLoss`

The first historical session therefore starts at −10; this is preserved, not silently corrected. All 25 historical sessions total 464 games: stay loss 127, stay win 81, switch loss 93, switch win 163. Conditional and marginal probabilities use pooled counts, not averages of session percentages. Zero denominators display a dash.

The API returns live combined JSON at `/api/sessions`. `public/sessions.json` is the historical seed, not a writable GitHub Pages file. GitHub Pages serves static files and cannot accept shared data writes. The API supplies durable concurrent storage; downloading JSON creates a portable file of all results. It does not make a Git commit after every round.

Results are public. Session names should describe a class or experiment rather than contain personal information. Each newly created session has a random edit key remembered only in the creating browser. The key is stored hashed on the server and is never included in public exports. Any visitor can start a session; there are no accounts. Clearing browser data loses edit access to the current session, but its saved results remain in shared storage. Multiple tabs are protected by optimistic concurrency and retried saves use idempotency identifiers.

## Development

Node 22.13+ is required. Install with `npm ci`; run `npm run dev`. Use `npm run db:generate` after schema edits. Sites build: `npm run build`. Apply generated migrations locally using the Wrangler configuration emitted by the build (see starter scripts). Sites deployment applies the checked-in schema migrations to the production database.

GitHub Pages uses the same `app/Game.tsx` via `pages-entry.tsx` and `vite.pages.config.ts`. Set `NEXT_PUBLIC_API_BASE` to the public Sites origin, then run `npx vite build --config vite.pages.config.ts`. Publish `pages-dist/`. The Pages workflow includes this setting and builds from the committed source. Update it if moving the backend.

Tests: `node --test tests/game.test.mjs`. They exhaust all prize/selection combinations, check scoring and state transitions, and verify the historical import and probabilities. The local integration check additionally verifies write retries, session recovery, and shared visibility.
