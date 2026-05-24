import { describe, it, expect, vi, beforeEach } from "vitest"

// Stub OpenAI before importing the module under test
const createMock = vi.fn()
vi.mock("openai", () => {
  return {
    default: class {
      chat = { completions: { create: createMock } }
      constructor(_opts: unknown) {}
    },
  }
})

// Speed up the retry waits
vi.mock("@/lib/ai", async (orig) => {
  const mod = (await orig()) as Record<string, unknown>
  return mod
})

import { callLLM, callLLMWithFallback } from "@/lib/ai"

function ok(content: string) {
  return Promise.resolve({ choices: [{ message: { content } }] })
}

class ApiErr extends Error {
  status: number
  constructor(status: number, msg: string) {
    super(msg)
    this.status = status
  }
}

describe("callLLM retry", () => {
  beforeEach(() => {
    createMock.mockReset()
    vi.useFakeTimers()
  })

  it("returns content on first try", async () => {
    createMock.mockReturnValueOnce(ok("hi"))
    const out = await callLLM("p", "k", "deepseek")
    expect(out).toBe("hi")
    expect(createMock).toHaveBeenCalledTimes(1)
  })

  it("retries on 500 and succeeds", async () => {
    createMock
      .mockImplementationOnce(() => Promise.reject(new ApiErr(500, "boom")))
      .mockImplementationOnce(() => ok("ok"))
    const p = callLLM("p", "k", "deepseek")
    await vi.runAllTimersAsync()
    const out = await p
    expect(out).toBe("ok")
    expect(createMock).toHaveBeenCalledTimes(2)
  })

  it("retries on 429 up to 3 times then throws", async () => {
    createMock.mockImplementation(() => Promise.reject(new ApiErr(429, "rate")))
    const p = callLLM("p", "k", "deepseek")
    await vi.runAllTimersAsync()
    await expect(p).rejects.toThrow("rate")
    expect(createMock).toHaveBeenCalledTimes(4) // 1 + 3 retries
  })

  it("does NOT retry on 401 auth error", async () => {
    createMock.mockImplementation(() => Promise.reject(new ApiErr(401, "bad key")))
    await expect(callLLM("p", "k", "deepseek")).rejects.toThrow("bad key")
    expect(createMock).toHaveBeenCalledTimes(1)
  })

  it("does NOT retry on 400 bad request", async () => {
    createMock.mockImplementation(() => Promise.reject(new ApiErr(400, "nope")))
    await expect(callLLM("p", "k", "deepseek")).rejects.toThrow("nope")
    expect(createMock).toHaveBeenCalledTimes(1)
  })

  it("retries on network failure (no status)", async () => {
    createMock
      .mockImplementationOnce(() => Promise.reject(new Error("ECONNRESET")))
      .mockImplementationOnce(() => ok("recovered"))
    const p = callLLM("p", "k", "deepseek")
    await vi.runAllTimersAsync()
    expect(await p).toBe("recovered")
  })
})

describe("callLLMWithFallback", () => {
  beforeEach(() => {
    createMock.mockReset()
    vi.useFakeTimers()
  })

  it("uses primary if it succeeds", async () => {
    createMock.mockReturnValueOnce(ok("primary"))
    const r = await callLLMWithFallback("p", [
      { provider: "deepseek", apiKey: "k1" },
      { provider: "kimi", apiKey: "k2" },
    ])
    expect(r.output).toBe("primary")
    expect(r.usedProvider).toBe("deepseek")
  })

  it("falls through to kimi when deepseek 5xx exhausts retries", async () => {
    const fail = () => Promise.reject(new ApiErr(500, "x"))
    createMock
      .mockImplementationOnce(fail)
      .mockImplementationOnce(fail)
      .mockImplementationOnce(fail)
      .mockImplementationOnce(fail)
      .mockImplementationOnce(() => ok("kimi-ans"))
    const p = callLLMWithFallback("p", [
      { provider: "deepseek", apiKey: "k1" },
      { provider: "kimi", apiKey: "k2" },
    ])
    await vi.runAllTimersAsync()
    const r = await p
    expect(r.output).toBe("kimi-ans")
    expect(r.usedProvider).toBe("kimi")
  })

  it("falls through to kimi on deepseek 401 (no retry, instant switch)", async () => {
    createMock
      .mockImplementationOnce(() => Promise.reject(new ApiErr(401, "bad")))
      .mockImplementationOnce(() => ok("kimi-ans"))
    const r = await callLLMWithFallback("p", [
      { provider: "deepseek", apiKey: "k1" },
      { provider: "kimi", apiKey: "k2" },
    ])
    expect(r.usedProvider).toBe("kimi")
    expect(createMock).toHaveBeenCalledTimes(2)
  })

  it("throws when all providers fail", async () => {
    createMock.mockImplementation(() => Promise.reject(new ApiErr(401, "bad")))
    const p = callLLMWithFallback("p", [
      { provider: "deepseek", apiKey: "k1" },
      { provider: "kimi", apiKey: "k2" },
    ])
    await expect(p).rejects.toThrow("bad")
  })

  it("throws if no providers configured", async () => {
    await expect(callLLMWithFallback("p", [])).rejects.toThrow(/no provider/)
  })
})
