import { useQuery } from "@tanstack/react-query"
import { Link, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Alert, Badge, Card, Skeleton, Table } from "@/components/ui/primitives"
import { useAuth } from "@/features/auth/auth-context"
import { academicService } from "@/services/api/services"

export function StudentWorkspace() {
  const id = Number(useParams().studentId)
  const { user } = useAuth()
  const valid = Number.isInteger(id) && id > 0
  const record = useQuery({
    queryKey: ["student-workspace", id],
    queryFn: ({ signal }) => academicService.record(id, signal),
    enabled: valid,
  })
  if (!valid) return <Alert tone="danger">Invalid student identifier.</Alert>
  if (record.isPending) return <Skeleton className="h-48" />
  if (record.isError)
    return (
      <Alert tone="danger">
        {record.error.message}
        <Button
          className="ml-3"
          variant="outline"
          onClick={() => record.refetch()}
        >
          Retry
        </Button>
      </Alert>
    )
  const { student, terms } = record.data.data
  const registrar = user?.role === "ADMIN" || user?.role === "STAFF"
  return (
    <div className="space-y-6">
      <header>
        <Button asChild variant="outline">
          <Link to="/students">Back to students</Link>
        </Button>
        <h1 className="mt-4 text-2xl font-semibold">Student workspace</h1>
        <p>
          {student.student_number} — {student.first_name} {student.last_name}
        </p>
        <p className="text-sm text-muted-foreground">
          Year {student.year_level} · {student.email || "No contact email"}
        </p>
        <Badge>{student.status}</Badge>
      </header>
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link to={`/academic-record?student_id=${id}`}>
            View academic record
          </Link>
        </Button>
        {registrar ? (
          <Button asChild>
            <Link to={`/enrollments?create=1&student_id=${id}`}>
              Enroll in a class
            </Link>
          </Button>
        ) : null}
        <Button
          variant="outline"
          disabled={record.isFetching}
          onClick={() => record.refetch()}
        >
          Refresh
        </Button>
      </div>
      {terms.length === 0 ? (
        <Card className="p-6">No enrollments yet.</Card>
      ) : (
        terms.map(({ academic_term: term, courses }) => (
          <Card key={term.id} className="overflow-hidden">
            <h2 className="p-4 font-semibold">
              {term.semester} {term.academic_year}
            </h2>
            <div
              className="overflow-x-auto"
              role="region"
              aria-label={`Student courses ${term.semester} ${term.academic_year}`}
              tabIndex={0}
            >
              <Table>
                <thead>
                  <tr>
                    {["Course / Section", "Enrollment", "Midterm", "Final"].map(
                      (label) => (
                        <th key={label} className="p-3 text-left">
                          {label}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {courses.map(({ enrollment, course, offering, grade }) => (
                    <tr key={enrollment.id} className="border-t">
                      <td className="p-3">
                        {user?.role !== "STUDENT" ? (
                          <Link
                            className="underline"
                            to={`/course-offerings/${offering.id}`}
                          >
                            {course.course_code} — {course.course_title} /{" "}
                            {offering.section}
                          </Link>
                        ) : (
                          `${course.course_code} — ${course.course_title} / ${offering.section}`
                        )}
                      </td>
                      <td className="p-3">
                        <Badge>{enrollment.status}</Badge>
                      </td>
                      <td className="p-3">
                        {grade?.midterm_grade ?? "Not graded"}
                      </td>
                      <td className="p-3">
                        {grade?.final_grade ?? "Not graded"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card>
        ))
      )}
    </div>
  )
}
