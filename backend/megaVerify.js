// Probes slug variants of ~380 real company names against 4 public,
// unauthenticated ATS JSON APIs (Greenhouse, Lever, Ashby, Workable) and
// keeps every company+ATS combo that resolves to a live job board with
// listings. This is how we go from "~90 companies scanned" to a much wider
// scanning universe - each verified hit becomes a real live source, not a
// guessed link.
const fs = require("fs");
const path = require("path");
const names = require("./megaCompanyNames");

const CONCURRENCY = 40;
const TIMEOUT_MS = 7000;

function slugVariants(name) {
  const cleaned = name
    .replace(/\b(Inc|Technologies|Labs|Systems|Software|Solutions|Group|Global|Networks|Corporation|Corp|Ltd|Limited|Holdings|Financial|Company)\b/gi, "")
    .trim();
  const bases = new Set([name, cleaned]);
  const variants = new Set();
  for (const base of bases) {
    const nospace = base.toLowerCase().replace(/[^a-z0-9]/g, "");
    const hyphen = base
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");
    if (nospace) variants.add(nospace);
    if (hyphen) variants.add(hyphen);
  }
  return [...variants];
}

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

async function checkGreenhouse(slug) {
  const data = await fetchJSON(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`);
  if (data && Array.isArray(data.jobs) && data.jobs.length > 0) {
    return { slug, ats: "greenhouse", jobCount: data.jobs.length };
  }
  return null;
}

async function checkLever(slug) {
  const data = await fetchJSON(`https://api.lever.co/v0/postings/${slug}?mode=json`);
  if (Array.isArray(data) && data.length > 0) {
    return { slug, ats: "lever", jobCount: data.length };
  }
  return null;
}

async function checkAshby(slug) {
  const data = await fetchJSON(`https://api.ashbyhq.com/posting-api/job-board/${slug}`);
  if (data && Array.isArray(data.jobs) && data.jobs.length > 0) {
    return { slug, ats: "ashby", jobCount: data.jobs.length };
  }
  return null;
}

async function checkWorkable(slug) {
  const data = await fetchJSON(`https://apply.workable.com/api/v1/widget/accounts/${slug}`);
  if (data && Array.isArray(data.jobs) && data.jobs.length > 0) {
    return { slug, ats: "workable", jobCount: data.jobs.length };
  }
  return null;
}

async function checkSmartRecruiters(slug) {
  const data = await fetchJSON(`https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=100`);
  if (data && Array.isArray(data.content) && data.content.length > 0) {
    return { slug, ats: "smartrecruiters", jobCount: data.content.length };
  }
  return null;
}

const CHECKERS = [checkGreenhouse, checkLever, checkAshby, checkWorkable, checkSmartRecruiters];

async function runPool(items, worker) {
  const results = [];
  let i = 0;
  let done = 0;
  async function next() {
    while (i < items.length) {
      const idx = i++;
      const r = await worker(items[idx]);
      if (r) results.push(r);
      done++;
      if (done % 200 === 0) console.log(`  ...${done}/${items.length} probes done`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, next));
  return results;
}

(async () => {
  const slugSet = new Set();
  for (const name of names) {
    for (const v of slugVariants(name)) slugSet.add(v);
  }
  const slugs = [...slugSet];
  console.log(`${names.length} company names -> ${slugs.length} unique slug variants to probe across 4 ATS platforms (${slugs.length * 4} total probes)...`);

  // Build a flat list of {slug, checker} tasks so the pool balances across ATS types too.
  const tasks = [];
  for (const slug of slugs) {
    for (const checker of CHECKERS) tasks.push({ slug, checker });
  }

  const found = await runPool(tasks, ({ slug, checker }) => checker(slug));

  // dedupe: keep first match per slug (a slug could hit multiple ATS platforms
  // in rare collisions; keep the highest jobCount)
  const bySlug = new Map();
  for (const f of found) {
    const existing = bySlug.get(f.slug);
    if (!existing || f.jobCount > existing.jobCount) bySlug.set(f.slug, f);
  }
  const combined = [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug));

  const outPath = path.join(__dirname, "..", "data", "companies.json");
  fs.writeFileSync(outPath, JSON.stringify(combined, null, 2));

  console.log(`\nVerified ${combined.length} companies with live job boards.`);
  for (const ats of ["greenhouse", "lever", "ashby", "workable"]) {
    console.log(`  ${ats}: ${combined.filter((c) => c.ats === ats).length}`);
  }
  console.log(`Saved to ${outPath}`);
})();
