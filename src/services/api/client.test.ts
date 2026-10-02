import { describe, expect, it, vi } from "vitest"

import { apiRequest, toQuery, tokenStore } from "./client"

describe("API client", () => {
  it("serializes only meaningful query values", () => {
    expect(toQuery({ page: 2, search: "dela", status: "", program_id: null })).toBe("?page=2&search=dela")
  })

  it("adds the Bearer token and parses success envelopes", async () => {
    tokenStore.set("test-token")
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ success: true, message: "ok", data: [{ id: 1 }], meta: { page: 1, per_page: 20, total: 1, last_page: 1 } }), { status: 200, headers: { "Content-Type": "application/json" } }))
    const result = await apiRequest<Array<{ id: number }>>("/students")
    expect(result.data[0].id).toBe(1)
    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers)
    expect(headers.get("Authorization")).toBe("Bearer test-token")
  })

  it("normalizes backend validation errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ success: false, message: "Validation failed.", errors: { email: ["value is not a valid email address"] } }), { status: 422, headers: { "Content-Type": "application/json" } }))
    await expect(apiRequest("/students", { method: "POST", body: "{}" })).rejects.toMatchObject({ kind: "validation", status: 422, fieldErrors: { email: ["value is not a valid email address"] } })
  })

  it("accepts empty 204 responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }))
    await expect(apiRequest<void>("/students/1", { method: "DELETE" })).resolves.toMatchObject({ success: true })
  })

  it("reports an unreachable backend as retryable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("failed"))
    await expect(apiRequest("/students")).rejects.toMatchObject({ kind: "network", retryable: true })
  })
})
