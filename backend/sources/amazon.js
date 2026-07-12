// Amazon exposes a public JSON search API behind amazon.jobs. Amazon's own
// title convention marks levels explicitly: "Software Development Engineer"
// (no suffix) = SDE1/L4, "... II" = SDE2, "... III" = SDE3/senior - so we can
// reliably identify SDE1-equivalent postings by title alone.
const PAGE_SIZE = 100;
const MAX_PAGES = 10;
const TIMEOUT_MS = 12000;

const EXCLUDE_RE = /\b(ii|iii|senior|sr\.?|principal|manager|lead|staff)\b/i;
const TITLE_RE = /software\s+develop(ment|er)?\s+engineer/i;

async function fetchJSON(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchAmazon() {
  const results = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = page * PAGE_SIZE;
    const url = `https://www.amazon.jobs/en/search.json?base_query=software%20development%20engineer&normalized_country_code%5B%5D=IND&result_limit=${PAGE_SIZE}&offset=${offset}`;
    const data = await fetchJSON(url);
    if (!data || !Array.isArray(data.jobs) || data.jobs.length === 0) break;

    for (const j of data.jobs) {
      const title = (j.title || "").trim();
      if (!TITLE_RE.test(title) || EXCLUDE_RE.test(title)) continue;
      results.push({
        company: "amazon",
        ats: "amazon",
        title,
        location: j.normalized_location || j.city,
        url: `https://www.amazon.jobs${j.job_path}`,
        updatedAt: j.posted_date,
      });
    }
    if (offset + PAGE_SIZE >= data.hits) break;
  }
  return results;
}

module.exports = { fetchAmazon };
