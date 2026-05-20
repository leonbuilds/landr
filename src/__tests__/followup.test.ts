import { describe, it, expect } from "vitest"
import { describeFollowup } from "@/lib/followup"

const FIXED_NOW = new Date(2026, 4, 21, 14, 30) // 2026-05-21 14:30 local

describe("describeFollowup", () => {
  it("returns null for null / undefined / empty", () => {
    expect(describeFollowup(null, FIXED_NOW)).toBeNull()
    expect(describeFollowup(undefined, FIXED_NOW)).toBeNull()
    expect(describeFollowup("", FIXED_NOW)).toBeNull()
  })

  it("returns null for unparseable date", () => {
    expect(describeFollowup("not a date", FIXED_NOW)).toBeNull()
  })

  it("flags today as dueToday + due, not overdue", () => {
    const r = describeFollowup(new Date(2026, 4, 21, 9, 0), FIXED_NOW)!
    expect(r.due).toBe(true)
    expect(r.overdue).toBe(false)
    expect(r.dueToday).toBe(true)
    expect(r.diffDays).toBe(0)
    expect(r.label).toBe("今天跟进")
  })

  it("flags yesterday as overdue 1 day", () => {
    const r = describeFollowup(new Date(2026, 4, 20), FIXED_NOW)!
    expect(r.overdue).toBe(true)
    expect(r.dueToday).toBe(false)
    expect(r.due).toBe(true)
    expect(r.diffDays).toBe(1)
    expect(r.label).toBe("逾期 1 天")
  })

  it("flags tomorrow as not due, label '1 天后跟进'", () => {
    const r = describeFollowup(new Date(2026, 4, 22), FIXED_NOW)!
    expect(r.due).toBe(false)
    expect(r.overdue).toBe(false)
    expect(r.dueToday).toBe(false)
    expect(r.diffDays).toBe(-1)
    expect(r.label).toBe("1 天后跟进")
  })

  it("accepts ISO date string", () => {
    const r = describeFollowup("2026-05-20", FIXED_NOW)!
    expect(r.overdue).toBe(true)
  })

  it("treats different times on same day as dueToday (no clock-time false-overdue)", () => {
    // raw is later in the day than 'now' — still dueToday, not overdue
    const r = describeFollowup(new Date(2026, 4, 21, 23, 59), FIXED_NOW)!
    expect(r.dueToday).toBe(true)
    expect(r.overdue).toBe(false)
  })
})
