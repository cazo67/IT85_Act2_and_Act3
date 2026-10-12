import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "react-router-dom"

import {
  Alert,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Table,
} from "@/components/ui/primitives"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/features/auth/auth-context"
import { academicService, studentsService } from "@/services/api/services"
import { listAll } from "@/services/api/query-support"
import { ReferenceSelect } from "@/features/resources/reference-select"
import { positiveInteger } from "@/features/resources/url-state"

export function AcademicRecordPage() {
  const { user } = useAuth()
  const students = useQuery({
    queryKey: ["record-students"],
    queryFn: ({ signal }) => listAll(studentsService.list, signal),
  })
  const [params, setParams] = useSearchParams()
  const requestedId = positiveInteger(params.get("student_id"), 0)
  const selectedId =
    requestedId > 0
      ? requestedId
      : user?.role === "STUDENT"
        ? (students.data?.data[0]?.id ?? null)
        : null
  const record = useQuery({
    queryKey: ["academic-record", selectedId],
    queryFn: ({ signal }) => academicService.record(selectedId!, signal),
    enabled: Boolean(selectedId),
  })
  const options = students.data?.data ?? []
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">Academic history</p>
        <h1 className="text-2xl font-semibold">Academic Record</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Courses and grades grouped by academic term.
        </p>
        <Button
          className="mt-3"
          variant="outline"
          disabled={students.isFetching || record.isFetching}
          onClick={() => {
            void students.refetch()
            if (selectedId) void record.refetch()
          }}
        >
          Refresh
        </Button>
      </header>
      {students.isError ? (
        <Alert tone="danger">
          Could not load the students available to your role.{" "}
          <Button
            variant="outline"
            className="ml-2"
            onClick={() => students.refetch()}
          >
            Retry
          </Button>
        </Alert>
      ) : null}
      {students.isSuccess && options.length === 0 ? (
        <Alert>
          {user?.role === "STUDENT"
            ? "No linked student record is available for this account. Contact the registrar for help."
            : user?.role === "INSTRUCTOR"
              ? "No students are available in your assigned classes."
              : "No student records are available yet."}
        </Alert>
      ) : null}
      {user?.role !== "STUDENT" ? (
        <Card className="max-w-xl p-4">
          <label
            className="mb-2 block text-sm font-medium"
            htmlFor="record-student"
          >
            Student
          </label>
          <ReferenceSelect
            label="Student"
            id="record-student"
            disabled={students.isPending || students.isError}
            value={selectedId ?? ""}
            onChange={(event) =>
              setParams((current) => {
                if (event.target.value)
                  current.set("student_id", event.target.value)
                else current.delete("student_id")
                return current
              })
            }
            options={options.map((student) => ({
              id: student.id,
              label: `${student.student_number} — ${student.first_name} ${student.last_name}`,
            }))}
          />
        </Card>
      ) : null}
      {students.isSuccess && options.length > 0 && !selectedId ? (
        <p role="status" className="text-sm text-muted-foreground">
          Select a student to view their academic history.
        </p>
      ) : null}
      {students.isLoading || record.isLoading ? (
        <Card className="space-y-3 p-5">
          <Skeleton className="h-20" />
          <Skeleton className="h-40" />
        </Card>
      ) : null}
      {record.isError ? (
        <Alert tone="danger">
          {record.error instanceof Error
            ? record.error.message
            : "Could not load the academic record."}
          <Button
            className="ml-2"
            variant="outline"
            onClick={() => record.refetch()}
          >
            Retry
          </Button>
        </Alert>
      ) : null}
      {record.data && !record.isError ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>
                {record.data.data.student.first_name}{" "}
                {record.data.data.student.last_name}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3 text-sm">
              <Badge>{record.data.data.student.student_number}</Badge>
              <Badge tone="muted">
                Year {record.data.data.student.year_level}
              </Badge>
              <Badge
                tone={
                  record.data.data.student.status === "ACTIVE"
                    ? "success"
                    : "muted"
                }
              >
                {record.data.data.student.status}
              </Badge>
            </CardContent>
          </Card>
          {record.data.data.terms.length === 0 ? (
            <Card className="p-10 text-center">
              <h2 className="font-medium">No academic history yet</h2>
              <p className="text-sm text-muted-foreground">
                This student has no enrollments grouped into an academic term.
              </p>
            </Card>
          ) : (
            record.data.data.terms.map((term) => (
              <Card key={term.academic_term.id} className="overflow-hidden">
                <CardHeader>
                  <CardTitle>
                    {term.academic_term.semester} ·{" "}
                    {term.academic_term.academic_year}
                  </CardTitle>
                </CardHeader>
                <div
                  className="overflow-x-auto"
                  role="region"
                  aria-label={`Academic record ${term.academic_term.semester} ${term.academic_term.academic_year}`}
                  tabIndex={0}
                >
                  <Table>
                    <thead className="bg-muted/50 text-left">
                      <tr>
                        <th className="px-4 py-3">Course</th>
                        <th className="px-4 py-3">Section</th>
                        <th className="px-4 py-3">Units</th>
                        <th className="px-4 py-3">Enrollment</th>
                        <th className="px-4 py-3">Schedule / Room</th>
                        <th className="px-4 py-3">Midterm</th>
                        <th className="px-4 py-3">Final</th>
                        <th className="px-4 py-3">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {term.courses.map((item) => (
                        <tr className="border-t" key={item.enrollment.id}>
                          <td className="px-4 py-3">
                            <strong>{item.course.course_code}</strong>
                            <br />
                            <span className="text-muted-foreground">
                              {item.course.course_title}
                            </span>
                          </td>
                          <td className="px-4 py-3">{item.offering.section}</td>
                          <td className="px-4 py-3">
                            {item.course.units ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              tone={
                                item.enrollment.status === "ACTIVE"
                                  ? "success"
                                  : "muted"
                              }
                            >
                              {item.enrollment.status ?? "Unavailable"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            {item.offering.schedule || "No schedule"}
                            <br />
                            {item.offering.room
                              ? `Room ${item.offering.room}`
                              : "No room assigned"}
                          </td>
                          <td className="px-4 py-3">
                            {item.grade?.midterm_grade ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            {item.grade?.final_grade ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            {item.grade
                              ? item.grade.remarks?.trim() || "No remarks"
                              : "Not graded"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </Card>
            ))
          )}
        </>
      ) : null}
    </div>
  )
}
