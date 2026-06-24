// Hearing prep. For each scheduled hearing on a tracked committee, precompute
// member predictions so the front-end shows them without a live call.

import { predictedQuestions } from "../lib/anthropic.js";
import { buildMembersByCommittee } from "../lib/roster.js";

const TRACKED = ["Banking", "Finance", "House Financial Services", "Ways and Means"];

// Map a hearing's committee field to one of our tracked labels.
function committeeFor(hearing) {
  const c = hearing.committee || "";
  if (TRACKED.includes(c)) return c;
  const lc = c.toLowerCase();
  if (lc.includes("financial services")) return "House Financial Services";
  if (lc.includes("ways and means")) return "Ways and Means";
  if (lc.includes("banking")) return "Banking";
  if (lc.includes("finance")) return "Finance";
  return null;
}

export async function buildPrep(hearings, membersByCommittee) {
  const members = membersByCommittee || buildMembersByCommittee(null);
  const out = [];
  for (const h of hearings) {
    const committee = committeeFor(h);
    const roster = (committee && members[committee]) || [];
    // A Treasury witness is questioned hardest by the minority (Democrats). Cap the
    // list so the prompt and output stay focused on the highest-rank members.
    const subset = (roster.filter((m) => m.party === "D").length ? roster.filter((m) => m.party === "D") : roster).slice(0, 10);

    if (!committee || !subset.length) {
      out.push({ hearing: h.title, committee: committee || "", predictions: "" });
      continue;
    }

    const topic = (h.topics && h.topics.length ? h.topics.join(", ") : h.title) || "";
    let predictions = "";
    try {
      predictions = (await predictedQuestions(committee, topic, subset)) || "";
    } catch {
      predictions = "";
    }
    out.push({ hearing: h.title, committee, predictions });
  }
  return out;
}
