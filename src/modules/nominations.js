// Nominations module. Normalizes nominees and attaches a committee forecast
// derived from config.MEMBERS leans. Uses live Congress.gov data when present,
// else falls back to SEED_NOMINEES.

import { SEED_NOMINEES } from "../config.js";
import { buildMembersByCommittee, forecastDetail, forecastCounts } from "../lib/roster.js";

// Map a Congress.gov latestAction text to one of the schema's stage values.
function stageFrom(text = "") {
  const t = text.toLowerCase();
  if (t.includes("confirmed")) return "Confirmed";
  if (t.includes("withdraw")) return "Withdrawn";
  if (t.includes("returned to the president")) return "Returned";
  if (t.includes("reported")) return "Committee reported";
  if (t.includes("placed on") || t.includes("calendar") || t.includes("discharged")) return "Floor scheduled";
  if (t.includes("hearing")) return "Hearing held";
  return "Referred"; // received / referred / anything else
}

// Confirmed/cloture actions carry the tally, e.g. "...Yea-Nay Vote. 53 - 43."
function floorTallyFrom(text = "") {
  const m = text.match(/(\d+)\s*-\s*(\d+)/);
  return m ? `${m[1]}-${m[2]}` : "";
}

function daysSince(iso) {
  if (!iso) return 0;
  const then = Date.parse(iso + (iso.length === 10 ? "T00:00:00Z" : ""));
  if (Number.isNaN(then)) return 0;
  const ms = Date.now() - then;
  return ms > 0 ? Math.floor(ms / 86400000) : 0;
}

// "John Smith, of Virginia, to be Under Secretary ..." -> name + role.
function parseDescription(desc = "") {
  const out = { name: "", role: "" };
  if (!desc) return out;
  const ofIdx = desc.indexOf(", of ");
  out.name = (ofIdx > 0 ? desc.slice(0, ofIdx) : desc.split(",")[0]).trim();
  const m = desc.match(/to be (?:an?\s+)?([^,.;]+)/i);
  if (m) out.role = m[1].trim();
  return out;
}

// The referral committee is carried in the latest-action text
// ("...referred to the Committee on Finance.").
function committeeFromAction(text = "") {
  const t = text.toLowerCase();
  if (t.includes("committee on finance")) return "Finance";
  if (t.includes("committee on banking")) return "Banking";
  return "Banking"; // tracked-Senate default; forecast uses Banking/Finance only
}

// Map raw Congress.gov nominations (from sources/congress.fetchNominations) into the
// normalized card shape. Skips records too sparse to be useful.
function normalizeLive(raw) {
  if (!Array.isArray(raw)) return null;
  const out = [];
  for (const n of raw) {
    const parsed = parseDescription(n.description);
    const name = parsed.name || "";
    const role = parsed.role || n.organization || "";
    if (!name || !role) continue; // not enough to render a card; let seed fill in

    const stage = stageFrom(n.latestActionText);
    out.push({
      name,
      role,
      committee: committeeFromAction(n.latestActionText),
      stage,
      date: n.latestActionDate || "",
      daysInStage: daysSince(n.latestActionDate || n.receivedDate),
      floor: stage === "Confirmed" ? floorTallyFrom(n.latestActionText) : "",
      committeeVote: "",
      committeeKind: "pending",
      note: n.latestActionText ? n.latestActionText.slice(0, 160) : "",
      pn: n.pn || "",
    });
  }
  return out;
}

const PENDING = new Set(["Referred", "Hearing held", "Committee reported", "Floor scheduled"]);
// Sort order: active pipeline first, then confirmed, then inactive (returned/withdrawn).
const STAGE_RANK = { "Floor scheduled": 0, "Committee reported": 1, "Hearing held": 2, "Referred": 3, "Confirmed": 4, "Returned": 5, "Withdrawn": 6 };

export function buildNominations(rawFromCongress, membersByCommittee) {
  const members = membersByCommittee || buildMembersByCommittee(null);
  const live = rawFromCongress ? normalizeLive(rawFromCongress) : null;
  const list = live && live.length ? live : SEED_NOMINEES;
  return list
    .map((n) => {
      const committee = n.committee === "Finance" ? "Finance" : "Banking";
      // A minority-lean forecast only makes sense while a nomination is still pending.
      if (!PENDING.has(n.stage)) return n;
      const detail = forecastDetail(members[committee] || []);
      return { ...n, forecast: forecastCounts(detail), forecastMembers: detail };
    })
    // Primary: pipeline proximity (scheduled/upcoming first, not-yet-scheduled later,
    // finished last). Secondary: most recent action date first within a stage.
    .sort((a, b) => (STAGE_RANK[a.stage] ?? 9) - (STAGE_RANK[b.stage] ?? 9) || (b.date || "").localeCompare(a.date || ""));
}
