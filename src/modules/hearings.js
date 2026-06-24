// Hearings module. Upcoming committee meetings with a Treasury witness or equities.
// Falls back to SEED_HEARINGS when Congress.gov is unavailable.

import { SEED_HEARINGS } from "../config.js";

export function buildHearings(rawFromCongress) {
  // sources/congress.fetchHearings already returns the normalized shape
  // { committee, title, witness, when, date, topics }. Prefer it; fall back to seed.
  if (Array.isArray(rawFromCongress) && rawFromCongress.length) {
    return rawFromCongress.map((h) => ({
      committee: h.committee || "",
      title: h.title || "",
      witness: h.witness || "",
      when: h.when || "",
      date: h.date || "",
      topics: Array.isArray(h.topics) ? h.topics : [],
    }));
  }
  return SEED_HEARINGS;
}
