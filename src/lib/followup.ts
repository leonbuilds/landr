// nextFollowup 文案 + 是否到期判断。客户端与服务端均可用，不依赖任何环境。

export interface FollowupInfo {
  date: Date
  /** true: 日期 <= 今天 (含今天)。看板上要标红/出现在待跟进列表里。 */
  due: boolean
  /** true: 日期严格早于今天，已经过期超过一天。卡片用更强的红色提示。 */
  overdue: boolean
  /** true: 日期恰好是今天。 */
  dueToday: boolean
  /** 已过期天数 (>0)；到期当天为 0；将来为负数。 */
  diffDays: number
  /** 卡片/列表上展示的文字。 */
  label: string
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function describeFollowup(
  raw: string | Date | null | undefined,
  now: Date = new Date()
): FollowupInfo | null {
  if (!raw) return null
  const date = raw instanceof Date ? raw : new Date(raw)
  if (isNaN(date.getTime())) return null

  const today = startOfDay(now)
  const target = startOfDay(date)
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86_400_000)
  const overdue = diffDays > 0
  const dueToday = diffDays === 0
  const due = diffDays >= 0

  let label: string
  if (overdue) label = `逾期 ${diffDays} 天`
  else if (dueToday) label = "今天跟进"
  else label = `${-diffDays} 天后跟进`

  return { date, due, overdue, dueToday, diffDays, label }
}
