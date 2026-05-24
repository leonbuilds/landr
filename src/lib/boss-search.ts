// Boss直聘 搜索 URL 构造 + 城市码 + 薪资档位映射
// 城市码来自 Boss 公开城市列表（2024-2025 年版本）

export const BOSS_CITY_CODES: Record<string, string> = {
  全国: "100010000",
  北京: "101010100",
  上海: "101020100",
  广州: "101280100",
  深圳: "101280600",
  杭州: "101210100",
  成都: "101270100",
  南京: "101190100",
  武汉: "101200100",
  苏州: "101190400",
  西安: "101110100",
  长沙: "101250100",
  重庆: "101040100",
  天津: "101030100",
  郑州: "101180100",
  青岛: "101120200",
  厦门: "101230200",
  福州: "101230100",
  合肥: "101220100",
  济南: "101120100",
  宁波: "101210400",
  无锡: "101190200",
  大连: "101070200",
  沈阳: "101070100",
  东莞: "101281600",
  佛山: "101280800",
  长春: "101060101",
  哈尔滨: "101050100",
  昆明: "101290100",
  南昌: "101240100",
  贵阳: "101260101",
  石家庄: "101090101",
  太原: "101100100",
  南宁: "101300100",
  海口: "101310101",
  兰州: "101160101",
  乌鲁木齐: "101130101",
  呼和浩特: "101080101",
  银川: "101170101",
  西宁: "101150101",
  拉萨: "101140101",
  远程: "100010000", // Boss 上没真正的远程档位，回退全国
}

// Boss 薪资档位（2024 版）：1=3K以下 2=3-5K 3=5-10K 4=10-20K 5=20-50K 6=50K+
// 给定 minK/maxK，返回最贴近的档位代码（单选）。0 表示"不限"。
export function bossSalaryCode(minK: number, maxK: number): number {
  const target = minK || maxK || 0
  if (target <= 0) return 0
  if (target < 3) return 1
  if (target < 5) return 2
  if (target < 10) return 3
  if (target < 20) return 4
  if (target < 50) return 5
  return 6
}

export interface SearchPlan {
  query: string
  /**
   * 岗位标题必须同时包含的关键词 (AND, 大小写不敏感)。
   * Boss 搜索对多词 query 是 OR 拆词, 所以需要扩展端按标题二次过滤
   * 才能消除「Java 技术负责人」搜出一堆土建「技术负责人」这种偏离。
   */
  mustInclude?: string[]
  city: string
  salaryMin: number
  salaryMax: number
  experience?: string
  companies?: string[]
  explanation?: string
}

export function buildBossSearchUrl(plan: SearchPlan, page = 1): string {
  const cityCode = BOSS_CITY_CODES[plan.city] || BOSS_CITY_CODES["全国"]
  const params = new URLSearchParams()
  params.set("query", plan.query || "")
  params.set("city", cityCode)
  const salary = bossSalaryCode(plan.salaryMin, plan.salaryMax)
  if (salary) params.set("salary", String(salary))
  if (page > 1) params.set("page", String(page))
  return `https://www.zhipin.com/web/geek/job?${params.toString()}`
}

/** 过滤掉无意义/重复/为空的 mustInclude 词 (与 query 同义的词没意义) */
export function normalizeMustInclude(raw: unknown, query?: string): string[] {
  if (!Array.isArray(raw)) return []
  const queryLower = (query || "").toLowerCase().trim()
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of raw) {
    if (typeof v !== "string") continue
    const trimmed = v.trim()
    if (!trimmed) continue
    const lower = trimmed.toLowerCase()
    if (lower === queryLower) continue // query 已经发给 Boss, 不重复
    if (seen.has(lower)) continue
    seen.add(lower)
    out.push(trimmed)
  }
  return out
}

export function planToParamsJson(plan: SearchPlan, pages = 3) {
  return JSON.stringify({
    query: plan.query,
    mustInclude: normalizeMustInclude(plan.mustInclude, plan.query),
    city: plan.city,
    cityCode: BOSS_CITY_CODES[plan.city] || BOSS_CITY_CODES["全国"],
    salaryMin: plan.salaryMin,
    salaryMax: plan.salaryMax,
    salaryCode: bossSalaryCode(plan.salaryMin, plan.salaryMax),
    experience: plan.experience || "",
    companies: plan.companies || [],
    pages,
    platform: "boss",
    explanation: plan.explanation || "",
  })
}
