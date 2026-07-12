// Apple's careers site (jobs.apple.com) server-renders search results
// directly into the page HTML - no separate API call to reverse-engineer,
// just parse the rendered markup. Query once for all of India and filter to
// target cities locally (Apple's location codes are opaque region IDs, not
// simple city names).
const { matchesTitle, matchesCity } = require("../filters");

const TIMEOUT_MS = 15000;
const PAGE_SIZE = 20;
const MAX_PAGES = 15;

const JOB_RE =
  /href="(\/en-in\/details\/[^"]+)"[^>]*>([^<]+)<\/a><\/h3>.*?<span id="search-store-name-container-\d+">([^<]+)<\/span>/gs;
const COUNT_RE = /(\d+)\s*Result\(s\)/;

async function fetchPage(page) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://jobs.apple.com/en-in/search?search=software%20engineer&location=india-INDC&page=${page}`,
      { headers: { "User-Agent": "Mozilla/5.0" }, signal: controller.signal }
    );
    if (!res.ok) return { jobs: [], total: 0 };
    const html = await res.text();
    const countMatch = html.match(COUNT_RE);
    const total = countMatch ? parseInt(countMatch[1], 10) : 0;
    const jobs = [];
    for (const m of html.matchAll(JOB_RE)) {
      jobs.push({ href: m[1], title: m[2].trim(), location: m[3].trim() });
    }
    return { jobs, total };
  } catch {
    return { jobs: [], total: 0 };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchApple() {
  const first = await fetchPage(1);
  const all = [...first.jobs];
  const totalPages = Math.min(MAX_PAGES, Math.ceil(first.total / PAGE_SIZE));
  for (let page = 2; page <= totalPages; page++) {
    const { jobs } = await fetchPage(page);
    all.push(...jobs);
  }

  return all
    .filter((j) => matchesTitle(j.title) && matchesCity(j.location))
    .map((j) => ({
      company: "apple",
      ats: "custom",
      title: j.title,
      location: j.location,
      url: `https://jobs.apple.com${j.href}`,
      updatedAt: undefined,
    }));
}

module.exports = { fetchApple };
