import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Briefcase, MapPin, Building2 } from "lucide-react"
import type { Job } from "@/types"

interface JobCardProps {
  job: Job
}

export function JobCard({ job }: JobCardProps) {
  const parsed = job.parsedJson ? JSON.parse(job.parsedJson) : null

  return (
    <Link href={`/jobs/${job.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h3 className="font-semibold text-gray-900 line-clamp-1">{job.title}</h3>
              {job.company && (
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <Building2 className="h-3 w-3" />
                  {job.company}
                </div>
              )}
            </div>
            <Badge variant="outline" className="text-xs">
              {job.platform === "manual" ? "手动添加" : job.platform}
            </Badge>
          </div>

          {parsed?.location && (
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <MapPin className="h-3 w-3" />
              {parsed.location}
            </div>
          )}

          {parsed?.salaryRange && (
            <p className="text-sm text-green-600 font-medium">{parsed.salaryRange}</p>
          )}

          <div className="flex flex-wrap gap-1">
            {parsed?.requirements?.slice(0, 3).map((req: string, i: number) => (
              <Badge key={i} variant="secondary" className="text-xs">{req}</Badge>
            ))}
          </div>

          <p className="text-xs text-gray-400">
            {new Date(job.createdAt).toLocaleDateString("zh-CN")}
          </p>
        </CardContent>
      </Card>
    </Link>
  )
}
