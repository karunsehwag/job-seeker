let allJobs = [];
let jobsMeta = { generatedAt: null, count: 0 };
let jobFlags = loadFlags();

function loadFlags() {
  try {
    const current = localStorage.getItem("jobFlags");
    if (current) return JSON.parse(current);
  } catch {}

  // Migrate from the single-exclusive-status version.
  try {
    const legacy = localStorage.getItem("jobStatus");
    if (legacy) {
      const parsed = JSON.parse(legacy);
      const migrated = {};
      for (const [url, val] of Object.entries(parsed)) {
        migrated[url] = {
          applied: val.status === "applied",
          contactHr: val.status === "contact-hr",
          notInterested: val.status === "not-interested",
          updatedAt: val.updatedAt || new Date().toISOString(),
        };
      }
      localStorage.setItem("jobFlags", JSON.stringify(migrated));
      localStorage.removeItem("jobStatus");
      return migrated;
    }
  } catch {}

  // Migrate from the original applied-only version, if that's still what's stored.
  try {
    const legacyApplied = localStorage.getItem("appliedJobs");
    if (legacyApplied) {
      const parsed = JSON.parse(legacyApplied);
      const migrated = {};
      for (const [url, val] of Object.entries(parsed)) {
        migrated[url] = { applied: true, updatedAt: val.appliedAt || new Date().toISOString() };
      }
      localStorage.setItem("jobFlags", JSON.stringify(migrated));
      localStorage.removeItem("appliedJobs");
      return migrated;
    }
  } catch {}

  return {};
}

function saveFlags() {
  localStorage.setItem("jobFlags", JSON.stringify(jobFlags));
}

async function loadJobs() {
  const res = await fetch("/api/jobs");
  const data = await res.json();
  allJobs = data.jobs || [];
  jobsMeta = { generatedAt: data.generatedAt, count: data.count };
  renderMeta();
  renderJobs();
}

function renderMeta() {
  const meta = document.getElementById("jobs-meta");
  let appliedCount = 0;
  let contactHrCount = 0;
  let notInterestedCount = 0;
  for (const f of Object.values(jobFlags)) {
    if (f.applied) appliedCount++;
    if (f.contactHr) contactHrCount++;
    if (f.notInterested) notInterestedCount++;
  }
  const parts = [`${jobsMeta.count} openings`];
  if (appliedCount) parts.push(`${appliedCount} applied`);
  if (contactHrCount) parts.push(`${contactHrCount} to contact HR`);
  if (notInterestedCount) parts.push(`${notInterestedCount} not interested`);
  meta.textContent = jobsMeta.generatedAt
    ? `${parts.join(" · ")} · updated ${new Date(jobsMeta.generatedAt).toLocaleString()}`
    : "no data yet";
}

function renderJobs() {
  const list = document.getElementById("jobs-list");
  const q = document.getElementById("job-search").value.trim().toLowerCase();
  const city = document.getElementById("city-filter").value;
  const dateWindow = document.getElementById("date-filter").value;
  const filterApplied = document.getElementById("filter-applied").checked;
  const filterContactHr = document.getElementById("filter-contact-hr").checked;
  const filterNotInterested = document.getElementById("filter-not-interested").checked;

  const filtered = allJobs.filter((j) => {
    const hay = `${j.company} ${j.title}`.toLowerCase();
    const matchesQuery = !q || hay.includes(q);
    const matchesCity = !city || (j.location || "").toLowerCase().includes(city);
    const flags = jobFlags[j.url] || {};
    const matchesFlags =
      (!filterApplied || flags.applied) &&
      (!filterContactHr || flags.contactHr) &&
      (!filterNotInterested || flags.notInterested);
    const matchesDate =
      !dateWindow ||
      (j.updatedAt && Date.now() - new Date(j.updatedAt).getTime() <= Number(dateWindow) * 24 * 60 * 60 * 1000);
    return matchesQuery && matchesCity && matchesFlags && matchesDate;
  });

  if (filtered.length === 0) {
    list.innerHTML = '<p class="empty">No matching openings right now. Try clearing filters.</p>';
    return;
  }

  list.innerHTML = filtered
    .map((j) => {
      const flags = jobFlags[j.url] || {};
      const cardClasses = [
        flags.applied ? "status-applied" : "",
        flags.contactHr ? "status-contact-hr" : "",
        flags.notInterested ? "status-not-interested" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `
    <div class="job-card${cardClasses ? " " + cardClasses : ""}">
      <div class="job-top">
        <div class="job-main">
          <p class="job-title">${escapeHtml(j.title)}</p>
          <div class="job-sub">
            <span class="company-tag">${escapeHtml(j.company)}</span>
            <span>${escapeHtml(j.location || "India")}</span>
            ${j.updatedAt ? `<span class="posted-tag">${escapeHtml(formatPostedDate(j.updatedAt))}</span>` : ""}
            ${flags.applied ? '<span class="status-tag status-tag-applied">Applied</span>' : ""}
            ${flags.contactHr ? '<span class="status-tag status-tag-contact-hr">Contact HR</span>' : ""}
            ${flags.notInterested ? '<span class="status-tag status-tag-not-interested">Not interested</span>' : ""}
          </div>
        </div>
        <div class="job-actions">
          <a class="apply-btn" href="${escapeAttr(j.url)}" target="_blank" rel="noopener noreferrer">View &amp; Apply</a>
          <div class="flag-toggles">
            <button class="flag-btn flag-applied${flags.applied ? " active" : ""}" data-url="${escapeAttr(j.url)}" data-flag="applied">Applied</button>
            <button class="flag-btn flag-contact-hr${flags.contactHr ? " active" : ""}" data-url="${escapeAttr(j.url)}" data-flag="contactHr">Contact HR</button>
            <button class="flag-btn flag-not-interested${flags.notInterested ? " active" : ""}" data-url="${escapeAttr(j.url)}" data-flag="notInterested">Not interested</button>
          </div>
        </div>
      </div>
      <input class="notes-input" type="text" data-url="${escapeAttr(j.url)}" placeholder="Recruiter name, email, LinkedIn link..." value="${escapeAttr(flags.notes || "")}" />
    </div>
  `;
    })
    .join("");
}

function formatPostedDate(iso) {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "";
  const diffDays = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "Posted today";
  if (diffDays === 1) return "Posted yesterday";
  if (diffDays < 30) return `Posted ${diffDays}d ago`;
  return `Posted ${date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}`;
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}
function escapeAttr(str) {
  return escapeHtml(str);
}

document.getElementById("job-search").addEventListener("input", renderJobs);
document.getElementById("city-filter").addEventListener("change", renderJobs);
document.getElementById("date-filter").addEventListener("change", renderJobs);
document.getElementById("filter-applied").addEventListener("change", renderJobs);
document.getElementById("filter-contact-hr").addEventListener("change", renderJobs);
document.getElementById("filter-not-interested").addEventListener("change", renderJobs);

document.getElementById("jobs-list").addEventListener("click", (e) => {
  const btn = e.target.closest(".flag-btn");
  if (!btn) return;
  const url = btn.dataset.url;
  const flag = btn.dataset.flag;
  const current = jobFlags[url] || {};
  current[flag] = !current[flag];
  current.updatedAt = new Date().toISOString();
  jobFlags[url] = current;
  saveFlags();
  renderMeta();
  renderJobs();
});

document.getElementById("jobs-list").addEventListener("input", (e) => {
  const input = e.target.closest(".notes-input");
  if (!input) return;
  const url = input.dataset.url;
  const current = jobFlags[url] || {};
  current.notes = input.value;
  current.updatedAt = new Date().toISOString();
  jobFlags[url] = current;
  saveFlags();
  // Deliberately skip renderJobs() here — it would rebuild the DOM mid-keystroke
  // and yank focus out of the input the user is typing in.
});

loadJobs();
