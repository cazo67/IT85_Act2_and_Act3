import {
  coursesService,
  enrollmentsService,
  gradesService,
  offeringsService,
  programsService,
  studentsService,
  termsService,
} from "@/services/api/services"
import type { Role } from "@/types/domain"
import type { ApiSuccess } from "@/types/api"

type ResourceService = {
  list: (query?: Record<string, unknown>, signal?: AbortSignal) => Promise<ApiSuccess<unknown[]>>
  get: (id: number, signal?: AbortSignal) => Promise<ApiSuccess<unknown>>
  create: (payload: Record<string, unknown>) => Promise<ApiSuccess<unknown>>
  update: (id: number, payload: Record<string, unknown>) => Promise<ApiSuccess<unknown>>
  remove: (id: number) => Promise<ApiSuccess<void>>
}

export type FieldDefinition = {
  key: string
  label: string
  type?: "text" | "email" | "number" | "date" | "textarea" | "status" | "year" | "reference"
  required?: boolean
  createOnly?: boolean
  reference?: "programs" | "courses" | "terms" | "users" | "students" | "offerings" | "enrollments" | "instructors" | "studentAccounts"
  min?: number
  max?: number
  step?: number
}

export type ColumnDefinition = {
  key: string
  label: string
  reference?: FieldDefinition["reference"]
}

export type ResourceDefinition = {
  key: string
  title: string
  description: string
  singular: string
  service: ResourceService
  columns: ColumnDefinition[]
  fields: FieldDefinition[]
  managers: Role[]
  deleters: Role[]
  supportsStudentFilters?: boolean
  notes?: string
}

const status: FieldDefinition = { key: "status", label: "Status", type: "status", required: true }

export const resources: Record<string, ResourceDefinition> = {
  students: {
    key: "students",
    title: "Students",
    singular: "student",
    description: "Search, review, and manage student records from the REST API.",
    service: studentsService,
    managers: ["ADMIN", "STAFF"],
    deleters: ["ADMIN"],
    supportsStudentFilters: true,
    columns: [
      { key: "student_number", label: "Student no." },
      { key: "full_name", label: "Name" },
      { key: "program_id", label: "Program", reference: "programs" },
      { key: "year_level", label: "Year" },
      { key: "status", label: "Status" },
    ],
    fields: [
      { key: "student_number", label: "Student number", required: true, createOnly: true },
      { key: "first_name", label: "First name", required: true },
      { key: "middle_name", label: "Middle name" },
      { key: "last_name", label: "Last name", required: true },
      { key: "suffix", label: "Suffix" },
      { key: "birth_date", label: "Birth date", type: "date" },
      { key: "email", label: "Email", type: "email" },
      { key: "contact_number", label: "Contact number" },
      { key: "address", label: "Address", type: "textarea" },
      { key: "program_id", label: "Program", type: "reference", reference: "programs", required: true },
      { key: "year_level", label: "Year level", type: "year", required: true },
      status,
      { key: "user_id", label: "Linked student user ID", type: "number" },
    ],
    notes: "Account linking is optional. Administrators can select a student account by name. Staff may enter a verified student user ID supplied by an administrator.",
  },
  programs: {
    key: "programs", title: "Programs", singular: "program", description: "Academic programs available to students.", service: programsService,
    managers: ["ADMIN", "STAFF"], deleters: ["ADMIN"],
    columns: [{ key: "code", label: "Code" }, { key: "name", label: "Program" }, { key: "status", label: "Status" }],
    fields: [{ key: "code", label: "Program code", required: true }, { key: "name", label: "Program name", required: true }, { key: "description", label: "Description", type: "textarea" }, status],
  },
  courses: {
    key: "courses", title: "Courses", singular: "course", description: "Course catalog and unit information.", service: coursesService,
    managers: ["ADMIN", "STAFF"], deleters: ["ADMIN"],
    columns: [{ key: "course_code", label: "Code" }, { key: "course_title", label: "Title" }, { key: "units", label: "Units" }, { key: "status", label: "Status" }],
    fields: [{ key: "course_code", label: "Course code", required: true }, { key: "course_title", label: "Course title", required: true }, { key: "description", label: "Description", type: "textarea" }, { key: "units", label: "Units", type: "number", min: 0.5, max: 12, step: 0.5, required: true }, status],
  },
  "academic-terms": {
    key: "academic-terms", title: "Academic Terms", singular: "academic term", description: "Academic years, semesters, and active date ranges.", service: termsService,
    managers: ["ADMIN", "STAFF"], deleters: ["ADMIN"],
    columns: [{ key: "academic_year", label: "Academic year" }, { key: "semester", label: "Semester" }, { key: "date_range", label: "Dates" }, { key: "status", label: "Status" }],
    fields: [{ key: "academic_year", label: "Academic year", required: true }, { key: "semester", label: "Semester", required: true }, { key: "start_date", label: "Start date", type: "date", required: true }, { key: "end_date", label: "End date", type: "date", required: true }, status],
  },
  "course-offerings": {
    key: "course-offerings", title: "Course Offerings", singular: "course offering", description: "Scheduled classes, instructors, rooms, and capacity.", service: offeringsService,
    managers: ["ADMIN", "STAFF"], deleters: ["ADMIN"],
    columns: [{ key: "course_id", label: "Course", reference: "courses" }, { key: "section", label: "Section" }, { key: "academic_term_id", label: "Term", reference: "terms" }, { key: "schedule", label: "Schedule" }, { key: "capacity", label: "Capacity" }, { key: "status", label: "Status" }],
    fields: [{ key: "course_id", label: "Course", type: "reference", reference: "courses", required: true }, { key: "academic_term_id", label: "Academic term", type: "reference", reference: "terms", required: true }, { key: "instructor_id", label: "Instructor", type: "reference", reference: "instructors", required: true }, { key: "section", label: "Section", required: true }, { key: "schedule", label: "Schedule", required: true }, { key: "room", label: "Room", required: true }, { key: "capacity", label: "Capacity", type: "number", min: 1, max: 500, required: true }, status],
  },
  enrollments: {
    key: "enrollments", title: "Enrollments", singular: "enrollment", description: "Student registration in scheduled course offerings.", service: enrollmentsService,
    managers: ["ADMIN", "STAFF"], deleters: ["ADMIN", "STAFF"],
    columns: [{ key: "student_id", label: "Student", reference: "students" }, { key: "course_offering_id", label: "Offering", reference: "offerings" }, { key: "enrollment_date", label: "Date" }, { key: "status", label: "Status" }],
    fields: [{ key: "student_id", label: "Student", type: "reference", reference: "students", required: true, createOnly: true }, { key: "course_offering_id", label: "Course offering", type: "reference", reference: "offerings", required: true, createOnly: true }, { key: "enrollment_date", label: "Enrollment date", type: "date", createOnly: true }, status],
  },
  grades: {
    key: "grades", title: "Grades", singular: "grade", description: "Authorized midterm and final grade entry.", service: gradesService,
    managers: ["ADMIN", "STAFF", "INSTRUCTOR"], deleters: [],
    columns: [{ key: "enrollment_id", label: "Enrollment", reference: "enrollments" }, { key: "midterm_grade", label: "Midterm" }, { key: "final_grade", label: "Final" }, { key: "remarks", label: "Remarks" }],
    fields: [{ key: "enrollment_id", label: "Enrollment", type: "reference", reference: "enrollments", required: true, createOnly: true }, { key: "midterm_grade", label: "Midterm grade", type: "number", min: 0, max: 100, step: 0.01, required: true }, { key: "final_grade", label: "Final grade", type: "number", min: 0, max: 100, step: 0.01, required: true }, { key: "remarks", label: "Remarks" }],
  },
}
