import OpenAI from "openai"

const MODEL_CONFIGS: Record<string, { baseURL: string; model: string }> = {
  deepseek: { baseURL: "https://api.deepseek.com", model: "deepseek-chat" },
  kimi: { baseURL: "https://api.moonshot.cn/v1", model: "moonshot-v1-8k" },
  qwen: { baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-turbo" },
}

export const SUPPORTED_PROVIDERS = ["deepseek", "kimi", "qwen"] as const
export type Provider = (typeof SUPPORTED_PROVIDERS)[number]

// Errors whose status code indicates the call can be retried.
// 408 timeout, 409 conflict (unusual), 425 too early, 429 rate limit, 5xx server errors.
function isRetryableStatus(status: number | undefined): boolean {
  if (!status) return true // network-level failure (no response) — retry
  return status === 408 || status === 425 || status === 429 || status >= 500
}

function extractStatus(err: unknown): number | undefined {
  if (err && typeof err === "object") {
    const e = err as { status?: number; response?: { status?: number } }
    return e.status ?? e.response?.status
  }
  return undefined
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// 单次重试参数：3 次重试，等待 1s/2s/4s
const RETRY_DELAYS_MS = [1000, 2000, 4000]

async function callLLMOnce(prompt: string, apiKey: string, provider: string): Promise<string> {
  const config = MODEL_CONFIGS[provider] || MODEL_CONFIGS.deepseek
  const client = new OpenAI({ apiKey, baseURL: config.baseURL })
  const response = await client.chat.completions.create({
    model: config.model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
  })
  return response.choices[0].message.content || ""
}

export async function callLLM(
  prompt: string,
  apiKey: string,
  provider: string = "deepseek"
): Promise<string> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await callLLMOnce(prompt, apiKey, provider)
    } catch (err) {
      lastErr = err
      const status = extractStatus(err)
      if (!isRetryableStatus(status)) throw err
      if (attempt === RETRY_DELAYS_MS.length) break
      await sleep(RETRY_DELAYS_MS[attempt])
    }
  }
  throw lastErr
}

export interface ProviderKey {
  provider: string
  apiKey: string
}

/**
 * 在多个 provider 之间降级：依次尝试 primary、备用 1、备用 2…
 * 单个 provider 内部已带重试。每个 provider 失败后切换到下一个。
 * 如果所有 provider 都失败，抛出最后一个错误。
 */
export async function callLLMWithFallback(
  prompt: string,
  providers: ProviderKey[]
): Promise<{ output: string; usedProvider: string }> {
  if (providers.length === 0) {
    throw new Error("no provider configured")
  }
  let lastErr: unknown
  for (const p of providers) {
    try {
      const output = await callLLM(prompt, p.apiKey, p.provider)
      return { output, usedProvider: p.provider }
    } catch (err) {
      lastErr = err
      // 401/403 表示 key 无效 — 不应当被认为是「服务挂了」，但仍然继续尝试其他 provider
    }
  }
  throw lastErr
}

export function parseJsonFromLLM<T>(raw: string): T {
  // Extract JSON from markdown code fences if present
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : raw.trim()
  return JSON.parse(jsonStr) as T
}

// Prompt templates
export const DIAGNOSE_PROMPT = `你是一位资深HR和简历顾问。请分析以下简历，从三个维度评分（每项0-100分），并给出具体修改建议。返回纯JSON格式（不要markdown代码块）。

简历内容：
{{RESUME}}

返回格式：
{
  "score": 85,
  "dimensions": [
    {
      "name": "结构完整性",
      "score": 80,
      "suggestions": ["建议补充个人简介部分", "教育经历缺少时间线"]
    },
    {
      "name": "内容质量",
      "score": 85,
      "suggestions": ["工作经历中量化成果不够充分", "建议使用更多动作动词开头"]
    },
    {
      "name": "关键词匹配",
      "score": 90,
      "suggestions": ["缺少行业核心关键词：项目管理、数据分析", "技能标签可以更具体"]
    }
  ]
}`

export const PARSE_JD_PROMPT = `你是一位招聘专家。请分析以下招聘JD，提取关键信息。返回纯JSON格式（不要markdown代码块）。

JD内容：
{{JD}}

返回格式：
{
  "title": "岗位名称",
  "company": "公司名称",
  "requirements": ["核心要求1", "核心要求2"],
  "preferredSkills": ["优先技能1", "优先技能2"],
  "salaryRange": "薪资范围或空",
  "location": "工作地点或空"
}`

export const MATCH_PROMPT = `你是一位求职匹配专家。请对比以下简历和目标岗位JD，分析匹配度。返回纯JSON格式（不要markdown代码块）。

简历：
{{RESUME}}

岗位JD：
{{JD}}

返回格式：
{
  "score": 75,
  "matchedKeywords": ["关键词1", "关键词2"],
  "missingKeywords": ["缺失关键词1", "缺失关键词2"],
  "suggestedKeywords": ["可补充关键词1", "可补充关键词2"],
  "analysis": "综合分析说明，1-2句话"
}`

export const COVER_LETTER_PROMPT = `你是一位专业求职顾问。请根据以下简历和目标岗位JD，生成一封定制化求职信（cover letter）。使用指定的语气风格。返回纯JSON格式（不要markdown代码块）。

简历：
{{RESUME}}

岗位JD：
{{JD}}

语气：{{TONE}}（formal=正式专业 / confident=自信积极 / sincere=真诚务实）

返回格式：
{
  "subject": "求职信主题",
  "body": "求职信正文，包含称呼、开头、主体、结尾、落款",
  "tone": "使用的语气"
}`

export const INTERVIEW_PREP_PROMPT = `你是一位资深面试官。请根据以下简历和目标岗位JD，生成面试准备题目。题目应包含行为题、情景题和技术/专业题。每题附带STAR格式的参考回答要点。返回纯JSON格式（不要markdown代码块）。

简历：
{{RESUME}}

岗位JD：
{{JD}}

返回格式：
{
  "behavioral": [
    { "question": "行为面试题", "starAnswer": { "situation": "", "task": "", "action": "", "result": "" } }
  ],
  "situational": [
    { "question": "情景面试题", "starAnswer": { "situation": "", "task": "", "action": "", "result": "" } }
  ],
  "technical": [
    { "question": "技术/专业面试题", "starAnswer": { "situation": "", "task": "", "action": "", "result": "" } }
  ]
}`

export const REWRITE_PROMPT = `你是一位专业简历写手。请根据以下匹配分析结果，重写简历中的关键经历要点，使其更匹配目标岗位。返回纯JSON格式（不要markdown代码块）。

匹配分析：
{{MATCH_RESULT}}

原始简历：
{{RESUME}}

岗位JD：
{{JD}}

返回格式：
{
  "rewrittenPoints": [
    "重写后的经历要点1",
    "重写后的经历要点2",
    "重写后的经历要点3"
  ],
  "tips": "整体优化建议"
}`

export const SEARCH_PLAN_PROMPT = `你是一位求职助手。用户用一句话描述了找工作意向（或给出简历摘要）。请把它解析成 Boss 直聘的搜索参数。返回纯 JSON（不要 markdown 代码块）。

输入：
{{INPUT}}

返回格式（字段都尽量填，不确定就给保守默认）：
{
  "query": "前端开发",          // 主搜索关键词，岗位名/技能/方向，单一词或短语
  "city": "北京",               // 城市中文名，默认 "全国"
  "salaryMin": 30,              // 期望最低月薪 K，整数；用户没说就 0
  "salaryMax": 60,              // 期望最高月薪 K，整数；用户没说就 0
  "experience": "3-5年",        // 经验年限，可空字符串
  "companies": [],              // 用户特别点名的公司名数组，没就空数组
  "explanation": "我的理解：用户在找北京前端 30K-60K 的高级岗"
}`

export const GREETING_PROMPT = `你是一位求职者。基于以下简历和岗位 JD，写一段在 Boss 直聘上发给 HR 的"立即沟通"打招呼语。

要求：
- 80 字以内（中文标点算一个字）
- 自然、口语化，**避免模板感**（不要"您好HR"、"诚挚希望"这种模板用语）
- 突出 1-2 个最贴合岗位的具体优势（用数字或专有名词）
- 末尾不要"期待回复"之类客套，直接说想聊
- 返回纯文本（不要 markdown、不要引号、不要解释）

简历：
{{RESUME}}

岗位 JD：
{{JD}}

岗位标题：{{JOB_TITLE}}
公司：{{COMPANY}}
`
