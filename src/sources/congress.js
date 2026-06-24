// Congress.gov — nominations, bills, committee meetings. Needs CONGRESS_API_KEY.
// Returns null when no key, so callers fall back to seed data.
//
// Notes from the live API (verified against api.congress.gov, June 2026):
//  - The useful nomination fields (organization, latestAction, description) are on the
//    LIST item. The per-PN detail endpoint does not return committees/nominees inline
//    (those are sparse sub-resources), so we filter on the list and skip detail calls.
//  - Bill policyArea/subjects are NOT on the bill list or detail; they live in the
//    /subjects sub-resource, so bill nexus filtering fetches that per candidate.
//  - Treasury nominations are sparse (roughly 1 per 250), so we pull a wide page.
// Every network call is individually guarded: a bad response degrades that item, it
// never crashes the build, and an empty live list lets the modules fall back to seed.

import { getJSON } from "../lib/http.js";
import { CONGRESS, TREASURY_TERMS, COMMITTEES } from "../config.js";

const KEY = process.env.CONGRESS_API_KEY || "";
const BASE = "https://api.congress.gov/v3";

// Caps keep a run well inside the API's hourly quota.
const NOMINATION_PAGE = 250;
const NOMINATION_MAX_OFFSET = 2000; // paginate the full Congress (~8 list calls)
const MAX_BILL_DETAILS = 100;
const MAX_MEETING_DETAILS = 30;

// Bill policy areas that map to a Treasury equity.
const TREASURY_POLICY_AREAS = new Set([
  "Taxation",
  "Finance and Financial Sector",
  "Foreign Trade and International Finance",
  "Economics and Public Finance",
]);

// Nomination organizations that are Treasury (department + the bureaus listed separately).
const TREASURY_ORG = /treasury|comptroller of the currency|internal revenue/i;

function url(path, extra = "") {
  return `${BASE}${path}?format=json&api_key=${encodeURIComponent(KEY)}${extra}`;
}

// api.congress.gov sub-resource links already carry ?format=json; just append the key.
function withKey(apiUrl) {
  if (!apiUrl) return null;
  const sep = apiUrl.includes("?") ? "&" : "?";
  return `${apiUrl}${sep}api_key=${encodeURIComponent(KEY)}`;
}

function isTreasury(text = "") {
  const t = String(text).toLowerCase();
  return TREASURY_TERMS.some((term) => t.includes(term));
}

// Map a committee name or systemCode to our short label, or null if not tracked.
function committeeLabel(nameOrCode = "") {
  const s = String(nameOrCode).toLowerCase();
  for (const key of Object.keys(COMMITTEES)) {
    if (s === COMMITTEES[key].code) return labelFromKey(key);
  }
  if (s.includes("banking")) return "Banking";
  if (s.includes("financial services")) return "House Financial Services";
  if (s.includes("ways and means")) return "Ways and Means";
  if (s.includes("finance")) return "Finance";
  return null;
}

function labelFromKey(key) {
  return { banking: "Banking", finance: "Finance", hfsc: "House Financial Services", waysmeans: "Ways and Means" }[key] || null;
}

export function hasKey() {
  return Boolean(KEY);
}

// 1) Treasury nominations across the whole Congress (pending, confirmed, returned,
// withdrawn). Paginates the list, filters on the authoritative organization field, and
// dedupes by citation keeping the latest action. modules/nominations.js parses name,
// role, stage, and any floor tally from these records.
export async function fetchNominations() {
  if (!KEY) return null;

  const raw = [];
  for (let offset = 0; offset <= NOMINATION_MAX_OFFSET; offset += NOMINATION_PAGE) {
    let batch = [];
    try {
      const data = await getJSON(url(`/nomination/${CONGRESS}`, `&limit=${NOMINATION_PAGE}&offset=${offset}`), { retries: 2 });
      batch = (data && data.nominations) || [];
    } catch {
      break;
    }
    if (!batch.length) break;
    raw.push(...batch);
    if (batch.length < NOMINATION_PAGE) break; // last page
  }

  // Organization is the authoritative signal; the description is too noisy (a bare
  // "tax"/"finance" substring pulls in State and VA nominees), so we do not match on it.
  const treasury = raw.filter((item) => TREASURY_ORG.test(item.organization || ""));

  // Dedupe by citation (each PN part is a distinct nominee); keep the latest action.
  const byCitation = new Map();
  for (const item of treasury) {
    const cite = item.citation || (item.number != null ? `PN${item.number}` : "");
    const action = item.latestAction || {};
    const prev = byCitation.get(cite);
    if (!prev || (action.actionDate || "") > (prev.latestActionDate || "")) {
      byCitation.set(cite, {
        pn: cite,
        number: item.number,
        description: item.description || "",
        organization: item.organization || "",
        latestActionText: action.text || "",
        latestActionDate: action.actionDate || "",
        receivedDate: item.receivedDate || "",
      });
    }
  }
  return [...byCitation.values()];
}

// 2) Treasury-nexus bills. Filters by policyArea (via the /subjects sub-resource) or a
// Treasury title term, skipping procedural floor-rule resolutions.
export async function fetchBills() {
  if (!KEY) return null;

  const data = await getJSON(url(`/bill/${CONGRESS}`, "&limit=100&sort=updateDate+desc"), { retries: 2 });
  const list = (data && data.bills) || [];

  const out = [];
  for (const b of list.slice(0, MAX_BILL_DETAILS)) {
    const title = b.title || "";
    // Floor-rule resolutions ("Providing for consideration of ...") are procedural noise.
    if (/^providing for consideration/i.test(title)) continue;

    let policyArea = "";
    try {
      const s = await getJSON(url(`/bill/${CONGRESS}/${String(b.type).toLowerCase()}/${b.number}/subjects`), { retries: 1 });
      policyArea = (s && s.subjects && s.subjects.policyArea && s.subjects.policyArea.name) || "";
    } catch {
      policyArea = "";
    }

    if (!TREASURY_POLICY_AREAS.has(policyArea) && !isTreasury(title)) continue;

    out.push({
      id: formatBillId(b.type, b.number),
      title,
      topic: policyArea,
      status: (b.latestAction && b.latestAction.text) || "",
      url: publicBillUrl(b.type, b.number),
    });
  }

  return out;
}

// 3) Upcoming committee meetings on a tracked committee with a Treasury equity.
export async function fetchHearings() {
  if (!KEY) return null;

  const today = new Date().toISOString().slice(0, 10);
  const chambers = ["senate", "house"];
  const out = [];

  for (const chamber of chambers) {
    let list = [];
    try {
      const data = await getJSON(url(`/committee-meeting/${CONGRESS}/${chamber}`, "&limit=30"), { retries: 1 });
      list = (data && data.committeeMeetings) || [];
    } catch {
      list = [];
    }

    for (const m of list.slice(0, MAX_MEETING_DETAILS)) {
      const detailUrl = withKey(m.url);
      if (!detailUrl) continue;
      let mm = null;
      try {
        const d = await getJSON(detailUrl, { retries: 1 });
        mm = (d && d.committeeMeeting) || null;
      } catch {
        mm = null;
      }
      if (!mm) continue;

      const committeeNames = (mm.committees || []).map((c) => c.name || c.systemCode || "");
      const label = committeeNames.map(committeeLabel).find(Boolean);
      if (!label) continue; // not a tracked committee

      const date = (mm.date || "").slice(0, 10);
      if (date && date < today) continue; // upcoming only

      const witness = ((mm.witnesses || [])
        .map((w) => [w.name, w.position, w.organization].filter(Boolean).join(", "))
        .filter(Boolean)[0]) || "";

      const title = mm.title || "Committee meeting";
      // Treasury equity gate: a Treasury term in the title, or a Treasury witness.
      if (!isTreasury(title) && !isTreasury(witness)) continue;

      out.push({
        committee: label,
        title,
        witness,
        when: date || "Upcoming",
        date,
        topics: [title],
      });
    }
  }

  return out;
}

function formatBillId(type = "", number = "") {
  const map = {
    HR: "H.R.", S: "S.", HRES: "H.Res.", SRES: "S.Res.",
    HJRES: "H.J.Res.", SJRES: "S.J.Res.", HCONRES: "H.Con.Res.", SCONRES: "S.Con.Res.",
  };
  const t = map[String(type).toUpperCase()] || String(type).toUpperCase();
  return `${t} ${number}`.trim();
}

function publicBillUrl(type = "", number = "") {
  const slug = {
    HR: "house-bill", S: "senate-bill", HRES: "house-resolution", SRES: "senate-resolution",
    HJRES: "house-joint-resolution", SJRES: "senate-joint-resolution",
    HCONRES: "house-concurrent-resolution", SCONRES: "senate-concurrent-resolution",
  }[String(type).toUpperCase()];
  if (!slug || !number) return "";
  return `https://www.congress.gov/bill/${CONGRESS}th-congress/${slug}/${number}`;
}
