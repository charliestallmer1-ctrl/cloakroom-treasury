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
import { fetchMemberNews } from "./sources/news.js";
import { buildMembersByCommittee } from "./lib/roster.js";

import { buildCRA } from "./modules/cra.js";
import { buildNominations } from "./modules/nominations.js";
import { buildBills } from "./modules/bills.js";
import { buildHearings } from "./modules/hearings.js";
import { buildPrep } from "./modules/prep.js";
import { buildBrief } from "./modules/brief.js";

import { loadPreviousSnapshot, computeChanges, writeSnapshot } from "./lib/diff.js";

function etHour() {
  const s = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }).format(new Date());
  return Number(s);
}

async function main() {
  const date = new Date().toISOString().slice(0, 10);

  // Build once per day, on the first run at or after 9am ET that hasn't built today.
  // This tolerates GitHub's scheduled-run delays (which can push a job past the 9am
  // hour) while still doing exactly one build per day. FORCE=1 bypasses for manual runs.
  if (process.env.FORCE !== "1") {
    const hour = etHour();
    const builtToday = fs.existsSync(path.join(process.cwd(), "data", "snapshots", `${date}.json`));
    if (hour < 9) { console.log(`Skip: ET hour is ${hour}, before 9am.`); return; }
    if (builtToday) { console.log(`Skip: already built today (${date}).`); return; }
    console.log(`ET hour ${hour}, no build yet today — proceeding.`);
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
  const brief = await buildBrief({ nominations, bills, cra, hearings });

  // 3) Diff
  const prev = loadPreviousSnapshot(date);
  const todayCore = { nominations, bills, cra };
  const changes = computeChanges(todayCore, prev);

  // 4) Assemble
  const out = {
    generatedAt: new Date().toISOString(),
    asOf: date,
    version: "1",
    brief: { markdown: brief },
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
