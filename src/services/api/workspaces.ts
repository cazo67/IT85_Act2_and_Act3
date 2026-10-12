import { academicService, coursesService, enrollmentsService, gradesService, offeringsService, termsService } from "./services"
import { listAll } from "./query-support"
import type { Enrollment, Grade, Student } from "@/types/domain"

export type RosterEntry = { student: Student; enrollment: Enrollment; grade: Grade | null }

export async function loadOfferingWorkspace(id: number, signal?: AbortSignal) {
  // Authorize the offering first; never assemble a roster for a denied class.
  const { data: offering } = await offeringsService.get(id, signal)
  const [course, term, students, enrollments, grades] = await Promise.all([
    coursesService.get(offering.course_id, signal),
    termsService.get(offering.academic_term_id, signal),
    listAll((query, abort) => academicService.offeringStudents(id, query, abort), signal),
    listAll(enrollmentsService.list, signal),
    listAll(gradesService.list, signal),
  ])
  const studentMap = new Map(students.data.map((student) => [student.id, student]))
  const gradeMap = new Map(grades.data.map((grade) => [grade.enrollment_id, grade]))
  const roster: RosterEntry[] = enrollments.data.filter((item) => item.course_offering_id === id).map((enrollment) => {
    const student = studentMap.get(enrollment.student_id)
    if (!student) throw new Error("The class roster changed while loading. Refresh before entering grades.")
    return { student, enrollment, grade: gradeMap.get(enrollment.id) ?? null }
  })
  return { offering, course: course.data, term: term.data, roster }
}
