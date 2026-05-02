import mammoth from "mammoth"
import { getDocument, GlobalWorkerOptions, version } from "pdfjs-dist"

// Use the legacy build for Node.js compatibility
GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.js`

export async function parsePdf(buffer: Buffer): Promise<string> {
  const loadingTask = getDocument({ data: new Uint8Array(buffer) })
  const pdf = await loadingTask.promise
  const pages: string[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const text = content.items.map((item: any) => item.str).join(" ")
    pages.push(text)
  }

  return pages.join("\n")
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

  // Simple heuristic-based structuring
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
        // Auto-detect section by content
        if (line.includes("@") || line.includes("电话") || line.includes("手机")) {
          result.basics.summary = (result.basics.summary || "") + " " + line.trim()
        }
    }
  }

  return result
}
