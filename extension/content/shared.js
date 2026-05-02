// Shared helpers for all extractors
function cleanText(text) {
  if (!text) return ""
  return text.replace(/\s+/g, " ").trim()
}

function extractMeta(name) {
  const el = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`)
  return el ? el.getAttribute("content") || "" : ""
}

function extractLdJson(type) {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]')
  for (const s of scripts) {
    try {
      const data = JSON.parse(s.textContent)
      if (data["@type"] === type) return data
      if (Array.isArray(data)) {
        const found = data.find((d) => d["@type"] === type)
        if (found) return found
      }
    } catch {}
  }
  return null
}

function extractSalaryFromText(text) {
  if (!text) return ""
  const patterns = [
    /(\d+[kKwW]\s*[-~—]\s*\d+[kKwW])/i,
    /(\d+[,.]?\d*K?\s*[-~—]\s*\d+[,.]?\d*K?\s*[·•]?\s*\d*\s*薪?)/i,
    /(\d+k\s*[-~—]\s*\d+k)/i,
  ]
  for (const p of patterns) {
    const m = text.match(p)
    if (m) return m[1]
  }
  return ""
}

// Registry of all extractors (filled by individual files)
const EXTRACTORS = []

function registerExtractor(ext) {
  EXTRACTORS.push(ext)
}

function findExtractor(url) {
  return EXTRACTORS.find((e) => e.matchPattern.test(url))
}

function getExtractors() {
  return EXTRACTORS
}
