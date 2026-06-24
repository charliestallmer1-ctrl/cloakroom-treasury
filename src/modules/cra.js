// CRA / rules module. COMPLETE. Adds a 60-calendar-day window estimate with the
// legislative-day caveat carried in note. Confirm against the floor calendars before relying.

function addDays(iso, n) {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function buildCRA(rules) {
  const today = new Date().toISOString().slice(0, 10);
  return rules.map((r) => {
    const end = addDays(r.published, 60);
    const month = r.published ? Number(r.published.slice(5, 7)) : 0;
    return {
      title: r.title,
      agency: r.agency,
      published: r.published,
      effective: r.effective,
      url: r.url,
      abstract: r.abstract ? r.abstract.slice(0, 280) : "",
      window: {
        end,
        open: end ? end >= today : false,
        lookbackZone: month >= 8, // rough year-end carryover flag
      },
      note: "60 calendar days from publication. Statutory clock runs on legislative/session days; confirm against chamber calendars.",
    };
  });
}
