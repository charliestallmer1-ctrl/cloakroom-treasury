// Merge live committee rosters (sources/legislators) with the curated overlay in
// config.MEMBERS (which carries editorial lean / themes / note the dataset lacks).
// Live roster wins for who-is-on-the-committee; curated data enriches by name.

import { MEMBERS } from "../config.js";

const OVERLAY = Object.fromEntries(MEMBERS.map((m) => [m.name, m]));
const TRACKED = ["Banking", "Finance", "House Financial Services", "Ways and Means"];

// Build { committeeLabel: [member, ...] } for every tracked committee.
// Falls back to curated members for a committee when no live roster is available.
export function buildMembersByCommittee(liveRosters) {
  const out = {};
  for (const label of TRACKED) {
    const live = liveRosters && liveRosters[label];
    if (live && live.length) {
      out[label] = live.map((m) => {
        const o = OVERLAY[m.name] || {};
        return {
          name: m.name,
          party: m.party,
          state: m.state,
          role: m.role || o.role || "",
          bioguide: m.bioguide || "",
          committee: label,
          lean: o.lean || "",
          themes: o.themes || [],
          note: o.note || "",
        };
      });
    } else {
      out[label] = MEMBERS.filter((m) => m.committee === label);
    }
  }
  return out;
}

// Committee forecast: among the minority (Democratic) members, bucket by editorial
// lean. Members with no curated lean go to swing labeled "unknown" — we do not invent
// a yes/no call for a named individual without a basis. Returns named buckets; counts
// are derived from them.
export function forecastDetail(members = []) {
  const d = { yes: [], no: [], swing: [] };
  members.filter((m) => m.party === "D").forEach((m) => {
    const entry = { name: m.name, state: m.state, lean: m.lean || "unknown" };
    if (m.lean === "Likely Yes") d.yes.push(entry);
    else if (m.lean === "Likely No") d.no.push(entry);
    else d.swing.push(entry);
  });
  return d;
}

export function forecastCounts(detail) {
  return { yes: detail.yes.length, no: detail.no.length, swing: detail.swing.length };
}
