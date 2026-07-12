// Swiggy's careers site runs on NextHire (an Indian ATS). Its public
// careers API needs only a Referer header - no auth token at all.
const { matchesTitle, matchesCity } = require("../filters");

const TIMEOUT_MS = 12000;

async function fetchSwiggy() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch("https://swiggy.mynexthire.com/employer/careers/reqlist/get", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Referer: "https://careers.swiggy.com/",
        "User-Agent": "Mozilla/5.0",
      },
      body: JSON.stringify({ source: "careers", code: "", filterByBuId: -1 }),
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const data = await res.json();
    const jobs = Array.isArray(data.reqDetailsBOList) ? data.reqDetailsBOList : [];
    return jobs
      .filter((j) => matchesTitle(j.reqTitle) && matchesCity(j.location))
      .map((j) => ({
        company: "swiggy",
        ats: "nexthire",
        title: j.reqTitle,
        location: j.location,
        url: `https://careers.swiggy.com/#/job/${j.reqId}`,
        updatedAt: undefined,
      }));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { fetchSwiggy };
