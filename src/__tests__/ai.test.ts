import { parseJsonFromLLM, DIAGNOSE_PROMPT, MATCH_PROMPT, COVER_LETTER_PROMPT, INTERVIEW_PREP_PROMPT } from "@/lib/ai"

describe("ai", () => {
  describe("parseJsonFromLLM", () => {
    it("parses raw JSON", () => {
      const result = parseJsonFromLLM<{ x: number }>('{"x": 1}')
      expect(result).toEqual({ x: 1 })
    })

    it("extracts JSON from markdown code fence", () => {
      const raw = '```json\n{"score": 85}\n```'
      const result = parseJsonFromLLM<{ score: number }>(raw)
      expect(result).toEqual({ score: 85 })
    })

    it("extracts JSON without language marker", () => {
      const raw = '```\n{"key": "val"}\n```'
      const result = parseJsonFromLLM<{ key: string }>(raw)
      expect(result).toEqual({ key: "val" })
    })

    it("trims surrounding text and parses JSON", () => {
      const raw = "Here is the result:\n\n```json\n{\"ok\": true}\n```\n\nHope this helps!"
      const result = parseJsonFromLLM<{ ok: boolean }>(raw)
      expect(result).toEqual({ ok: true })
    })
  })

  describe("prompt templates", () => {
    it("DIAGNOSE_PROMPT contains resume placeholder", () => {
      expect(DIAGNOSE_PROMPT).toContain("{{RESUME}}")
    })

    it("MATCH_PROMPT contains resume and JD placeholders", () => {
      expect(MATCH_PROMPT).toContain("{{RESUME}}")
      expect(MATCH_PROMPT).toContain("{{JD}}")
    })

    it("COVER_LETTER_PROMPT contains tone placeholder", () => {
      expect(COVER_LETTER_PROMPT).toContain("{{TONE}}")
    })

    it("INTERVIEW_PREP_PROMPT returns structured format", () => {
      const replaced = INTERVIEW_PREP_PROMPT.replace("{{RESUME}}", "test").replace("{{JD}}", "test")
      expect(replaced).toContain("behavioral")
      expect(replaced).toContain("situational")
      expect(replaced).toContain("technical")
    })
  })
})
