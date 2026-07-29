// Refreshes frontend/jobs.json by pulling live listings from every verified
// company in data/companies.json (Greenhouse/Lever/Ashby/Workable/SmartRecruiters),
// dedicated fetchers for companies with their own custom career-page backends
// (Amazon, Microsoft, Apple, Flipkart, Swiggy, Rippling, Workday), Instahyre
// (Indian tech job portal), and JSearch (Google for Jobs aggregation) which
// reaches companies with fully custom career sites that no ATS-specific scan
// can see - filtered to SDE1-equivalent roles in the target Indian cities.
//
// Output lives in frontend/ (not data/) so it can be served as a plain
// static file - the same jobs.json works whether it's served by the local
// Express server or by GitHub Pages, no API layer required.
const fs = require("fs");
const path = require("path");
const { fetchAtsBoards } = require("./sources/atsBoards");
const { fetchAmazon } = require("./sources/amazon");
const { fetchMicrosoft } = require("./sources/microsoft");
const { fetchApple } = require("./sources/apple");
const { fetchFlipkart } = require("./sources/flipkart");
const { fetchSwiggy } = require("./sources/swiggy");
const { fetchRippling } = require("./sources/rippling");
const { fetchWorkday } = require("./sources/workday");
const { fetchJSearch } = require("./sources/jsearch");
const { fetchInstahyre } = require("./sources/instahyre");

const OUT_PATH = path.join(__dirname, "..", "frontend", "jobs.json");

function dedupe(jobs) {
  // Dedupe by apply URL - the one field that's actually unique per posting.
  // Title+location can legitimately repeat (e.g. Amazon opens many identical-
  // titled reqs on the same team), so that pair must not be used as the key.
  const seen = new Set();
  return jobs.filter((j) => {
    const key = j.url || `${j.company}::${j.title}::${j.location}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

(async () => {
  console.log(
    "Fetching from verified ATS boards, Amazon, Microsoft, Apple, Flipkart, Swiggy, Rippling, Workday, Instahyre, and JSearch..."
  );
  const [atsBoards, amazon, microsoft, apple, flipkart, swiggy, rippling, workday, instahyre, jsearch] =
    await Promise.all([
      fetchAtsBoards().catch((e) => (console.error("ats boards failed", e), [])),
      fetchAmazon().catch((e) => (console.error("amazon failed", e), [])),
      fetchMicrosoft().catch((e) => (console.error("microsoft failed", e), [])),
      fetchApple().catch((e) => (console.error("apple failed", e), [])),
      fetchFlipkart().catch((e) => (console.error("flipkart failed", e), [])),
      fetchSwiggy().catch((e) => (console.error("swiggy failed", e), [])),
      fetchRippling().catch((e) => (console.error("rippling failed", e), [])),
      fetchWorkday().catch((e) => (console.error("workday failed", e), [])),
      fetchInstahyre().catch((e) => (console.error("instahyre failed", e), [])),
      fetchJSearch().catch((e) => (console.error("jsearch failed", e), [])),
    ]);

  const jobs = dedupe([
    ...atsBoards,
    ...amazon,
    ...microsoft,
    ...apple,
    ...flipkart,
    ...swiggy,
    ...rippling,
    ...workday,
    ...instahyre,
    ...jsearch,
  ]);
  jobs.sort((a, b) => a.company.localeCompare(b.company));

  fs.writeFileSync(
    OUT_PATH,
    JSON.stringify({ generatedAt: new Date().toISOString(), count: jobs.length, jobs }, null, 2)
  );

  console.log(
    `ATS boards: ${atsBoards.length}, Amazon: ${amazon.length}, Microsoft: ${microsoft.length}, Apple: ${apple.length}, Flipkart: ${flipkart.length}, Swiggy: ${swiggy.length}, Rippling: ${rippling.length}, Workday: ${workday.length}, Instahyre: ${instahyre.length}, JSearch: ${jsearch.length}`
  );
  console.log(`Total after dedupe: ${jobs.length} matching jobs in target cities.`);
  console.log(`Saved to ${OUT_PATH}`);
})();
