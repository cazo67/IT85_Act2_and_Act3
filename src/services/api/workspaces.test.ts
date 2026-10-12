import { describe, expect, it, vi } from "vitest"
import { loadOfferingWorkspace } from "./workspaces"

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify({ success: status === 200, message: status === 200 ? "ok" : "Not an assigned offering", data, meta: { last_page: 1 } }), { status })
}
describe("authorized class workspace", () => {
  it("authorizes before requesting any roster or other student data", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(response(null, 403))
    await expect(loadOfferingWorkspace(2)).rejects.toMatchObject({ status: 403 })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(String(fetch.mock.calls[0][0])).toContain("/course-offerings/2")
  })
  it("joins grades by enrollment ID and excludes other classes", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const path = new URL(String(input)).pathname.replace("/api/v1", "")
      const data: Record<string, unknown> = {
        "/course-offerings/1": { id: 1, course_id: 1, academic_term_id: 1 },
        "/courses/1": { id: 1, course_code: "IT101" },
        "/academic-terms/1": { id: 1, semester: "First" },
        "/course-offerings/1/students": [{ id: 10, first_name: "Ana" }, { id: 20, first_name: "Ben" }],
        "/enrollments": [{ id: 50, student_id: 10, course_offering_id: 1 }, { id: 51, student_id: 20, course_offering_id: 1 }, { id: 52, student_id: 10, course_offering_id: 2 }],
        "/grades": [{ id: 99, enrollment_id: 50, final_grade: 0 }, { id: 100, enrollment_id: 52, final_grade: 90 }],
      }
      return response(data[path])
    })
    const result = await loadOfferingWorkspace(1)
    expect(result.roster).toHaveLength(2)
    expect(result.roster[0]).toMatchObject({ student: { id: 10 }, enrollment: { id: 50 }, grade: { id: 99, final_grade: 0 } })
    expect(result.roster[1].grade).toBeNull()
  })
  it("rejects inconsistent snapshots instead of offering a wrong grade action", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input)
      if (url.endsWith("course-offerings/1")) return response({ id: 1, course_id: 1, academic_term_id: 1 })
      if (url.includes("/enrollments?")) return response([{ id: 1, student_id: 99, course_offering_id: 1 }])
      if (url.includes("/students?") || url.includes("/grades?")) return response([])
      return response({ id: 1 })
    })
    await expect(loadOfferingWorkspace(1)).rejects.toThrow("roster changed")
  })
})
