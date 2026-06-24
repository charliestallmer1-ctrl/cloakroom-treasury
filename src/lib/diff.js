// Compare today's modules to yesterday's snapshot and surface what moved.
// All change lists are additive in the schema (changes has no fixed property set),
// so newNominations / billsChanged extend the contract without breaking it.

import fs from "fs";
import path from "path";

const SNAP_DIR = path.join(process.cwd(), "data", "snapshots");

// The snapshot for "yesterday" must predate today, so when the build runs more than
// once a day we don't diff a file against itself. Pass today's date to exclude it.
export function loadPreviousSnapshot(excludeDate) {
  try {
    let files = fs.readdirSync(SNAP_DIR).filter((f) => f.endsWith(".json")).sort();
    if (excludeDate) files = files.filter((f) => f !== `${excludeDate}.json`);
    if (!files.length) return null;
    return JSON.parse(fs.readFileSync(path.join(SNAP_DIR, files[files.length - 1]), "utf8"));
  } catch {
    return null;
  }
}

export function computeChanges(today, prev) {
  if (!prev) {
    return { nominationsMoved: [], newNominations: [], newRules: [], newBills: [], billsChanged: [], firstRun: true };
  }

  // Nominations: stage moves and brand-new nominees, keyed by name.
  const prevStage = Object.fromEntries((prev.nominations || []).map((n) => [n.name, n.stage]));
  const nominationsMoved = (today.nominations || [])
    .filter((n) => prevStage[n.name] && prevStage[n.name] !== n.stage)
    .map((n) => ({ name: n.name, from: prevStage[n.name], to: n.stage }));
  const newNominations = (today.nominations || [])
    .filter((n) => !(n.name in prevStage))
    .map((n) => ({ name: n.name, role: n.role, stage: n.stage }));

  // Rules: new Federal Register documents since the last snapshot.
  const prevRuleDocs = new Set((prev.cra || []).map((r) => r.url || r.title));
  const newRules = (today.cra || [])
    .filter((r) => !prevRuleDocs.has(r.url || r.title))
    .map((r) => ({ title: r.title, agency: r.agency }));

  // Bills: new bills, and status changes on bills we already tracked.
  const prevBillKeys = new Set((prev.bills || []).map((b) => b.id + b.title));
  const prevBillStatus = Object.fromEntries((prev.bills || []).map((b) => [b.id, b.status || ""]));
  const newBills = (today.bills || [])
    .filter((b) => !prevBillKeys.has(b.id + b.title))
    .map((b) => ({ id: b.id, title: b.title }));
  const billsChanged = (today.bills || [])
    .filter((b) => b.id in prevBillStatus && prevBillStatus[b.id] !== (b.status || ""))
    .map((b) => ({ id: b.id, from: prevBillStatus[b.id], to: b.status || "" }));

  return { nominationsMoved, newNominations, newRules, newBills, billsChanged, firstRun: false };
}

export function writeSnapshot(date, payload) {
  fs.mkdirSync(SNAP_DIR, { recursive: true });
  fs.writeFileSync(path.join(SNAP_DIR, `${date}.json`), JSON.stringify(payload));
}
