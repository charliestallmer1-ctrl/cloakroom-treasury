// Brief module. Composes the morning memo from the assembled modules via the model.
// Falls back to a standing template when no model key is present.

import { summarizeBrief } from "../lib/anthropic.js";

const FALLBACK = `TOP LINE
Standing template. Add ANTHROPIC_API_KEY to generate a live brief from today's data.

NOMINATIONS
See the nominations module for pipeline status and committee-versus-floor splits.

LEGISLATION & RULES
See bills for Treasury-nexus items and the CRA tab for new rules and review windows.

HEARINGS
Build the member dossier and predicted questions before any scheduled Treasury appearance.`;

export async function buildBrief({ nominations, bills, cra, hearings }) {
  const data = {
    pipeline: nominations.filter((n) => n.stage !== "Confirmed").map((n) => `${n.name} (${n.role}) — ${n.stage}, ${n.daysInStage}d`),
    bills: bills.map((b) => `${b.id} ${b.title} [${b.status}] — ${b.nexus}`),
    rules: cra.slice(0, 6).map((r) => `${r.agency}: ${r.title} (pub ${r.published})`),
    hearings: hearings.map((h) => `${h.committee}: ${h.title}, witness ${h.witness}`),
  };
  try {
    const out = await summarizeBrief(data);
    return out || FALLBACK;
  } catch {
    return FALLBACK;
  }
}
