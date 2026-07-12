// Microsoft's careers site (apply.careers.microsoft.com) runs on a backend
// called "pcsx" with a public, unauthenticated JSON search API. Unlike most
// big tech GCCs, Microsoft actually posts some plain "Software Engineer"
// (no level suffix) roles directly - not just Senior/Principal.
const { matchesTitle, matchesCity } = require("../filters");

const TIMEOUT_MS = 15000;
const PAGE_SIZE = 10;
const CITIES = ["Bengaluru", "Hyderabad", "Delhi", "Gurugram", "Noida"];

async function fetchJSON(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchOneCity(city) {
  const results = [];
  let start = 0;
  for (let page = 0; page < 10; page++) {
    const data = await fetchJSON(
      `https://apply.careers.microsoft.com/api/pcsx/search?domain=microsoft.com&query=software%20engineer&location=${encodeURIComponent(
        city
      )}&start=${start}`
    );
    const positions = data && data.data && Array.isArray(data.data.positions) ? data.data.positions : [];
    if (positions.length === 0) break;
    results.push(...positions);
    start += PAGE_SIZE;
    if (start >= (data.data.count || 0)) break;
  }
  return results;
}

async function fetchMicrosoft() {
  const seen = new Set();
  const all = [];
  for (const city of CITIES) {
    const positions = await fetchOneCity(city);
    for (const p of positions) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      all.push(p);
    }
  }

  return all
    .filter((p) => matchesTitle(p.name) && matchesCity((p.locations || []).join(", ")))
    .map((p) => ({
      company: "microsoft",
      ats: "pcsx",
      title: p.name,
      location: (p.locations || []).join(", "),
      url: `https://apply.careers.microsoft.com${p.positionUrl}`,
      updatedAt: p.postedTs ? new Date(p.postedTs).toISOString() : undefined,
    }));
}

module.exports = { fetchMicrosoft };
