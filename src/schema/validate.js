// Minimal structural check for data/daily.json. No external deps.
// For stricter validation, swap in ajv against src/schema/daily.schema.json.

import fs from "fs";
import path from "path";

const file = path.join(process.cwd(), "data", "daily.json");
const required = ["generatedAt", "asOf", "version", "brief", "nominations", "hearings", "bills", "cra", "members", "changes"];

try {
  const d = JSON.parse(fs.readFileSync(file, "utf8"));
  const missing = required.filter((k) => !(k in d));
  if (missing.length) {
    console.error("Missing top-level keys:", missing.join(", "));
    process.exit(1);
  }
  if (!d.brief || typeof d.brief.markdown !== "string") {
    console.error("brief.markdown missing");
    process.exit(1);
  }
  console.log("daily.json OK — modules:", {
    nominations: d.nominations.length,
    bills: d.bills.length,
    cra: d.cra.length,
    hearings: d.hearings.length,
  });
} catch (e) {
  console.error("Validation failed:", e.message);
  process.exit(1);
}
