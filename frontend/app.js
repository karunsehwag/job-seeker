let allJobs = [];

async function loadJobs() {
  const res = await fetch("/api/jobs");
  const data = await res.json();
  allJobs = data.jobs || [];
  const meta = document.getElementById("jobs-meta");
  meta.textContent = data.generatedAt
    ? `${data.count} openings · updated ${new Date(data.generatedAt).toLocaleString()}`
    : "no data yet";
  renderJobs();
}

function renderJobs() {
  const list = document.getElementById("jobs-list");
  const q = document.getElementById("job-search").value.trim().toLowerCase();
  const city = document.getElementById("city-filter").value;

  const filtered = allJobs.filter((j) => {
    const hay = `${j.company} ${j.title}`.toLowerCase();
    const matchesQuery = !q || hay.includes(q);
    const matchesCity = !city || (j.location || "").toLowerCase().includes(city);
    return matchesQuery && matchesCity;
  });

  if (filtered.length === 0) {
    list.innerHTML = '<p class="empty">No matching openings right now. Try clearing filters.</p>';
    return;
  }

  list.innerHTML = filtered
    .map(
      (j) => `
    <div class="job-card">
      <div class="job-main">
        <p class="job-title">${escapeHtml(j.title)}</p>
        <div class="job-sub">
          <span class="company-tag">${escapeHtml(j.company)}</span>
          <span>${escapeHtml(j.location || "India")}</span>
        </div>
      </div>
      <a class="apply-btn" href="${escapeAttr(j.url)}" target="_blank" rel="noopener noreferrer">View &amp; Apply</a>
    </div>
  `
    )
    .join("");
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}
function escapeAttr(str) {
  return escapeHtml(str);
}

document.getElementById("job-search").addEventListener("input", renderJobs);
document.getElementById("city-filter").addEventListener("change", renderJobs);

loadJobs();
