// Rippling's careers site runs its own job search on Algolia. The API key
// embedded in the page is a search-only key (Algolia's public-by-design
// client-side key model), not a secret - safe to reuse directly.
const { matchesTitle, matchesCity } = require("../filters");

const ALGOLIA_APP_ID = "6FNAX3TBEF";
const ALGOLIA_API_KEY = "416caa4690f002ff6fe4a2097623640b";
const INDEX = "careers_en-US_production";
const TIMEOUT_MS = 12000;
const PAGE_SIZE = 200;

async function fetchPage(page) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://${ALGOLIA_APP_ID.toLowerCase()}-dsn.algolia.net/1/indexes/*/queries?x-algolia-api-key=${ALGOLIA_API_KEY}&x-algolia-application-id=${ALGOLIA_APP_ID}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [{ indexName: INDEX, hitsPerPage: PAGE_SIZE, page, query: "" }],
        }),
        signal: controller.signal,
      }
    );
    if (!res.ok) return { hits: [], nbPages: 0 };
    const data = await res.json();
    const result = data.results && data.results[0];
    return { hits: (result && result.hits) || [], nbPages: (result && result.nbPages) || 0 };
  } catch {
    return { hits: [], nbPages: 0 };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchRippling() {
  const first = await fetchPage(0);
  const allHits = [...first.hits];
  for (let page = 1; page < first.nbPages; page++) {
    const { hits } = await fetchPage(page);
    allHits.push(...hits);
  }

  return allHits
    .filter((h) => matchesTitle(h.name) && matchesCity((h.locationNames || []).join(", ")))
    .map((h) => ({
      company: "rippling",
      ats: "algolia",
      title: (h.name || "").trim(),
      location: (h.locationNames || []).join(", "),
      url: h.url,
      updatedAt: undefined,
    }));
}

module.exports = { fetchRippling };
