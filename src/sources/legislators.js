// Committee rosters + identity maps from the public @unitedstates/congress-legislators
// dataset. Open data, no key. Two YAML files:
//   committee-membership-current.yaml  code -> [{ name, party(majority/minority), rank, title, bioguide }]
//   legislators-current.yaml           [{ id.{bioguide,lis}, name.official_full, terms[last].{state,party} }]
// We fetch both once and return rosters (joined to party/state, carrying bioguide) plus a
// lisToBioguide map so roll-call data (Senate uses LIS ids) can be matched to members.
// Returns { rosters: null, lisToBioguide: {} } on failure so callers fall back to curated data.

import { load as yamlLoad } from "js-yaml";
import { getText } from "../lib/http.js";

const BASE = "https://raw.githubusercontent.com/unitedstates/congress-legislators/main";

const CODE_TO_LABEL = {
  SSBK: "Banking",
  SSFI: "Finance",
  HSBA: "House Financial Services",
  HSWM: "Ways and Means",
};

function partyAbbr(p) {
  return p === "Democrat" ? "D" : p === "Republican" ? "R" : p === "Independent" ? "I" : (p ? p[0] : "");
}

export async function fetchLegislatorData() {
  try {
    const [cmText, legText] = await Promise.all([
      getText(`${BASE}/committee-membership-current.yaml`),
      getText(`${BASE}/legislators-current.yaml`),
    ]);
    const membership = yamlLoad(cmText) || {};
    const legislators = yamlLoad(legText) || [];

    const byBioguide = {};
    const lisToBioguide = {};
    for (const l of legislators) {
      const id = l.id || {};
      const bg = id.bioguide;
      if (!bg) continue;
      const terms = l.terms || [];
      const last = terms[terms.length - 1] || {};
      const nm = l.name || {};
      byBioguide[bg] = {
        name: nm.official_full || `${nm.first || ""} ${nm.last || ""}`.trim(),
        state: last.state || "",
        party: partyAbbr(last.party),
      };
      if (id.lis) lisToBioguide[id.lis] = bg;
    }

    const rosters = {};
    for (const [code, label] of Object.entries(CODE_TO_LABEL)) {
      const members = (membership[code] || []).map((m) => {
        const info = byBioguide[m.bioguide] || {};
        return {
          name: info.name || m.name || "",
          party: info.party || "",
          state: info.state || "",
          role: m.title || "",
          bioguide: m.bioguide || "",
        };
      }).filter((m) => m.name);
      if (members.length) rosters[label] = members;
    }

    return {
      rosters: Object.keys(rosters).length ? rosters : null,
      lisToBioguide,
    };
  } catch {
    return { rosters: null, lisToBioguide: {} };
  }
}
