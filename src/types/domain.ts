export type Role = "ADMIN" | "STAFF" | "INSTRUCTOR" | "STUDENT"
export type Status = "ACTIVE" | "INACTIVE"

export type Timestamped = {
  created_at: string
  updated_at: string
}

export type User = Timestamped & {
  id: number
  name: string
  email: string
  role: Role
  status: Status
}

export type Program = Timestamped & {
  id: number
  code: string
  name: string
  description: string | null
  status: Status
}

export type Student = Timestamped & {
  id: number
  student_number: string
  first_name: string
  middle_name: string | null
  last_name: string
  suffix: string | null
  birth_date: string | null
  email: string | null
  contact_number: string | null
  address: string | null
  program_id: number
  year_level: number
  status: Status
  user_id: number | null
}

export type Course = Timestamped & {
  id: number
  course_code: string
  course_title: string
  description: string | null
  units: number
  status: Status
}

export type AcademicTerm = Timestamped & {
  id: number
  academic_year: string
  semester: string
  start_date: string
  end_date: string
  status: Status
}

export type CourseOffering = Timestamped & {
  id: number
  course_id: number
  academic_term_id: number
  instructor_id: number
  section: string
  schedule: string
  room: string
  capacity: number
  status: Status
}

export type Enrollment = Timestamped & {
  id: number
  student_id: number
  course_offering_id: number
  enrollment_date: string
  status: Status
}

export type Grade = Timestamped & {
  id: number
  enrollment_id: number
  midterm_grade: number
  final_grade: number
  remarks: string | null
}

export type AcademicRecord = {
  student: Student
  terms: Array<{
    academic_term: AcademicTerm
    courses: Array<{
      enrollment: Enrollment
      course: Course
      offering: CourseOffering
      grade: Grade | null
    }>
  }>
}

export type EntityRecord = Record<string, unknown> & { id: number }
