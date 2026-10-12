import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ResourcePage } from "./resource-page"
import { resources } from "./resource-definitions"
import { AcademicRecordPage } from "@/features/academic-record/academic-record-page"
import { DashboardPage } from "@/features/dashboard/dashboard-page"
import { ReferenceSelect } from "./reference-select"

const auth = vi.hoisted(() => ({ user: { role: "ADMIN", name: "Admin" } }))
vi.mock("@/features/auth/auth-context", () => ({ useAuth: () => auth }))

function mount(node: React.ReactNode, entry = "/") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 }, mutations: { retry: false } } })
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[entry]}>{node}</MemoryRouter></QueryClientProvider>)
  return client
}
function envelope(data: unknown, lastPage = 1) {
  return new Response(JSON.stringify({ success: true, message: "ok", data, meta: { total: Array.isArray(data) ? data.length : 1, page: 1, per_page: 100, last_page: lastPage } }), { status: 200 })
}
afterEach(() => { cleanup(); auth.user.role = "ADMIN" })

describe("Phase 1 reference forms", () => {
  it.each(["STUDENT", "INSTRUCTOR"])("does not open a creation deep link for %s", async (role) => {
    auth.user.role = role
    vi.spyOn(globalThis, "fetch").mockResolvedValue(envelope([]))
    mount(<ResourcePage definition={resources.students} />, "/students?create=1")
    await screen.findByText("No students found")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Create student" })).not.toBeInTheDocument()
  })
  it("retries required lookup errors without losing a typed draft", async () => {
    let available = false
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes("/programs")) {
        if (!available) throw new TypeError("offline")
        return envelope([{ id: 1, code: "IT", name: "Technology" }])
      }
      return envelope([])
    })
    mount(<ResourcePage definition={resources.students} />)
    fireEvent.click(screen.getByRole("button", { name: "Create student" }))
    const dialog = within(screen.getByRole("dialog"))
    fireEvent.change(dialog.getByLabelText("First name", { exact: false }), { target: { value: "Preserved draft" } })
    await waitFor(() => expect(dialog.getByText(/Could not load programs options/)).toBeVisible())
    expect(dialog.getByRole("button", { name: "Create student" })).toBeDisabled()
    available = true
    fireEvent.click(dialog.getByRole("button", { name: "Retry programs options" }))
    await waitFor(() => expect(dialog.getByRole("option", { name: "IT — Technology" })).toBeInTheDocument())
    expect(dialog.getByLabelText("First name", { exact: false })).toHaveValue("Preserved draft")
    expect(dialog.getByLabelText("Program", { exact: false, selector: "select" })).toBeEnabled()
    fireEvent.change(dialog.getByLabelText("Program", { exact: false, selector: "select" }), { target: { value: "1" } })
    expect(dialog.getByRole("button", { name: "Create student" })).toBeEnabled()
  })

  it("keeps the selected option visible when searching and when the dependency is unavailable", () => {
    const { rerender } = render(<ReferenceSelect id="choice" label="Student" value="101" onChange={() => {}} options={[{ id: 1, label: "Ana" }, { id: 101, label: "Ben" }]} />)
    fireEvent.change(screen.getByLabelText("Search student options"), { target: { value: "Ana" } })
    expect(screen.getByRole("combobox")).toHaveValue("101")
    expect(screen.getByRole("option", { name: "Ben" })).toBeInTheDocument()
    rerender(<ReferenceSelect label="Student" value="101" onChange={() => {}} disabled options={[]} />)
    expect(screen.getByRole("combobox")).toHaveValue("101")
    expect(screen.getByRole("option", { name: "Selected #101 (unavailable)" })).toBeInTheDocument()
  })
})

describe("Phase 1 academic and summary feedback", () => {
  it("offers academic-record students from later pages", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = new URL(String(input))
      return url.searchParams.get("page") === "2" ? envelope([{ id: 101, student_number: "101", first_name: "Later", last_name: "Student" }], 2) : envelope([{ id: 1, student_number: "001", first_name: "First", last_name: "Student" }], 2)
    })
    mount(<AcademicRecordPage />)
    expect(await screen.findByRole("option", { name: "101 — Later Student" })).toBeInTheDocument()
  })

  it("shows real zero grades with null/empty remarks as graded, and missing grades separately", async () => {
    auth.user.role = "STUDENT"
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (!String(input).includes("academic-record")) return envelope([{ id: 1, student_number: "001", first_name: "Ana", last_name: "Student" }])
      return envelope({ student: { id: 1, student_number: "001", first_name: "Ana", last_name: "Student", year_level: 1, status: "ACTIVE" }, terms: [{ academic_term: { id: 1, semester: "First", academic_year: "2026" }, courses: [null, "" , undefined].map((remarks, index) => ({ enrollment: { id: index + 1 }, course: { course_code: `IT${index}`, course_title: "Technology" }, offering: { section: "A" }, grade: index === 2 ? null : { midterm_grade: 0, final_grade: 0, remarks } })) }] })
    })
    mount(<AcademicRecordPage />)
    expect(await screen.findAllByText("No remarks")).toHaveLength(2)
    expect(screen.getAllByText("0")).toHaveLength(4)
    expect(screen.getAllByText("Not graded")).toHaveLength(1)
  })

  it.each([["STUDENT", /No linked student record/], ["INSTRUCTOR", /No students are available in your assigned classes/], ["STAFF", /No student records are available yet/]])("explains the %s empty directory", async (role, message) => {
    auth.user.role = String(role)
    vi.spyOn(globalThis, "fetch").mockResolvedValue(envelope([]))
    mount(<AcademicRecordPage />)
    expect(await screen.findByText(message)).toBeVisible()
  })

  it("shows unavailable counts and refreshes them without treating failure as zero", async () => {
    auth.user.role = "STUDENT"
    let recovered = false
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      if (!recovered) throw new TypeError("offline")
      return envelope([])
    })
    mount(<DashboardPage />)
    expect(await screen.findAllByText("Unavailable")).toHaveLength(2)
    recovered = true
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }))
    await waitFor(() => expect(screen.getAllByText("0")).toHaveLength(2))
  })
})
