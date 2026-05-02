// 小红书 (xiaohongshu.com) extractor
// Xiaohongshu is not a traditional job board — job posts appear as note/feed items
registerExtractor({
  name: "xiaohongshu",
  matchPattern: /xiaohongshu\.com/,

  detectDetailPage(url) {
    return /\/explore\/|discovery\/|note\//.test(url)
  },

  detectListPage(url) {
    return /\/search_result|user\/profile/.test(url)
  },

  extractDetail() {
    const contentEl =
      document.querySelector(".note-text") ||
      document.querySelector('[class*="note-content"]') ||
      document.querySelector('[class*="desc"]')

    if (!contentEl) {
      return {
        title: document.title || "小红书岗位帖",
        company: "",
        jdText: document.body.innerText.slice(0, 5000),
        url: window.location.href,
        platform: "xiaohongshu",
      }
    }

    const fullText = cleanText(contentEl.textContent || "")
    // Try to extract title from first line
    const lines = fullText.split(". ").filter(Boolean)
    const title = lines[0]?.slice(0, 60) || "小红书岗位帖"

    // Try to find company name patterns
    const companyPatterns = [
      /【公司[：:]\s*(.+?)】/,
      /公司[：:]\s*(.+?)[\n。]/,
      /#(.+?)招聘/,
    ]
    let company = ""
    for (const p of companyPatterns) {
      const m = fullText.match(p)
      if (m) { company = m[1]; break }
    }

    return {
      title,
      company,
      location: "",
      salaryRange: extractSalaryFromText(fullText),
      jdText: fullText.slice(0, 5000),
      url: window.location.href,
      platform: "xiaohongshu",
    }
  },

  extractList() {
    // For search result pages, try to extract note titles
    const items = document.querySelectorAll('[class*="note-item"], section.note-item, [class*="feed-item"]')
    const jobs = []
    items.forEach((item) => {
      const title = cleanText(item.querySelector('[class*="title"]')?.textContent || item.querySelector("a")?.textContent || "")
      const link = item.querySelector("a")?.href || ""
      const hasJobKeywords = /招聘|招人|JD|岗位|职位|薪资|薪资|月薪|年薪|待遇/.test(title + (item.textContent || ""))
      if (title && hasJobKeywords) {
        jobs.push({ title, url: link, platform: "xiaohongshu" })
      }
    })

    // Fallback: if no structured items found, check the whole page for recruitment keywords
    if (jobs.length === 0 && /招聘|招人|岗位/.test(document.body.innerText)) {
      jobs.push({
        title: document.title || "小红书岗位",
        url: window.location.href,
        platform: "xiaohongshu",
      })
    }

    return jobs
  },

  getInjectAnchor() {
    return document.querySelector(".note-text, [class*='note-content'], [class*='content']") || document.body
  },
})
