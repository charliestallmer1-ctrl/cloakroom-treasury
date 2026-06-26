// Cloakroom daily build. Runs all collectors, normalizes the six modules,
// diffs against yesterday, writes data/daily.json and a dated snapshot.
//
// Scheduling: GitHub Actions fires at 13:00 and 14:00 UTC. This guard only does
// the full build when it is 9am in America/New_York, so one run per day works
// and the other no-ops. FORCE=1 bypasses the guard for local / manual runs.

import fs from "fs";
import path from "path";

import { fetchTreasuryRules } from "./sources/federalRegister.js";
import { fetchNominations, fetchBills, fetchHearings, hasKey } from "./sources/congress.js";
import { fetchLegislatorData } from "./sources/legislators.js";
import { fetchTreasuryVotes } from "./sources/rollcall.js";
import { fetchMemberNews, fetchNominationNews } from "./sources/news.js";
import { buildMembersByCommittee } from "./lib/roster.js";

import { buildCRA } from "./modules/cra.js";
import { buildNominations } from "./modules/nominations.js";
import { buildBills } from "./modules/bills.js";
import { buildHearings } from "./modules/hearings.js";
import { buildPrep } from "./modules/prep.js";
import { buildBrief } from "./modules/brief.js";
import { buildThisWeek } from "./modules/thisweek.js";

import { loadPreviousSnapshot, computeChanges, writeSnapshot } from "./lib/diff.js";

async function main() {
  const date = new Date().toISOString().slice(0, 10);

  // Build once per day, on the FIRST scheduled run of the day that hasn't built yet.
  // The cron fires hourly through the early morning (UTC), so the build normally lands
  // well before 9am ET even when GitHub's scheduler runs late. FORCE=1 bypasses for
  // manual runs. (Note: GitHub cron is best-effort; a punctual guarantee needs the
  // external trigger documented in the README.)
  if (process.env.FORCE !== "1") {
    const builtToday = fs.existsSync(path.join(process.cwd(), "data", "snapshots", `${date}.json`));
    if (builtToday) { console.log(`Skip: already built today (${date}).`); return; }
    console.log(`First run today (${date}) — proceeding.`);
  }
  console.log("Building daily.json for", date, "| Congress key:", hasKey() ? "present" : "absent");

  // 1) Sources
  const rules = await fetchTreasuryRules().catch((e) => { console.warn("FR failed:", e.message); return []; });
  const rawNoms = await fetchNominations().catch((e) => { console.warn("noms failed:", e.message); return null; });
  const rawBills = await fetchBills().catch((e) => { console.warn("bills failed:", e.message); return null; });
  const rawHearings = await fetchHearings().catch((e) => { console.warn("hearings failed:", e.message); return null; });
  const legis = await fetchLegislatorData().catch((e) => { console.warn("legislators failed:", e.message); return { rosters: null, lisToBioguide: {} }; });

  // 2) Modules
  const membersByCommittee = buildMembersByCommittee(legis.rosters);
  console.log("Committee rosters:", legis.rosters ? "live" : "curated fallback");

  // Per-member enrichment: Treasury votes (roll-call) and news, attached by bioguide.
  const uniqueMembers = [];
  const seenBio = new Set();
  for (const list of Object.values(membersByCommittee)) {
    for (const m of list) {
      if (m.bioguide && !seenBio.has(m.bioguide)) { seenBio.add(m.bioguide); uniqueMembers.push(m); }
    }
  }
  const votesByBio = await fetchTreasuryVotes(legis.lisToBioguide).catch((e) => { console.warn("rollcall failed:", e.message); return {}; });
  const newsByBio = await fetchMemberNews(uniqueMembers).catch((e) => { console.warn("news failed:", e.message); return {}; });
  for (const list of Object.values(membersByCommittee)) {
    for (const m of list) {
      m.votes = votesByBio[m.bioguide] || [];
      const n = newsByBio[m.bioguide];
      m.news = (n && n.items) || [];
      m.newsSummary = (n && n.summary) || "";
    }
  }
  console.log("Enriched members:", uniqueMembers.length, "| with votes:", Object.keys(votesByBio).length, "| with news:", Object.keys(newsByBio).length);
  const cra = buildCRA(rules);
  const nominations = buildNominations(rawNoms, membersByCommittee);
  const bills = await buildBills(rawBills);
  const hearings = buildHearings(rawHearings);
  const prep = await buildPrep(hearings, membersByCommittee);
  const thisWeek = buildThisWeek({ hearings, cra }, date);
  const brief = await buildBrief({ nominations, bills, cra, hearings });

  // Brief archive: keep a running, dated history of past briefs (newest first), carried
  // forward in daily.json itself so it survives each build. Capped to 30 entries.
  let briefArchive = [];
  try {
    const prevDaily = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "daily.json"), "utf8"));
    if (Array.isArray(prevDaily.briefArchive)) briefArchive = prevDaily.briefArchive.slice();
    else if (prevDaily.brief && prevDaily.brief.markdown && prevDaily.asOf) {
      briefArchive = [{ date: prevDaily.asOf, markdown: prevDaily.brief.markdown }]; // seed from pre-archive build
    }
  } catch { briefArchive = []; }
  briefArchive = briefArchive.filter((b) => b.date !== date); // replace today's if re-run
  briefArchive.unshift({ date, markdown: brief });
  briefArchive = briefArchive.slice(0, 30);

  // 3) Diff
  const prev = loadPreviousSnapshot(date);
  const todayCore = { nominations, bills, cra };
  const changes = computeChanges(todayCore, prev);

  // Per-nominee news (attached after the diff so snapshots stay lean).
  const nomNews = await fetchNominationNews(nominations).catch((e) => { console.warn("nominee news failed:", e.message); return {}; });
  for (const n of nominations) {
    const nn = nomNews[n.pn];
    n.news = (nn && nn.items) || [];
    n.newsSummary = (nn && nn.summary) || "";
  }
  console.log("Nominee news fetched:", Object.keys(nomNews).length);

  // 4) Assemble
  const out = {
    generatedAt: new Date().toISOString(),
    asOf: date,
    version: "1",
    brief: { markdown: brief },
    briefArchive,
    thisWeek,
    nominations,
    hearings,
    prep,
    bills,
    cra,
    members: Object.values(membersByCommittee).flat(),
    changes,
  };

  // 5) Write
  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, "daily.json"), JSON.stringify(out, null, 2));
  writeSnapshot(date, todayCore);
  console.log("Wrote data/daily.json:", { nominations: nominations.length, bills: bills.length, cra: cra.length, hearings: hearings.length });
}

main().catch((e) => { console.error("Build failed:", e); process.exit(1); });
