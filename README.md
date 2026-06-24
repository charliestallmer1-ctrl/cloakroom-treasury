# Cloakroom backend

Produces one file, `data/daily.json`, every morning at 9am Eastern, on public data only.
The Cloakroom front-end reads that file to populate all six modules. Scheduling is serverless
(GitHub Actions); there is no always-on server.

## Public data only
Federal Register, Congress.gov, GovInfo, Senate/House roll calls. Nothing internal or nonpublic.
This is a personal prototype, not a Treasury system, and should not be relied on for official work
until it has cleared IT and security review.

## Setup
1. `npm install`
2. `cp .env.example .env` and add `ANTHROPIC_API_KEY` and a free `CONGRESS_API_KEY`
   (https://api.congress.gov/sign-up/).
3. `FORCE=1 npm start` — writes `data/daily.json`. (FORCE bypasses the 9am-ET guard.)
4. `npm run validate` — structural check on the output.

Without keys it still runs: the Federal Register feed and seed data populate a valid file, and the
brief uses a standing template. Add the keys to turn on live nominations, bills, and AI summaries.

## Deploy (GitHub Actions)
1. Push to a GitHub repo.
2. Settings -> Secrets and variables -> Actions: add `ANTHROPIC_API_KEY` and `CONGRESS_API_KEY`.
   Optionally add a repository variable `MODEL`.
3. The workflow in `.github/workflows/daily.yml` runs at 13:00 and 14:00 UTC, builds once at 9am ET,
   and commits `data/daily.json` back to the repo. Trigger it manually from the Actions tab to test.

## View it locally (built-in front-end)
This repo ships a simple single-page viewer (`index.html`) that reads `data/daily.json`
and renders all six modules. It must be served over HTTP (not opened as a file):
1. `npm start` (or `FORCE=1 npm start`) to produce `data/daily.json`.
2. `npm run serve`
3. Open http://localhost:8099

On GitHub Pages it works with no changes (same folder serves `index.html` + `data/daily.json`).
To point it at a file hosted elsewhere, set `DAILY_URL` near the top of the `<script>` in `index.html`.

## Point a different front-end at it
Serve `data/daily.json` from the raw GitHub URL or GitHub Pages, then follow
`frontend-patch/README-frontend.md` to switch Cloakroom from live fetches to the daily file.

## Layout
```
src/index.js          orchestrator + 9am-ET guard + per-member enrichment
src/config.js         members overlay (leans/themes), Treasury filters, seed data
src/sources/          federalRegister, congress (noms/bills/hearings),
                      legislators (committee rosters + id maps),
                      rollcall (Senate + House Treasury votes), news (Google News RSS)
src/modules/          cra, nominations, bills, hearings, prep, brief
src/lib/              http, anthropic, diff, roster (merge + forecast)
src/schema/           daily.schema.json + validate.js
index.html            built-in single-page viewer (served by server.mjs)
.github/workflows/    daily.yml
data/                 daily.json + snapshots/
```

## What each build produces
- nominations: every Treasury nomination of the 119th Congress (pending, confirmed with floor
  tally, returned, withdrawn). Pending ones carry a named minority-lean forecast.
- members: the four Treasury committees' live rosters, each member enriched with their Treasury
  roll-call votes (Senate comprehensive for the Congress; House limited to recent floor votes)
  and recent news with an AI summary of the Treasury angle.
- Plus brief, bills, hearings, prep, cra as before.

Data sources are all public: Federal Register, Congress.gov (key), congress-legislators (open),
Senate/House roll-call XML (open), Google News RSS (open). The full build makes one AI call per
member for news, so it takes a few minutes and uses Anthropic credit on each run.

See `CLAUDE.md` for the build brief to run inside Claude Code.
