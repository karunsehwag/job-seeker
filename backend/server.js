const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const JOBS_PATH = path.join(__dirname, "..", "data", "jobs.json");

function readJSON(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

app.use(express.static(path.join(__dirname, "..", "frontend")));

app.get("/api/jobs", (req, res) => {
  const data = readJSON(JOBS_PATH, { generatedAt: null, count: 0, jobs: [] });
  res.json(data);
});

app.listen(PORT, () => {
  console.log(`Job seeker app running at http://localhost:${PORT}`);
});
