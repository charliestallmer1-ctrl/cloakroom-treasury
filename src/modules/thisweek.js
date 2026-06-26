// "Happening this week" — a chronological schedule of dated Treasury events in the next
// 7 days, assembled from data that already carries future dates: scheduled hearings,
// CRA review windows that close this week, and rules that take effect this week.

function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function inWindow(iso, start, end) {
  return Boolean(iso) && iso >= start && iso <= end;
}

export function buildThisWeek({ hearings, cra }, todayISO) {
  const end = addDays(todayISO, 7);
  const events = [];

  for (const h of hearings || []) {
    if (inWindow(h.date, todayISO, end)) {
      events.push({ date: h.date, kind: "Hearing", title: `${h.committee}: ${h.title}`, detail: h.witness || "", url: "" });
    }
  }

  for (const r of cra || []) {
    if (r.window && inWindow(r.window.end, todayISO, end)) {
      events.push({ date: r.window.end, kind: "CRA review window closes", title: r.title, detail: r.agency || "", url: r.url || "" });
    }
    if (inWindow(r.effective, todayISO, end)) {
      events.push({ date: r.effective, kind: "Rule takes effect", title: r.title, detail: r.agency || "", url: r.url || "" });
    }
  }

  events.sort((a, b) => a.date.localeCompare(b.date)); // earliest first
  return events;
}
