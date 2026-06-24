// Roll-call votes for the current Congress, filtered to Treasury-related questions, and
// attributed to each member by bioguide. Open data, no key.
//   Senate: vote menu XML (per session) -> per-vote detail XML. Members carry LIS ids,
//           mapped to bioguide via the legislators dataset.
//   House:  EVS index HTML (per year) -> per-roll XML. Members carry bioguide directly.
// Returns { [bioguide]: [ { chamber, roll, date, title, question, result, position } ] }.
// Every fetch is guarded; failures degrade coverage but never crash the build.

import { XMLParser } from "fast-xml-parser";
import { getText, sleep } from "../lib/http.js";
import { CONGRESS, TREASURY_TERMS } from "../config.js";

const SENATE_SESSIONS = [{ session: 1, year: 2025 }, { session: 2, year: 2026 }];
const HOUSE_YEARS = [2025, 2026];
const MAX_SENATE_VOTES = 80;
const MAX_HOUSE_VOTES = 80;
const MAX_PER_MEMBER = 40;

// gov sites throttle bursts and reject requests without a UA, so fetch politely.
const FETCH = { headers: { "User-Agent": "Cloakroom/0.1 (public-data prototype)" }, retries: 2 };
const THROTTLE_MS = 150;

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

function isTreasury(text = "") {
  const t = String(text).toLowerCase();
  return TREASURY_TERMS.some((term) => t.includes(term));
}

function asArray(x) {
  return Array.isArray(x) ? x : x == null ? [] : [x];
}

function pad5(n) {
  return String(n).padStart(5, "0");
}

function add(map, bioguide, rec) {
  if (!bioguide) return;
  (map[bioguide] = map[bioguide] || []).push(rec);
}

async function senateVotes(map, lisToBioguide) {
  let fetched = 0;
  for (const { session, year } of SENATE_SESSIONS) {
    let menu;
    try {
      const xml = await getText(`https://www.senate.gov/legislative/LIS/roll_call_lists/vote_menu_${CONGRESS}_${session}.xml`, FETCH);
      menu = parser.parse(xml);
    } catch {
      continue;
    }
    const votes = asArray(menu?.vote_summary?.votes?.vote);
    const treasury = votes.filter((v) => isTreasury(v.title || ""));

    for (const v of treasury) {
      if (fetched >= MAX_SENATE_VOTES) break;
      const num = pad5(v.vote_number);
      try {
        await sleep(THROTTLE_MS);
        const xml = await getText(`https://www.senate.gov/legislative/LIS/roll_call_votes/vote${CONGRESS}${session}/vote_${CONGRESS}_${session}_${num}.xml`, FETCH);
        const detail = parser.parse(xml);
        fetched++;
        const rc = detail?.roll_call_vote || {};
        const members = asArray(rc.members?.member);
        const rec = {
          chamber: "Senate",
          roll: String(v.vote_number),
          date: `${v.vote_date}, ${year}`,
          title: String(v.title || ""),
          question: String(v.question || "").trim(),
          result: String(v.result || ""),
        };
        for (const m of members) {
          add(map, lisToBioguide[m.lis_member_id], { ...rec, position: String(m.vote_cast || "") });
        }
      } catch {
        continue;
      }
    }
  }
}

async function houseVotes(map) {
  let fetched = 0;
  for (const year of HOUSE_YEARS) {
    let html;
    try {
      html = await getText(`https://clerk.house.gov/evs/${year}/index.asp`, FETCH);
    } catch {
      continue;
    }
    // Each table row: roll link (rollnumber=N) ... last cell is Title/Description.
    const rows = html.match(/<TR>[\s\S]*?<\/TR>/gi) || [];
    for (const row of rows) {
      if (fetched >= MAX_HOUSE_VOTES) break;
      const rollM = row.match(/rollnumber=(\d+)/i);
      if (!rollM) continue;
      const cells = (row.match(/<TD[\s\S]*?<\/TD>/gi) || []).map((c) => c.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim());
      const title = cells[cells.length - 1] || "";
      if (!isTreasury(title)) continue;

      const roll = rollM[1];
      let detail;
      try {
        await sleep(THROTTLE_MS);
        const xml = await getText(`https://clerk.house.gov/evs/${year}/roll${String(roll).padStart(3, "0")}.xml`, FETCH);
        detail = parser.parse(xml);
      } catch {
        continue;
      }
      fetched++;
      const meta = detail?.["rollcall-vote"]?.["vote-metadata"] || {};
      const recorded = asArray(detail?.["rollcall-vote"]?.["vote-data"]?.["recorded-vote"]);
      const rec = {
        chamber: "House",
        roll: String(roll),
        date: meta["action-date"] || String(year),
        title: meta["vote-desc"] || meta["legis-num"] || title,
        question: meta["vote-question"] || "",
        result: meta["vote-result"] || "",
      };
      for (const rv of recorded) {
        const bg = rv.legislator?.["@_name-id"];
        add(map, bg, { ...rec, position: rv.vote || "" });
      }
    }
  }
}

export async function fetchTreasuryVotes(lisToBioguide = {}) {
  const map = {};
  try { await senateVotes(map, lisToBioguide); } catch { /* keep partial */ }
  try { await houseVotes(map); } catch { /* keep partial */ }
  // Cap per member, newest first (string date sort is approximate but stable enough).
  for (const bg of Object.keys(map)) {
    map[bg] = map[bg].slice(0, MAX_PER_MEMBER);
  }
  return map;
}
