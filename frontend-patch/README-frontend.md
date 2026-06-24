# Pointing Cloakroom at daily.json

The prototype currently fetches the Federal Register live and uses sample data for the rest.
Switch it to read the backend's `data/daily.json` so every module is driven by the 9am build.

## 1. Set the data URL
Use the raw GitHub URL of the committed file, or a GitHub Pages path:
```
const DAILY_URL = "https://raw.githubusercontent.com/<you>/cloakroom-backend/main/data/daily.json";
```

## 2. Load it once on mount
Add to the top-level `App` component, replacing the standalone Federal Register fetch:
```jsx
const [daily, setDaily] = useState(null);
const [status, setStatus] = useState("loading"); // loading | live | error

useEffect(() => {
  (async () => {
    try {
      const res = await fetch(DAILY_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const d = await res.json();
      setDaily(d);
      setStatus("live");
    } catch (e) {
      setStatus("error"); // modules fall back to their built-in sample
    }
  })();
}, []);
```

## 3. Feed each module from `daily`
- Daily Brief: render `daily.brief.markdown` directly. The in-app "Regenerate" button can stay as an
  optional live override, but the default now comes from the 9am build.
- Nominations: `daily.nominations` (already in the card shape; `forecast` is precomputed).
- Hearings: `daily.hearings`. Hearing Prep: show `daily.prep[i].predictions` and keep the live
  generate button as a manual refresh.
- Bills: `daily.bills` (each has `nexus` precomputed).
- CRA: `daily.cra` (each has `window` + `note` precomputed).
- Members: `daily.members`.
- Show `daily.changes` as a "what moved since yesterday" strip on the brief.

## 4. Timestamp
Replace the live "as of" with `daily.generatedAt` so the header reflects the 9am build.

Keep the built-in sample data as the fallback when `status === "error"`, so the tool still renders
if the file is unreachable.
