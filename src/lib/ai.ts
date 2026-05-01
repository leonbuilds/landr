import OpenAI from "openai"

const MODEL_CONFIGS: Record<string, { baseURL: string; model: string }> = {
  deepseek: { baseURL: "https://api.deepseek.com", model: "deepseek-chat" },
  kimi: { baseURL: "https://api.moonshot.cn/v1", model: "moonshot-v1-8k" },
  qwen: { baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-turbo" },
}

export async function callLLM(
  prompt: string,
  apiKey: string,
  provider: string = "deepseek"
): Promise<string> {
  const config = MODEL_CONFIGS[provider] || MODEL_CONFIGS.deepseek
  const client = new OpenAI({ apiKey, baseURL: config.baseURL })
  const response = await client.chat.completions.create({
    model: config.model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
  })
  return response.choices[0].message.content || ""
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
