// Per-member news via Google News RSS (open, no key) plus an AI summary of the Treasury
// overlap. Returns { [bioguide]: { items: [{title,url,source,date}], summary } }.
// Runs with bounded concurrency since it covers every committee member.

import { XMLParser } from "fast-xml-parser";
import { getText, sleep } from "../lib/http.js";
import { memberNewsAngle } from "../lib/anthropic.js";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
const MAX_ITEMS = 5;
const CONCURRENCY = 6;

function rssUrl(name) {
  const q = `"${name}" Treasury`;
  return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
}

function asArray(x) {
  return Array.isArray(x) ? x : x == null ? [] : [x];
}

async function fetchOne(member) {
  let items = [];
  try {
    const xml = await getText(rssUrl(member.name), { retries: 1, timeoutMs: 15000 });
    const data = parser.parse(xml);
    const raw = asArray(data?.rss?.channel?.item);
    raw.sort((a, b) => (Date.parse(b.pubDate) || 0) - (Date.parse(a.pubDate) || 0)); // newest first
    items = raw.slice(0, MAX_ITEMS).map((it) => ({
      title: String(it.title || ""),
      url: String(it.link || ""),
      source: String((it.source && it.source["#text"]) || it.source || ""),
      date: String(it.pubDate || "").slice(0, 16),
    }));
  } catch {
    items = [];
  }

  let summary = "";
  if (items.length) {
    try {
      summary = (await memberNewsAngle(member.name, member.role || "", items.map((i) => i.title))) || "";
    } catch {
      summary = "";
    }
  }
  return { bioguide: member.bioguide, items, summary };
}

export async function fetchMemberNews(members = []) {
  const out = {};
  const queue = members.filter((m) => m.bioguide);
  let i = 0;
  async function worker() {
    while (i < queue.length) {
      const m = queue[i++];
      out[m.bioguide] = await fetchOne(m);
      await sleep(50);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  return out;
}
