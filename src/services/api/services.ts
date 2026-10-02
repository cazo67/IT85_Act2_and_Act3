import { apiRequest, toQuery } from "./client"
import type { PageQuery } from "@/types/api"
import type {
  AcademicRecord,
  AcademicTerm,
  Course,
  CourseOffering,
  Enrollment,
  Grade,
  Program,
  Student,
  User,
} from "@/types/domain"

type Payload = Record<string, unknown>

export const authService = {
  login: (email: string, password: string) =>
    apiRequest<{ access_token: string; token_type: string; user: User }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) }
    ),
  logout: () => apiRequest<null>("/auth/logout", { method: "POST" }),
  me: () => apiRequest<User>("/auth/me"),
}

export function resourceService<T>(path: string) {
  return {
    list: (query: Record<string, unknown> = {}, signal?: AbortSignal) =>
      apiRequest<T[]>(`${path}${toQuery(query)}`, { signal }),
    get: (id: number, signal?: AbortSignal) =>
      apiRequest<T>(`${path}/${id}`, { signal }),
    create: (payload: Payload) =>
      apiRequest<T>(path, { method: "POST", body: JSON.stringify(payload) }),
    update: (id: number, payload: Payload) =>
      apiRequest<T>(`${path}/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    remove: (id: number) => apiRequest<void>(`${path}/${id}`, { method: "DELETE" }),
  }
}

export const usersService = resourceService<User>("/users")
export const programsService = resourceService<Program>("/programs")
export const studentsService = resourceService<Student>("/students")
export const coursesService = resourceService<Course>("/courses")
export const termsService = resourceService<AcademicTerm>("/academic-terms")
export const offeringsService = resourceService<CourseOffering>("/course-offerings")
export const enrollmentsService = resourceService<Enrollment>("/enrollments")
export const gradesService = resourceService<Grade>("/grades")

export const academicService = {
  record: (studentId: number, signal?: AbortSignal) =>
    apiRequest<AcademicRecord>(`/students/${studentId}/academic-record`, { signal }),
  studentEnrollments: (studentId: number, query: PageQuery, signal?: AbortSignal) =>
    apiRequest<Enrollment[]>(
      `/students/${studentId}/enrollments${toQuery(query)}`,
      { signal }
    ),
  studentGrades: (studentId: number, query: PageQuery, signal?: AbortSignal) =>
    apiRequest<Grade[]>(`/students/${studentId}/grades${toQuery(query)}`, { signal }),
  offeringStudents: (offeringId: number, query: PageQuery, signal?: AbortSignal) =>
    apiRequest<Student[]>(
      `/course-offerings/${offeringId}/students${toQuery(query)}`,
      { signal }
    ),
}
