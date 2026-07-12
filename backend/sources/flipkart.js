// Flipkart's careers site runs on TurboHire (an Indian ATS). Its public
// career-page API needs a short-lived bearer token from a "noauth" token
// endpoint (gated only by a Referer header check, no real auth).
const { matchesTitle, matchesCity } = require("../filters");

const ORG_ID = "4d757ba0-3d57-448a-b82c-238ed87ac90f";
const REFERER = "https://flipkart.turbohire.co/";
const TIMEOUT_MS = 12000;

async function fetchJSON(url, opts) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFlipkart() {
  const tokenData = await fetchJSON("https://thapi.azurewebsites.net/api/token/noauth", {
    headers: { Referer: REFERER, "User-Agent": "Mozilla/5.0" },
  });
  if (!tokenData || !tokenData.access_token) return [];

  const data = await fetchJSON(
    `https://thapi.azurewebsites.net/api/careerpagev2/filteredjobs?orgId=${ORG_ID}&pageType=0`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Referer: REFERER,
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0",
      },
      body: JSON.stringify({
        BunitIds: { Value: null, FilterType: 0 },
        Experience: { Value: null, FilterType: 0 },
        JobTypes: { Value: null, FilterType: 0 },
        Locations: { Value: null, FilterType: 0 },
        CreatedDate: { Value: null, FilterType: 0 },
        Compensation: { Value: null, FilterType: 0 },
        Skills: { Value: null, FilterType: 0 },
        Keyword: "",
        ClientIds: { Value: null, FilterType: 0 },
        Department: "",
        SortByV2: { Key: "AtoZ", Order: 2 },
      }),
    }
  );
  if (!data || !Array.isArray(data.Result)) return [];

  function parseLocation(raw) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map((p) => p.Address).join(", ") : raw;
    } catch {
      return raw;
    }
  }

  return data.Result.map((j) => ({ ...j, _location: parseLocation(j.Location) }))
    .filter((j) => matchesTitle(j.JobTitle) && matchesCity(j._location))
    .map((j) => ({
      company: "flipkart",
      ats: "turbohire",
      title: j.JobTitle,
      location: j._location,
      url: `https://flipkart.turbohire.co/careerpage/${ORG_ID}`,
      updatedAt: j.UpdatedDate,
    }));
}

module.exports = { fetchFlipkart };
