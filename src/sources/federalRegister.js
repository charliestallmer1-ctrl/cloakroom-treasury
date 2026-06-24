// Federal Register — Treasury rules. Open API, no key. COMPLETE.

import { getJSON } from "../lib/http.js";
import { FR_AGENCIES } from "../config.js";

export async function fetchTreasuryRules() {
  const base = "https://www.federalregister.gov/api/v1/documents.json";
  const params = ["per_page=30", "order=newest", "conditions[type][]=RULE"];
  FR_AGENCIES.forEach((a) => params.push("conditions[agencies][]=" + a));
  ["title", "publication_date", "html_url", "agencies", "effective_on", "abstract", "document_number"].forEach(
    (f) => params.push("fields[]=" + f)
  );
  const data = await getJSON(base + "?" + params.join("&"), { retries: 2 });
  return (data.results || []).map((r) => ({
    title: r.title,
    agency: (r.agencies && r.agencies[0] && r.agencies[0].name) || "Treasury",
    published: r.publication_date,
    effective: r.effective_on,
    url: r.html_url,
    abstract: r.abstract,
    doc: r.document_number,
  }));
}
