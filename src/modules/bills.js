// Bills module. Treasury-nexus bills, each with an AI one-line "why Treasury cares".
// Falls back to the seed bills' static nexus when no model key is present.

import { SEED_BILLS } from "../config.js";
import { billNexus } from "../lib/anthropic.js";

export async function buildBills(rawFromCongress) {
  // Prefer live Congress.gov bills (already { id, title, topic, status, url });
  // fall back to the seed bills when no key / empty response.
  const live = Array.isArray(rawFromCongress) && rawFromCongress.length ? rawFromCongress : null;
  const bills = live || SEED_BILLS;

  const out = [];
  for (const b of bills) {
    let why = b.nexus || "";
    try {
      const ai = await billNexus(b);
      if (ai) why = ai;
    } catch {
      // keep whatever nexus we already have (seed static, or empty for live)
    }
    out.push({
      id: b.id,
      title: b.title,
      topic: b.topic || "",
      status: b.status || "",
      date: b.date || "",
      url: b.url || "",
      nexus: why,
    });
  }
  out.sort((a, b) => (b.date || "").localeCompare(a.date || "")); // newest action first
  return out;
}
