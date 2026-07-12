// Brute-force probe for Workday's public CXS job-search endpoint, used by many
// large enterprises (Salesforce, Walmart, Adobe, SAP, etc). Pattern:
// https://{tenant}.wd{N}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs
const fs = require("fs");
const path = require("path");

const TENANTS = [
  "salesforce","walmart","adobe","sap","target","servicenow","nutanix",
  "autodesk","visa","mastercard","paypal","dell","netapp","nvidia",
  "qualcomm","cisco","intuit","workday","hpe","hp","ibm","oracle",
  "vmware","juniper","broadcom","micron","western_digital","seagate",
  "synopsys","cadence","arm","texasinstruments","ti","analog","amd",
  "corning","honeywell","ge","siemens","bosch","philips","nokia",
  "ericsson","goldmansachs","jpmorgan","morganstanley","americanexpress",
  "wellsfargo","capitalone","fisglobal","fiserv","dxc","ntt","cognizant",
  "genpact","hcl","tcs","wipro","infosys","tech_mahindra"
];
const WD_NUMS = [1, 2, 3, 5, 12];
const SITE_SLUGS = [
  "External_Career_Site", "Externalcareers", "Career", "Careers",
  "External", "ExternalCareerSite", "GlobalCareers"
];
const TIMEOUT_MS = 6000;
const CONCURRENCY = 8;

async function probeTenant(tenant) {
  for (const n of WD_NUMS) {
    for (const site of SITE_SLUGS) {
      const url = `https://${tenant}.wd${n}.myworkdayjobs.com/wday/cxs/${tenant}/${site}/jobs`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appliedFacets: {}, limit: 1, offset: 0, searchText: "" }),
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (!res.ok) continue;
        const data = await res.json();
        if (data && typeof data.total === "number") {
          return { tenant, wd: n, site, total: data.total, url };
        }
      } catch {
        clearTimeout(timer);
      }
    }
  }
  return null;
}

async function runPool(items, worker) {
  const results = [];
  let i = 0;
  async function next() {
    while (i < items.length) {
      const idx = i++;
      const r = await worker(items[idx]);
      if (r) results.push(r);
      console.log(`  [${idx + 1}/${items.length}] ${items[idx]} -> ${r ? "FOUND " + r.url : "no match"}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, next));
  return results;
}

(async () => {
  console.log(`Probing ${TENANTS.length} Workday tenants (this can take a few minutes)...`);
  const found = await runPool(TENANTS, probeTenant);
  const outPath = path.join(__dirname, "..", "data", "workday-companies.json");
  fs.writeFileSync(outPath, JSON.stringify(found, null, 2));
  console.log(`\nResolved ${found.length}/${TENANTS.length} Workday tenants.`);
  console.log(`Saved to ${outPath}`);
})();
