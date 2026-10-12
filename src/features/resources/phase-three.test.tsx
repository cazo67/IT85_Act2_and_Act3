import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ResourcePage } from "./resource-page"
import { resources } from "./resource-definitions"
import { positiveInteger, useStudentSearch } from "./url-state"
import { AcademicRecordPage } from "@/features/academic-record/academic-record-page"

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => ({ user: { id: 1, role: "ADMIN" } }),
}))
afterEach(cleanup)
function envelope(data: unknown) {
  return new Response(
    JSON.stringify({
      success: true,
      message: "ok",
      data,
      meta: {
        page: 1,
        last_page: 1,
        total: Array.isArray(data) ? data.length : 1,
      },
    })
  )
}
function mount(node: React.ReactNode, url = "/programs") {
  return render(
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
      <MemoryRouter initialEntries={[url]}>{node}</MemoryRouter>
    </QueryClientProvider>
  )
}
const program = {
  id: 1,
  code: "IT",
  name: "Technology",
  description: "",
  status: "ACTIVE",
}

describe("safe URL state", () => {
  it.each(["NaN", "-2", "0", "1.5", "Infinity", "9007199254740992", "hello"])(
    "defaults malformed number %s",
    (value) => expect(positiveInteger(value, 20)).toBe(20)
  )
  it("bounds valid page size without changing safe page numbers", () => {
    expect(positiveInteger("200", 20, 100)).toBe(100)
    expect(positiveInteger("101", 1)).toBe(101)
  })
  it("restores search on back and forward without writing an old draft", async () => {
    function Search() {
      const [value, change] = useStudentSearch()
      const location = useLocation()
      const navigate = useNavigate()
      return (
        <>
          <input
            aria-label="Search"
            value={value}
            onChange={(event) => change(event.target.value)}
          />
          <p>{location.search}</p>
          <button onClick={() => navigate(-1)}>Back</button>
          <button onClick={() => navigate(1)}>Forward</button>
        </>
      )
    }
    mount(<Search />, "/students?search=Ana")
    fireEvent.change(screen.getByLabelText("Search"), {
      target: { value: "Ben" },
    })
    await waitFor(() => expect(screen.getByText(/search=Ben/)).toBeVisible())
    fireEvent.click(screen.getByText("Back"))
    await waitFor(() =>
      expect(screen.getByLabelText("Search")).toHaveValue("Ana")
    )
    fireEvent.click(screen.getByText("Forward"))
    await waitFor(() =>
      expect(screen.getByLabelText("Search")).toHaveValue("Ben")
    )
  })
})

describe("editor and mutation recovery", () => {
  it("fetches current detail and recovers from a deleted/unavailable record", async () => {
    let recovered = false
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (String(url).endsWith("/programs/1"))
        return recovered
          ? envelope({ ...program, name: "Current name" })
          : new Response(JSON.stringify({ message: "Not found" }), {
              status: 404,
            })
      return envelope([program])
    })
    mount(<ResourcePage definition={resources.programs} />)
    fireEvent.click(
      await screen.findByRole("button", { name: /^Edit program/ })
    )
    expect(
      await screen.findByText(/Could not load the current record/)
    ).toBeVisible()
    expect(
      screen.queryByRole("button", { name: "Save changes" })
    ).not.toBeInTheDocument()
    recovered = true
    fireEvent.click(
      screen.getByRole("button", { name: "Retry current record" })
    )
    expect(await screen.findByLabelText(/name/i)).toHaveValue("Current name")
  })
  it("focuses associated server errors and retains typed input for retry", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, options) =>
      options?.method === "POST"
        ? new Response(
            JSON.stringify({
              message: "Invalid",
              errors: { code: ["Already in use"] },
            }),
            { status: 422 }
          )
        : envelope([])
    )
    mount(<ResourcePage definition={resources.programs} />)
    fireEvent.click(screen.getByRole("button", { name: "Create program" }))
    const dialog = within(screen.getByRole("dialog"))
    fireEvent.change(dialog.getByLabelText(/code/i), {
      target: { value: "DUP" },
    })
    fireEvent.change(dialog.getByLabelText(/name/i), {
      target: { value: "Kept draft" },
    })
    fireEvent.click(dialog.getByRole("button", { name: "Create program" }))
    await waitFor(() => expect(dialog.getByLabelText(/code/i)).toHaveFocus())
    expect(dialog.getByLabelText(/code/i)).toHaveAccessibleDescription(
      "Already in use"
    )
    expect(dialog.getByLabelText(/name/i)).toHaveValue("Kept draft")
  })
  it("identifies the confirmed row, cancels without mutation and locks pending duplicates", async () => {
    let resolve: (value: Response) => void = () => {}
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (_url, options) =>
        options?.method === "DELETE"
          ? new Promise<Response>((done) => {
              resolve = done
            })
          : envelope([program])
      )
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
    mount(<ResourcePage definition={resources.programs} />)
    const button = await screen.findByRole("button", {
      name: /^Delete program/,
    })
    fireEvent.click(button)
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("IT (#1)"))
    expect(
      fetch.mock.calls.some(([, options]) => options?.method === "DELETE")
    ).toBe(false)
    confirm.mockReturnValue(true)
    fireEvent.click(button)
    fireEvent.click(button)
    await waitFor(() => expect(button).toBeDisabled())
    expect(
      fetch.mock.calls.filter(([, options]) => options?.method === "DELETE")
    ).toHaveLength(1)
    resolve(envelope(null))
    await waitFor(() => expect(button).toBeEnabled())
  })
  it("uses safe numeric defaults in outgoing list queries", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(envelope([]))
    mount(
      <ResourcePage definition={resources.programs} />,
      "/programs?page=bad&per_page=1.5"
    )
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    const url = new URL(String(fetch.mock.calls[0][0]))
    expect(url.searchParams.get("page")).toBe("1")
    expect(url.searchParams.get("per_page")).toBe("20")
  })
})

it("presents inactive academic enrollment, units and schedule without invented grade policy", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url) =>
    String(url).includes("academic-record")
      ? envelope({
          student: {
            id: 1,
            first_name: "Ana",
            last_name: "Student",
            student_number: "001",
            year_level: 1,
            status: "ACTIVE",
          },
          terms: [
            {
              academic_term: {
                id: 1,
                semester: "First",
                academic_year: "2026",
              },
              courses: [
                {
                  enrollment: { id: 1, status: "INACTIVE" },
                  course: {
                    course_code: "IT101",
                    course_title: "Technology",
                    units: 3,
                  },
                  offering: { section: "A", schedule: "Mon 9am", room: "101" },
                  grade: null,
                },
              ],
            },
          ],
        })
      : envelope([{ id: 1, first_name: "Ana", last_name: "Student" }])
  )
  mount(<AcademicRecordPage />, "/academic-record?student_id=1")
  expect(await screen.findByText("INACTIVE")).toBeVisible()
  expect(screen.getByRole("cell", { name: /Mon 9am.*Room 101/ })).toBeVisible()
  expect(screen.getByRole("columnheader", { name: "Units" })).toBeVisible()
  expect(screen.getByText("3")).toBeVisible()
  expect(screen.getByText("Not graded")).toBeVisible()
})
