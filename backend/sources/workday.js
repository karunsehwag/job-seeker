const fs = require("fs");
const path = require("path");
const { matchesTitle, matchesCity } = require("../filters");

const TIMEOUT_MS = 12000;
const PAGE_SIZE = 20;
const MAX_PAGES = 15;

async function fetchJSON(url, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchOneTenant(tenant) {
  const results = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await fetchJSON(tenant.url, {
      appliedFacets: {},
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      searchText: "software engineer",
    });
    if (!data || !Array.isArray(data.jobPostings) || data.jobPostings.length === 0) break;

    for (const j of data.jobPostings) {
      if (matchesTitle(j.title) && matchesCity(j.locationsText)) {
        results.push({
          company: tenant.tenant,
          ats: "workday",
          title: j.title,
          location: j.locationsText,
          url: `https://${tenant.tenant}.wd${tenant.wd}.myworkdayjobs.com/${tenant.site}${j.externalPath}`,
          updatedAt: undefined,
        });
      }
    }
    if (page * PAGE_SIZE + PAGE_SIZE >= (data.total || 0)) break;
  }
  return results;
}

async function fetchWorkday() {
  const filePath = path.join(__dirname, "..", "..", "data", "workday-companies.json");
  if (!fs.existsSync(filePath)) return [];
  const tenants = JSON.parse(fs.readFileSync(filePath, "utf8")).filter((t) => t.total > 0);

  const results = [];
  await Promise.all(
    tenants.map(async (t) => {
      results.push(...(await fetchOneTenant(t)));
    })
  );
  return results;
}

module.exports = { fetchWorkday };
