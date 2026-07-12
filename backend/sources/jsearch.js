// JSearch (RapidAPI) aggregates real-time postings from Google for Jobs,
// which itself indexes structured job-posting data from LinkedIn, Indeed,
// Glassdoor, ZipRecruiter, and individual company career sites directly.
// This is how we reach companies with fully custom career sites (Google,
// Microsoft, TCS, banks, etc.) that no ATS-specific scan can see.
const fs = require("fs");
const path = require("path");
const { matchesTitle } = require("../filters");

function loadEnv() {
  if (process.env.RAPIDAPI_KEY) return;
  const envPath = path.join(__dirname, "..", "..", ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = process.env[m[1].trim()] || m[2].trim();
  }
}

const TIMEOUT_MS = 20000;
const CITY_LABELS = {
  hyderabad: "Hyderabad, India",
  delhi: "Delhi, India",
  gurugram: "Gurugram, India",
  noida: "Noida, India",
  bengaluru: "Bengaluru, India",
};

async function fetchOneCity(cityKey, cityLabel, apiKey) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const url = `https://jsearch.p.rapidapi.com/search-v2?query=${encodeURIComponent(
      `software engineer jobs in ${cityLabel}`
    )}&num_pages=1&country=in&date_posted=all`;
    const res = await fetch(url, {
      headers: { "x-rapidapi-host": "jsearch.p.rapidapi.com", "x-rapidapi-key": apiKey },
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const data = await res.json();
    const jobs = data && data.data && Array.isArray(data.data.jobs) ? data.data.jobs : [];
    return jobs
      .filter((j) => matchesTitle(j.job_title))
      .map((j) => ({
        company: j.employer_name || "Unknown",
        ats: "jsearch",
        title: j.job_title,
        location: j.job_city ? `${j.job_city}, ${j.job_state || ""}`.trim() : cityLabel,
        url: j.job_apply_link || j.job_google_link,
        updatedAt: j.job_posted_at_datetime_utc,
      }));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJSearch() {
  loadEnv();
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    console.warn("RAPIDAPI_KEY not set - skipping JSearch source.");
    return [];
  }

  const results = [];
  // Sequential, not parallel: free-tier rate limits are tight and this is a
  // once-per-refresh call, not a hot path.
  for (const [cityKey, cityLabel] of Object.entries(CITY_LABELS)) {
    const jobs = await fetchOneCity(cityKey, cityLabel, apiKey);
    results.push(...jobs);
  }
  return results;
}

module.exports = { fetchJSearch };
