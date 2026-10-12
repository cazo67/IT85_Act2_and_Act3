import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { afterEach, describe, expect, it, vi } from "vitest"
import { GradeDialog, type GradeContext } from "./grade-dialog"
import { OfferingWorkspace } from "./offering-workspace"
import { UsersPage } from "@/features/users/users-page"

const auth = vi.hoisted(() => ({
  user: { id: 1, role: "ADMIN", name: "Admin" },
}))
vi.mock("@/features/auth/auth-context", () => ({ useAuth: () => auth }))
afterEach(() => {
  cleanup()
  auth.user.role = "ADMIN"
})
function mount(node: React.ReactNode) {
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      <MemoryRouter initialEntries={["/test"]}>
        <Routes>
          <Route path="/test" element={node} />
          <Route path="/403" element={<p>Access denied</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}
const context = {
  student: {
    id: 17,
    student_number: "2026-017",
    first_name: "Ana",
    last_name: "Student",
  },
  enrollment: { id: 33, status: "ACTIVE" },
  grade: null,
  course: { course_code: "IT101", course_title: "Introduction" },
  offering: { section: "A" },
  term: { semester: "First", academic_year: "2026-2027" },
} as GradeContext
function success(data: unknown) {
  return new Response(
    JSON.stringify({
      success: true,
      message: "ok",
      data,
      meta: { last_page: 1 },
    })
  )
}

describe("contextual grade actions", () => {
  it("displays identity/course context and creates for the fixed enrollment ID", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(success({ id: 1 }))
    const close = vi.fn()
    mount(<GradeDialog context={context} onClose={close} />)
    expect(
      screen.getByText(/2026-017.*Ana Student.*IT101.*Section A/)
    ).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Midterm grade/), {
      target: { value: "0" },
    })
    fireEvent.change(screen.getByLabelText(/Final grade/), {
      target: { value: "88.25" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Create grade" }))
    await waitFor(() => expect(close).toHaveBeenCalled())
    expect(fetch.mock.calls[0][1]?.method).toBe("POST")
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({
      enrollment_id: 33,
      midterm_grade: 0,
      final_grade: 88.25,
      remarks: null,
    })
  })
  it("updates the existing grade rather than posting another enrollment grade", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () =>
        success({
          id: 99,
          enrollment_id: 33,
          midterm_grade: 70,
          final_grade: 80,
          remarks: null,
        })
      )
    const close = vi.fn()
    mount(
      <GradeDialog
        context={{
          ...context,
          grade: {
            id: 99,
            enrollment_id: 33,
            midterm_grade: 70,
            final_grade: 80,
            remarks: null,
            created_at: "",
            updated_at: "",
          },
        }}
        onClose={close}
      />
    )
    fireEvent.change(await screen.findByLabelText(/Final grade/), {
      target: { value: "91" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))
    await waitFor(() => expect(close).toHaveBeenCalled())
    const patch = fetch.mock.calls.find(
      ([, options]) => options?.method === "PATCH"
    )!
    expect(String(patch[0])).toContain("/grades/99")
    expect(JSON.parse(String(patch[1]?.body))).not.toHaveProperty(
      "enrollment_id"
    )
  })
})

describe("new screen permission boundaries", () => {
  it("does not fetch users for Staff", async () => {
    auth.user.role = "STAFF"
    const fetch = vi.spyOn(globalThis, "fetch")
    mount(<UsersPage />)
    expect(await screen.findByText("Access denied")).toBeVisible()
    expect(fetch).not.toHaveBeenCalled()
  })
  it("does not load class rosters for Student", async () => {
    auth.user.role = "STUDENT"
    const fetch = vi.spyOn(globalThis, "fetch")
    mount(<OfferingWorkspace />)
    expect(await screen.findByText("Access denied")).toBeVisible()
    expect(fetch).not.toHaveBeenCalled()
  })
  it("keeps edit passwords blank and omits an unchanged password from PATCH", async () => {
    const account = {
      id: 2,
      name: "Student",
      email: "student@example.com",
      role: "STUDENT",
      status: "ACTIVE",
    }
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (url, options) =>
        options?.method === "PATCH"
          ? success({ id: 2 })
          : success(String(url).endsWith("/users/2") ? account : [account])
      )
    mount(<UsersPage />)
    fireEvent.click(
      await screen.findByRole("button", { name: /^Edit account / })
    )
    expect(await screen.findByLabelText("New password (optional)")).toHaveValue(
      ""
    )
    expect(screen.getByLabelText(/Email/)).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))
    await waitFor(() =>
      expect(
        fetch.mock.calls.some(([, options]) => options?.method === "PATCH")
      ).toBe(true)
    )
    const patch = fetch.mock.calls.find(
      ([, options]) => options?.method === "PATCH"
    )!
    const payload = JSON.parse(String(patch[1]?.body))
    expect(payload).not.toHaveProperty("password")
    expect(payload).not.toHaveProperty("email")
  })
})
