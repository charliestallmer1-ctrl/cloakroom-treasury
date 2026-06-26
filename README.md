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
3. The workflow in `.github/workflows/daily.yml` fires hourly through the early morning (07:00-14:00
   UTC) and builds once per day, on the first run that hasn't built yet. Trigger it manually from the
   Actions tab to test.

### Guaranteeing the build lands before 9am ET
GitHub's free scheduler is best-effort and can be delayed by hours, so the cron above is high-odds,
not a hard guarantee. For a punctual deadline, trigger the workflow from an external cron service:
1. Create a fine-grained Personal Access Token (GitHub - Settings - Developer settings) scoped to this
   repo with `Actions: read and write`.
2. Sign up for a free punctual cron service (e.g. cron-job.org) and add a daily job at ~7:30am ET:
   - Method `POST`, URL
     `https://api.github.com/repos/<you>/<repo>/actions/workflows/daily.yml/dispatches`
   - Headers: `Authorization: Bearer <TOKEN>`, `Accept: application/vnd.github+json`
   - Body: `{"ref":"main","inputs":{"force":"true"}}`
External cron services run on time, so this forces the build well before 9am every day regardless of
GitHub's internal scheduler.

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
