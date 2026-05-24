import mammoth from "mammoth"
import PdfParser from "pdf2json"

// pdf2json 把每段文本 URL-encode 后返回。某些字符 (特殊 emoji /
// 简历模板的特殊字形 / 截断的 % 序列) 会让 decodeURIComponent 抛 URIError —
// 由于这是在 event handler 里同步抛的, 外层 Promise 永远 pending,
// 整个 POST /api/resumes 会卡住没响应。所以这里逐段 try/catch 兜底。
function safeDecodeURIComponent(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    // 退路 1: 把孤立 % 转义掉再 decode 一次
    try {
      return decodeURIComponent(s.replace(/%(?![0-9A-Fa-f]{2})/g, "%25"))
    } catch {
      // 退路 2: 实在不行就返回原文 (至少不丢段, 给后续 LLM 兜底)
      return s
    }
  }
}

export async function parsePdf(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const parser = new PdfParser()
    parser.on("pdfParser_dataReady", (data: { Pages: { Texts: { R: { T: string }[] }[] }[] }) => {
      try {
        const texts: string[] = []
        for (const page of data.Pages) {
          for (const text of page.Texts) {
            const line = text.R.map((r) => safeDecodeURIComponent(r.T)).join(" ")
            texts.push(line)
          }
        }
        resolve(texts.join("\n"))
      } catch (err) {
        // 防御：哪怕事件处理器里抛了别的, 也要让 Promise 进入终态, 不能挂住 route
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    })
    parser.on("pdfParser_dataError", reject)
    parser.parseBuffer(buffer)
  })
}

export async function parseDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer })
  return result.value
}

interface EducationEntry {
  school?: string
  degree?: string
  major?: string
  time?: string
  description?: string
}

interface ExperienceEntry {
  company?: string
  title?: string
  time?: string
  description?: string
}

interface ProjectEntry {
  name?: string
  role?: string
  description?: string
}

interface StructuredResume {
  basics: { name?: string; email?: string; phone?: string; summary?: string }
  education: EducationEntry[]
  experience: ExperienceEntry[]
  projects: ProjectEntry[]
  skills: string[]
}

export function structureResumeText(rawText: string): StructuredResume {
  const lines = rawText.split("\n").filter((l) => l.trim())
  const result: StructuredResume = {
    basics: {},
    education: [],
    experience: [],
    projects: [],
    skills: [],
  }

  let currentSection = ""

  for (const line of lines) {
    const trimmed = line.trim().toLowerCase()

    if (trimmed.includes("教育") || trimmed.includes("学历")) {
      currentSection = "education"
      continue
    }
    if (trimmed.includes("工作") || trimmed.includes("经历") || trimmed.includes("经验")) {
      currentSection = "experience"
      continue
    }
    if (trimmed.includes("项目")) {
      currentSection = "projects"
      continue
    }
    if (trimmed.includes("技能") || trimmed.includes("技术") || trimmed.includes("擅")) {
      currentSection = "skills"
      continue
    }
    if (
      trimmed.includes("基本信息") ||
      trimmed.includes("个人") ||
      trimmed.includes("联系") ||
      trimmed.includes("简介")
    ) {
      currentSection = "basics"
      continue
    }

    switch (currentSection) {
      case "basics":
        if (!result.basics.summary) {
          result.basics.summary = line.trim()
        }
        break
      case "education":
        if (result.education.length === 0 || line.trim().length < 50) {
          result.education.push({ description: line.trim() })
        }
        break
      case "experience":
        result.experience.push({ description: line.trim() })
        break
      case "projects":
        result.projects.push({ description: line.trim() })
        break
      case "skills":
        result.skills.push(line.trim())
        break
      default:
        if (line.includes("@") || line.includes("电话") || line.includes("手机")) {
          result.basics.summary = (result.basics.summary || "") + " " + line.trim()
        }
    }
  }

  return result
}
