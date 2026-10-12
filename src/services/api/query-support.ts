import type { QueryClient } from "@tanstack/react-query"
import type { ApiSuccess, PageQuery } from "@/types/api"

// Publish a lookup only after every authorized page has loaded successfully.
export async function listAll<T>(
  list: (query: PageQuery, signal?: AbortSignal) => Promise<ApiSuccess<T[]>>,
  signal?: AbortSignal,
): Promise<ApiSuccess<T[]>> {
  const data: T[] = []
  let page = 1
  while (true) {
    signal?.throwIfAborted()
    const response = await list({ page, per_page: 100 }, signal)
    data.push(...response.data)
    if (page >= (response.meta?.last_page ?? 1)) {
      return { success: true, message: response.message, data }
    }
    page += 1
  }
}

const dependencies: Record<string, string[]> = {
  users: ["users", "studentAccounts", "instructors", "students", "course-offerings"],
  students: ["students", "enrollments", "grades", "course-offerings"],
  programs: ["programs"],
  courses: ["courses"],
  "academic-terms": ["academic-terms"],
  "course-offerings": ["course-offerings", "students", "enrollments", "grades"],
  enrollments: ["enrollments", "course-offerings", "students", "grades"],
  grades: ["grades"],
}
const aliases: Record<string, string> = {
  "academic-terms": "terms",
  "course-offerings": "offerings",
}

export function invalidateResource(client: QueryClient, resource: string) {
  const resources = dependencies[resource] ?? [resource]
  const names = new Set(resources.flatMap((key) => [key, aliases[key] ?? key]))
  return client.invalidateQueries({
    predicate: ({ queryKey }) =>
      names.has(String(queryKey[0])) ||
      (["lookup", "dashboard"].includes(String(queryKey[0])) && names.has(String(queryKey[1]))) ||
      queryKey[0] === "academic-record" ||
      queryKey[0] === "offering-workspace" ||
      queryKey[0] === "student-workspace" ||
      (names.has("students") && queryKey[0] === "record-students"),
  })
}
