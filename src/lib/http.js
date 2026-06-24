// Small fetch wrapper with timeout and one retry. Node 20+ has global fetch.

export async function getJSON(url, { headers = {}, retries = 1, timeoutMs = 20000 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers, signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
      return await res.json();
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  throw lastErr;
}

export async function getText(url, { headers = {}, retries = 0, timeoutMs = 20000 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers, signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
      return await res.text();
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
  }
  throw lastErr;
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
