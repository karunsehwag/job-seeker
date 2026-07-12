// Unified fetcher for every company verified by megaVerify.js, regardless of
// which ATS it's on. data/companies.json is the single source of truth:
// each entry is {slug, ats, jobCount} and this module knows how to pull
// live postings from whichever platform that company uses.
const fs = require("fs");
const path = require("path");
const { matchesTitle, matchesCity } = require("../filters");

const CONCURRENCY = 15;
const TIMEOUT_MS = 10000;

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

async function fetchGreenhouse(slug) {
  const data = await fetchJSON(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`);
  if (!data || !Array.isArray(data.jobs)) return [];
  return data.jobs
    .filter((j) => matchesTitle(j.title) && matchesCity(j.location && j.location.name))
    .map((j) => ({
      company: slug, ats: "greenhouse", title: j.title,
      location: j.location && j.location.name, url: j.absolute_url, updatedAt: j.updated_at,
    }));
}

async function fetchLever(slug) {
  const data = await fetchJSON(`https://api.lever.co/v0/postings/${slug}?mode=json`);
  if (!Array.isArray(data)) return [];
  return data
    .filter((j) => matchesTitle(j.text) && matchesCity(j.categories && j.categories.location))
    .map((j) => ({
      company: slug, ats: "lever", title: j.text,
      location: j.categories && j.categories.location, url: j.hostedUrl,
      updatedAt: j.createdAt ? new Date(j.createdAt).toISOString() : undefined,
    }));
}

async function fetchAshby(slug) {
  const data = await fetchJSON(`https://api.ashbyhq.com/posting-api/job-board/${slug}`);
  if (!data || !Array.isArray(data.jobs)) return [];
  return data.jobs
    .filter((j) => matchesTitle(j.title) && matchesCity(j.location))
    .map((j) => ({
      company: slug, ats: "ashby", title: j.title,
      location: j.location, url: j.jobUrl || j.applyUrl, updatedAt: j.publishedDate,
    }));
}

async function fetchWorkable(slug) {
  const data = await fetchJSON(`https://apply.workable.com/api/v1/widget/accounts/${slug}`);
  if (!data || !Array.isArray(data.jobs)) return [];
  return data.jobs
    .filter((j) => matchesTitle(j.title) && matchesCity(j.location))
    .map((j) => ({
      company: slug, ats: "workable", title: j.title,
      location: j.location, url: j.url, updatedAt: undefined,
    }));
}

async function fetchSmartRecruiters(slug) {
  const data = await fetchJSON(`https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=100`);
  if (!data || !Array.isArray(data.content)) return [];
  return data.content
    .filter((j) => matchesTitle(j.name) && matchesCity(j.location && (j.location.city || j.location.country)))
    .map((j) => ({
      company: slug, ats: "smartrecruiters", title: j.name,
      location: j.location && [j.location.city, j.location.country].filter(Boolean).join(", "),
      url: j.ref || (j.id && `https://jobs.smartrecruiters.com/${slug}/${j.id}`),
      updatedAt: j.releasedDate,
    }));
}

const FETCHERS = {
  greenhouse: fetchGreenhouse,
  lever: fetchLever,
  ashby: fetchAshby,
  workable: fetchWorkable,
  smartrecruiters: fetchSmartRecruiters,
};

async function runPool(items, worker) {
  const results = [];
  let i = 0;
  async function next() {
    while (i < items.length) {
      const idx = i++;
      results.push(...(await worker(items[idx])));
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, next));
  return results;
}

async function fetchAtsBoards() {
  const companiesPath = path.join(__dirname, "..", "..", "data", "companies.json");
  const companies = JSON.parse(fs.readFileSync(companiesPath, "utf8"));
  return runPool(companies, (c) => {
    const fetcher = FETCHERS[c.ats];
    return fetcher ? fetcher(c.slug) : Promise.resolve([]);
  });
}

module.exports = { fetchAtsBoards };
