// Shared SDE1-equivalent title/location matching used across all sources.
const CITIES = ["hyderabad", "delhi", "gurugram", "gurgaon", "noida", "bengaluru", "bangalore", "ncr"];

// Roles that are clearly NOT entry-level (SDE1/SDE-1/SWE1/fresher/associate/new-grad).
const EXCLUDE_RE = /\b(ii|iii|iv|v|senior|sr\.?|staff|principal|lead|manager|director|architect|head|vp|vice\s+president|intern(ship)?|support|sales|solutions?\s+(architect|engineer)|test\s+engineer|qa\b|devops|security|data\s+engineer|ml\s+engineer|machine\s+learning|infra|network|forward\s+deployed|technical\s+support|embedded|specialist|expert)\b/i;

// L2+ level markers written as arabic numerals (e.g. "Software Engineer 2",
// "SDE 3") - EXCLUDE_RE only catches roman numerals (II/III), so this catches
// the numeric-level convention some companies (e.g. Rippling) use instead.
const NUMERIC_LEVEL_RE = /\b(engineer|developer|sde|swe)\s*[-,]?\s*[2-9]\b/i;

// Explicit level-1 indicators (SDE 1, SDE-I, Software Engineer I, associate, new grad, trainee).
const LEVEL1_RE =
  /\b(sde|swe)\s*[-,]?\s*(i|1)\b|software\s+(development\s+)?engineer\s*[-,]?\s*(i|1)\b|associate\s+software\s+engineer|new\s?grad|graduate\s+software\s+engineer|software\s+engineer\s+trainee/i;

// Generic "Software Engineer"/"Software Development Engineer" with no seniority
// qualifier anywhere in the title - the closest real-world proxy for SDE1 at
// companies that don't label levels explicitly. Not anchored to the start so
// it also catches real postings like "Junior Software Engineer - Fresher" or
// "Cloud Software Engineer". Also covers stack-specific titles that never say
// "software" at all (Backend Developer, Frontend Engineer, Full Stack Dev,
// Mobile/Android/iOS Developer) - these are the same job family under a
// different name and were being silently dropped before.
const GENERIC_RE =
  /(software\s+(development\s+)?(engineer|developer)\b|\bsde\b|\bswe\b|\bsre\b|site\s+reliability\s+engineer|\b(back[- ]?end|front[- ]?end|full[- ]?stack|web|mobile|android|ios|app)\s+(developer|engineer)\b)/i;

function matchesTitle(title) {
  if (!title) return false;
  const t = title.trim();
  if (EXCLUDE_RE.test(t) || NUMERIC_LEVEL_RE.test(t)) return false;
  return LEVEL1_RE.test(t) || GENERIC_RE.test(t);
}

function matchesCity(locationStr) {
  if (!locationStr) return false;
  const l = locationStr.toLowerCase();
  return CITIES.some((c) => l.includes(c));
}

module.exports = { matchesTitle, matchesCity, CITIES };
