import { useMemo } from "react"
import Link from "next/link"
import { MapPin, Building2 } from "lucide-react"
import type { Job } from "@/types"

interface JobCardProps {
  job: Job
}

interface ParsedJD {
  location?: string
  salaryRange?: string
  requirements?: string[]
}

export function JobCard({ job }: JobCardProps) {
  const parsed = useMemo<ParsedJD | null>(
    () => (job.parsedJson ? (JSON.parse(job.parsedJson) as ParsedJD) : null),
    [job.parsedJson]
  )

  return (
    <Link href={`/jobs/${job.id}`}>
      <div
        className="glass-card p-5 cursor-pointer transition-transform duration-200 hover:translate-y-[-2px] h-full flex flex-col gap-3"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3
              className="font-semibold text-[15px] -tracking-[0.02em] truncate"
              style={{ color: "var(--text)" }}
            >
              {job.title}
            </h3>
            {job.company && (
              <div
                className="flex items-center gap-1.5 text-[12.5px] mt-1"
                style={{ color: "var(--muted)" }}
              >
                <Building2 className="h-3 w-3" />
                <span className="truncate">{job.company}</span>
              </div>
            )}
          </div>
        </div>

        <div
          className="flex items-center gap-3 text-[12px]"
          style={{ color: "var(--muted)" }}
        >
          {(parsed?.location || job.location) && (
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {parsed?.location || job.location}
            </div>
          )}
          {(parsed?.salaryRange || job.salaryRange) && (
            <div
              className="font-mono font-semibold -tracking-[0.02em]"
              style={{ color: "var(--text)" }}
            >
              {parsed?.salaryRange || job.salaryRange}
            </div>
          )}
        </div>

        {parsed?.requirements && parsed.requirements.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {parsed.requirements.slice(0, 3).map((req: string, i: number) => (
              <span
                key={i}
                className="text-[10.5px] font-mono font-medium px-2 py-0.5 rounded-md"
                style={{
                  background: "rgba(15,15,20,0.04)",
                  color: "var(--muted)",
                  border: "1px solid var(--line-hi)",
                }}
              >
                {req}
              </span>
            ))}
          </div>
        )}

        <div
          className="mt-auto flex items-center justify-between text-[10.5px] font-mono pt-2"
          style={{ color: "var(--dim)" }}
        >
          <span
            className="px-2 py-0.5 rounded-md"
            style={{
              background:
                job.platform === "boss"
                  ? "rgba(96,165,250,0.1)"
                  : "rgba(15,15,20,0.04)",
              color: job.platform === "boss" ? "var(--mesh-sky)" : "var(--muted)",
            }}
          >
            {job.platform === "manual" ? "手动" : job.platform || "—"}
          </span>
          <span>{new Date(job.createdAt).toLocaleDateString("zh-CN")}</span>
        </div>
      </div>
    </Link>
  )
}
