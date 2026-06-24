# Cloakroom Backend — build brief

You are finishing a backend that produces one file, `data/daily.json`, every morning at
9am Eastern. The existing Cloakroom front-end (a React single-page app) reads that file to
populate all six modules. Most of the scaffold is written. Your job is to complete the
collectors, wire the AI summarization, harden the diff, and make the GitHub Actions schedule
reliable. Work in the build order below and keep the `daily.json` schema stable.

## Hard rules
- Public data only. Federal Register, Congress.gov, GovInfo, Senate/House roll-call XML. Never
  anything internal or nonpublic. This is a personal prototype, not a Treasury system.
- No secrets in the repo. `ANTHROPIC_API_KEY` and `CONGRESS_API_KEY` come from env / GitHub Secrets.
- Output is a static `data/daily.json` committed back to the repo by the workflow. No always-on server.
- The front-end contract is `src/schema/daily.schema.json`. Do not break it. If you extend it,
  add fields, never rename or remove.
- Keep prose output in the brief style: tight, factual, short sentences, no em dashes, no hype.

## Architecture (already scaffolded)
```
GitHub Actions (cron, twice daily UTC)
   -> node src/index.js
        -> ET-hour guard (only the 9am ET run does the full build)
        -> sources/*  fetch raw public data
        -> modules/*  normalize into the six module shapes
        -> lib/diff   compare to yesterday's snapshot
        -> lib/anthropic  compose brief + per-bill nexus + predicted questions
        -> write data/daily.json  and  data/snapshots/<date>.json
   -> commit data/ back to the repo
Front-end fetches data/daily.json (raw GitHub URL or Pages) and renders.
```

## Data-source map (exact)
- Federal Register (open, no key) — CRA / rules. `sources/federalRegister.js` is COMPLETE.
  `GET https://www.federalregister.gov/api/v1/documents.json`
  conditions[type][]=RULE, conditions[agencies][]= irs / occ / fincen / fiscal-service / ofac / treasury.
- Congress.gov (needs `CONGRESS_API_KEY`, free at api.congress.gov) — nominations, bills, hearings.
  - Nominations: `GET /v3/nomination/{congress}?limit=&api_key=` then per-PN detail for committee + actions.
    Filter to Treasury (`organization`/`positionTitle` contains Treasury, OCC, Mint, Comptroller) and
    to the Banking and Finance committees.
  - Bills: `GET /v3/bill/{congress}?...` plus subject/policyArea filtering; keep Treasury-nexus only.
  - Committee meetings (hearings): `GET /v3/committee-meeting/{congress}/{chamber}?...` filtered to
    Banking / Finance / House Financial Services / Ways and Means.
  - `sources/congress.js` has the client and the three calls stubbed with TODOs.
- Roll-call XML (open) — Senate `https://www.senate.gov/legislative/LIS/roll_call_votes/...`,
  House clerk XML. `sources/rollcall.js` is a stub for the roadmap; wire vote tallies onto confirmed noms.

## Modules and what each must put in daily.json
1. brief — `modules/brief.js`. Compose the morning memo from the assembled data via `lib/anthropic`.
   Output markdown with four sections: TOP LINE, NOMINATIONS, LEGISLATION & RULES, HEARINGS.
2. nominations — `modules/nominations.js`. Normalize each nominee: name, role, committee, stage,
   daysInStage, floor tally, committee tally + kind, forecast {yes,no,swing} from `config.MEMBERS`
   leans, short note, PN number.
3. hearings — `modules/hearings.js`. Upcoming meetings with a Treasury witness or Treasury equities.
4. prep — `modules/prep.js`. For each scheduled hearing, precompute member predictions via
   `lib/anthropic.predictedQuestions` so the front-end shows them without a live call.
5. bills — `modules/bills.js`. Treasury-nexus bills, each with an AI one-line "why Treasury cares"
   from `lib/anthropic.billNexus`.
6. cra — `modules/cra.js`. COMPLETE. Federal Register rules + 60-calendar-day window estimate with
   the legislative-day caveat carried in the note field.

## Build order
1. `npm install`, copy `.env.example` to `.env`, add both keys. Run `FORCE=1 npm start`.
   Confirm `data/daily.json` is written with cra + brief populated (these work today).
2. Finish `sources/congress.js` (nominations first — that is the highest-value module).
3. Wire `modules/nominations.js` normalization + forecast. Validate against the schema.
4. Finish `modules/bills.js` and `modules/hearings.js`, then `modules/prep.js`.
5. Harden `lib/diff.js` so `changes` lists what moved since yesterday.
6. Confirm `.github/workflows/daily.yml` commits `data/` and the ET-hour guard works.
7. Apply `frontend-patch/README-frontend.md` to point Cloakroom at `daily.json`.

## Scheduling note (read this)
GitHub Actions cron is UTC and ignores DST. The workflow runs at 13:00 and 14:00 UTC. `src/index.js`
guards on the actual America/New_York hour and only does the full build when it is 9am ET, so exactly
one run per day does the work and the other is a no-op. `FORCE=1` bypasses the guard for local runs.

## Definition of done
- `FORCE=1 npm start` writes a schema-valid `data/daily.json` with all six modules populated.
- The Action runs on schedule, builds once per day, and commits `data/daily.json`.
- Cloakroom loads `daily.json` and every module shows live or freshly-summarized content.
- No keys in the repo. README documents setup. About-tab guardrails unchanged.
