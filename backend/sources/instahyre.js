// Instahyre (Indian tech-focused job portal, 10,000+ companies) exposes a
// public JSON API at /api/v1/job_search. Its filter params (job_function,
// keywords, etc.) turn out to be ignored server-side for this endpoint - it
// always returns the same paginated feed regardless - so we paginate through
// it and filter client-side with the same title/city rules as every other
// source, same approach used for Coupang/Rippling/Apple.
const { matchesTitle, matchesCity } = require("../filters");

const TIMEOUT_MS = 12000;
const PAGE_SIZE = 20;
const MAX_PAGES = 50;

async function fetchPage(offset) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://www.instahyre.com/api/v1/job_search?company_size=0&isLandingPage=true&job_type=0&offset=${offset}&source=opportunities&limit=${PAGE_SIZE}`,
      { headers: { "User-Agent": "Mozilla/5.0" }, signal: controller.signal }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.objects) ? data.objects : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function fetchInstahyre() {
  const seen = new Set();
  const all = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const objects = await fetchPage(page * PAGE_SIZE);
    if (objects.length === 0) break;
    for (const o of objects) {
      if (seen.has(o.id)) continue;
      seen.add(o.id);
      all.push(o);
    }
  }

  return all
    .filter((o) => matchesTitle(o.title) && matchesCity(o.locations))
    .map((o) => ({
      company: (o.employer && o.employer.company_name) || "Unknown",
      ats: "instahyre",
      title: o.title,
      location: o.locations,
      url: o.public_url,
      updatedAt: undefined,
    }));
}

module.exports = { fetchInstahyre };
