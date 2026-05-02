export interface User {
  id: number
  email: string
  name?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Resume {
  id: number
  userId: number
  name: string
  rawText?: string | null
  parsedJson?: string | null
  filePath?: string | null
  diagnosis?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Job {
  id: number
  userId: number
  title: string
  company?: string | null
  platform?: string | null
  jdText?: string | null
  parsedJson?: string | null
  salaryRange?: string | null
  location?: string | null
  url?: string | null
  createdAt: Date
}

export interface Application {
  id: number
  userId: number
  resumeId?: number | null
  jobId?: number | null
  status: string
  matchScore?: number | null
  matchDetail?: string | null
  tailoredResume?: string | null
  coverLetter?: string | null
  interviewPrep?: string | null
  notes?: string | null
  appliedAt?: Date | null
  nextFollowup?: Date | null
  createdAt: Date
  updatedAt: Date
  resume?: Resume | null
  job?: Job | null
}

export interface StatusLog {
  id: number
  applicationId: number
  fromStatus?: string | null
  toStatus?: string | null
  note?: string | null
  createdAt: Date
}

export interface Setting {
  id: number
  userId: number
  key: string
  value?: string | null
}

export interface DiagnosisResult {
  score: number
  dimensions: {
    name: string
    score: number
    suggestions: string[]
  }[]
}

export interface MatchResult {
  score: number
  matchedKeywords: string[]
  missingKeywords: string[]
  suggestedKeywords: string[]
  analysis: string
}

export interface RewriteResult {
  rewrittenPoints: string[]
  tips: string
}

export interface ParsedJD {
  title: string
  company: string
  requirements: string[]
  preferredSkills: string[]
  salaryRange: string
  location: string
}

export interface ApiResponse<T> {
  data?: T
  error?: { code: string; message: string }
}

export interface ImportJobInput {
  title: string
  company?: string
  location?: string
  salaryRange?: string
  jdText?: string
  url?: string
  platform?: string
}

export interface ImportJobsRequest {
  jobs: ImportJobInput[]
}

export interface ApplicationStats {
  total: number
  statusCounts: Record<string, number>
  dailyCounts: { date: string; count: number }[]
  pipeline: { stage: string; count: number }[]
  avgMatchScore: number
}
