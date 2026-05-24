import { describe, it, expect } from "vitest"
import { normalizeMustInclude, planToParamsJson } from "@/lib/boss-search"

describe("normalizeMustInclude", () => {
  it("returns empty array for non-array input", () => {
    expect(normalizeMustInclude(null)).toEqual([])
    expect(normalizeMustInclude(undefined)).toEqual([])
    expect(normalizeMustInclude("Java")).toEqual([])
    expect(normalizeMustInclude(42)).toEqual([])
  })

  it("trims + filters empty strings", () => {
    expect(normalizeMustInclude(["技术负责人", "", "  ", "Java"])).toEqual(["技术负责人", "Java"])
  })

  it("dedupes case-insensitively", () => {
    expect(normalizeMustInclude(["Java", "java", "JAVA"])).toEqual(["Java"])
  })

  it("drops words equal to query (case-insensitive, query 已经发给 Boss 了)", () => {
    expect(normalizeMustInclude(["Java", "技术负责人"], "java")).toEqual(["技术负责人"])
    expect(normalizeMustInclude(["Java", "技术负责人"], "Java")).toEqual(["技术负责人"])
  })

  it("ignores non-string entries", () => {
    expect(normalizeMustInclude(["Java", 42, null, undefined, "前端"])).toEqual(["Java", "前端"])
  })
})

describe("planToParamsJson", () => {
  it("includes mustInclude in params JSON", () => {
    const json = planToParamsJson(
      { query: "Java", mustInclude: ["技术负责人"], city: "北京", salaryMin: 30, salaryMax: 60 },
      2
    )
    const parsed = JSON.parse(json)
    expect(parsed.query).toBe("Java")
    expect(parsed.mustInclude).toEqual(["技术负责人"])
    expect(parsed.city).toBe("北京")
    expect(parsed.pages).toBe(2)
  })

  it("normalizes mustInclude during serialization", () => {
    const json = planToParamsJson(
      { query: "Java", mustInclude: ["Java", "技术负责人", "Java"], city: "北京", salaryMin: 0, salaryMax: 0 },
      1
    )
    const parsed = JSON.parse(json)
    expect(parsed.mustInclude).toEqual(["技术负责人"])
  })

  it("defaults mustInclude to empty array when missing", () => {
    const json = planToParamsJson(
      { query: "前端开发", city: "北京", salaryMin: 0, salaryMax: 0 },
      1
    )
    const parsed = JSON.parse(json)
    expect(parsed.mustInclude).toEqual([])
  })
})
