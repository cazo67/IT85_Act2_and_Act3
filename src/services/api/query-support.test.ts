import { QueryClient } from "@tanstack/react-query"
import { describe, expect, it, vi } from "vitest"
import { invalidateResource, listAll } from "./query-support"

describe("complete reference loading", () => {
  it("follows metadata beyond 100 and passes the cancellation signal", async () => {
    const signal = new AbortController().signal
    const list = vi.fn().mockResolvedValueOnce({ success: true, message: "ok", data: Array.from({ length: 100 }, (_, id) => ({ id: id + 1 })), meta: { last_page: 2 } }).mockResolvedValueOnce({ success: true, message: "ok", data: [{ id: 101 }], meta: { last_page: 2 } })
    const result = await listAll(list, signal)
    expect(result.data).toHaveLength(101)
    expect(result.data[100]).toEqual({ id: 101 })
    expect(list).toHaveBeenNthCalledWith(2, { page: 2, per_page: 100 }, signal)
  })
  it("rejects a failed later page instead of presenting a partial directory", async () => {
    const list = vi.fn().mockResolvedValueOnce({ data: [{ id: 1 }], meta: { last_page: 2 } }).mockRejectedValueOnce(new Error("Page failed"))
    await expect(listAll(list)).rejects.toThrow("Page failed")
  })
  it("does not issue requests when aborted", async () => {
    const controller = new AbortController()
    controller.abort()
    const list = vi.fn()
    await expect(listAll(list, controller.signal)).rejects.toMatchObject({ name: "AbortError" })
    expect(list).not.toHaveBeenCalled()
  })
})

describe("dependent cache refresh", () => {
  it("refreshes role-filtered account directories and connected workspaces after user edits", async () => {
    const client = new QueryClient()
    const keys = [["users"], ["lookup", "studentAccounts"], ["lookup", "instructors"], ["offering-workspace", 1], ["student-workspace", 17]]
    keys.forEach((key) => client.setQueryData(key, []))
    await invalidateResource(client, "users")
    keys.forEach((key) => expect(client.getQueryState(key)?.isInvalidated).toBe(true))
    client.clear()
  })
  it("invalidates warm grade summaries and academic records without touching unrelated lists", async () => {
    const client = new QueryClient()
    const keys = [["grades", { page: 1 }], ["dashboard", "grades"], ["academic-record", 1], ["programs"]]
    keys.forEach((key) => client.setQueryData(key, { value: "cached" }))
    await invalidateResource(client, "grades")
    keys.slice(0, 3).forEach((key) => expect(client.getQueryState(key)?.isInvalidated).toBe(true))
    expect(client.getQueryState(["programs"])?.isInvalidated).toBe(false)
    client.clear()
  })
  it("refreshes offering aliases, enrollment labels, scoped students and selectors", async () => {
    const client = new QueryClient()
    const keys = [["lookup", "offerings"], ["dashboard", "offerings"], ["lookup", "enrollments"], ["record-students"], ["students"], ["academic-record", 2]]
    keys.forEach((key) => client.setQueryData(key, []))
    await invalidateResource(client, "course-offerings")
    keys.forEach((key) => expect(client.getQueryState(key)?.isInvalidated).toBe(true))
    client.clear()
  })
})
