# Job Seeker

Aggregates live SDE1 / entry-level software engineering job openings in Hyderabad, Delhi, Gurugram, Noida, and Bengaluru into a single searchable page — no clicking through to a dozen different sites.

Sources: Amazon Jobs, Microsoft Careers, Apple Jobs, Instahyre, JSearch (Google for Jobs), and ~35 companies on Greenhouse/Lever/Ashby/SmartRecruiters.

## Requirements

- [Node.js](https://nodejs.org) 20 or later

## Install

```bash
git clone https://github.com/karunsehwag/job-seeker.git
cd job-seeker
npm install
```

## Run

```bash
npm start
```

Then open **http://localhost:3000** in your browser.

The repo ships with a snapshot of job data already in `data/jobs.json`, so this works immediately after install — no extra setup needed to see it running.

## Get fresh job listings

Job postings go stale, so re-run the collector whenever you want the latest openings:

```bash
npm run refresh
```

This queries every source live and rewrites `data/jobs.json`. Refresh the browser page after it finishes — no server restart needed.

## Optional: enable the JSearch source

One of the sources (JSearch, which aggregates Google for Jobs / LinkedIn / Indeed / Glassdoor postings) needs a free API key:

1. Sign up at [rapidapi.com](https://rapidapi.com)
2. Subscribe to the free **Basic** plan on the [JSearch API](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch)
3. Copy your API key and create a `.env` file in the project root:

```bash
echo "RAPIDAPI_KEY=your_key_here" > .env
```

Without this key, `npm run refresh` still works — it just skips the JSearch source and logs a warning.

The free plan allows ~200 requests/month; each `npm run refresh` uses 5 (one per city), so don't run it more than a few dozen times a month.

## Project structure

```
backend/
  server.js          Express server (serves the frontend + /api/jobs)
  fetchAll.js         Refresh entry point - runs every source and writes data/jobs.json
  filters.js           Shared title/location matching rules
  sources/            One file per job source
  megaCompanyNames.js   Candidate company names probed against Greenhouse/Lever/Ashby/SmartRecruiters
  megaVerify.js        Rebuilds data/companies.json by testing candidates against those ATS APIs
frontend/            Static HTML/CSS/JS served by the Express app
data/                Generated data (jobs.json, companies.json) - checked in as a snapshot
```

## Adding more sources

Each file in `backend/sources/` follows the same shape: fetch data from somewhere, filter with `matchesTitle`/`matchesCity` from `filters.js`, and return an array of `{ company, title, location, url }`. To add a new company-specific source, copy an existing one (e.g. `sources/rippling.js`) as a template and wire it into `fetchAll.js`.

To expand the generic ATS scan, add company names to `megaCompanyNames.js` and re-run:

```bash
node backend/megaVerify.js
npm run refresh
```
