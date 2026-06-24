// Server-side AI summarization. Uses ANTHROPIC_API_KEY from env.
// Keep prose tight, factual, short sentences, no em dashes, no hype.

import Anthropic from "@anthropic-ai/sdk";
import { MODEL } from "../config.js";

let client = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

async function complete(system, prompt, maxTokens = 900) {
  const c = getClient();
  if (!c) return null; // no key -> caller falls back
  const msg = await c.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: prompt }],
  });
  return (msg.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
}

export async function summarizeBrief(data) {
  const system =
    "You write the morning Hill brief for a U.S. Treasury Legislative Affairs team. Audience: senior staff. " +
    "Voice: tight, factual, no hype, short declarative sentences, no em dashes. Cover only Treasury equities " +
    "(tax, OCC, FinCEN/TFI, sanctions, CFIUS, debt, domestic/international finance, IRS, appropriations). " +
    "Output four short labeled sections: TOP LINE, NOMINATIONS, LEGISLATION & RULES, HEARINGS. 180 words max. " +
    "Public-source prototype, not an official product.";
  return complete(system, "Write today's brief from this data:\n" + JSON.stringify(data, null, 2), 900);
}

export async function billNexus(bill) {
  const system =
    "You brief a Treasury Legislative Affairs team. In two sentences explain why Treasury cares about a bill: " +
    "which office or authority it touches and the implementation or risk angle. Tight, factual, no em dashes.";
  return complete(system, `Bill: ${bill.id} ${bill.title}\nStatus: ${bill.status}\nKnown nexus: ${bill.nexus || ""}`, 300);
}

export async function memberNewsAngle(name, role, headlines) {
  const system =
    "You brief a Treasury Legislative Affairs team. In one or two sentences, summarize how the " +
    "following recent news about a member of Congress relates to Treasury equities (tax, OCC, " +
    "FinCEN/TFI, sanctions, CFIUS, debt, IRS, financial regulation). If there is no clear Treasury " +
    "overlap, say so in one short sentence. Tight, factual, no em dashes, no hype.";
  const prompt =
    `Member: ${name}${role ? ` (${role})` : ""}\nRecent headlines:\n` +
    headlines.map((h) => `- ${h}`).join("\n");
  return complete(system, prompt, 200);
}

export async function predictedQuestions(committee, topic, members) {
  const system =
    "You prepare hearing materials for a U.S. Treasury witness facing a Senate committee. For each named member, " +
    "predict two likely lines of questioning grounded in their stated themes, and one suggested response posture. " +
    "Tight, factual, no em dashes. Group by member. Public-source prep aid, not official guidance.";
  const prompt =
    `Committee: ${committee}\nWitness topic: ${topic}\nMembers:\n` +
    members.map((m) => {
      const themes = m.themes && m.themes.length ? `: ${m.themes.join(", ")}` : "";
      const note = m.note ? `. ${m.note}` : "";
      return `- ${m.name} (${m.party}-${m.state}${m.role ? ", " + m.role : ""})${themes}${note}`;
    }).join("\n");
  return complete(system, prompt, 1500);
}
