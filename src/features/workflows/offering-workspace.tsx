import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, Navigate, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
  Alert,
  Badge,
  Card,
  Input,
  Skeleton,
  Table,
} from "@/components/ui/primitives"
import { useAuth } from "@/features/auth/auth-context"
import { loadOfferingWorkspace } from "@/services/api/workspaces"
import { instructorsService } from "@/services/api/services"
import { listAll } from "@/services/api/query-support"
import { GradeDialog, type GradeContext } from "./grade-dialog"

export function OfferingWorkspace() {
  const { user } = useAuth()
  const id = Number(useParams().offeringId)
  const allowed = Boolean(
    user && ["ADMIN", "STAFF", "INSTRUCTOR"].includes(user.role)
  )
  const valid = Number.isInteger(id) && id > 0
  const workspace = useQuery({
    queryKey: ["offering-workspace", id],
    queryFn: ({ signal }) => loadOfferingWorkspace(id, signal),
    enabled: allowed && valid,
  })
  const directory = useQuery({
    queryKey: ["lookup", "instructors"],
    queryFn: ({ signal }) => listAll(instructorsService.list, signal),
    enabled: allowed && user?.role !== "INSTRUCTOR",
  })
  const [search, setSearch] = React.useState("")
  const [grading, setGrading] = React.useState<GradeContext | null>(null)
  if (!allowed) return <Navigate to="/403" replace />
  if (!valid) return <Alert tone="danger">Invalid class identifier.</Alert>
  if (workspace.isPending) return <Skeleton className="h-48" />
  if (workspace.isError)
    return (
      <Alert tone="danger">
        {workspace.error.message}
        <Button
          className="ml-3"
          variant="outline"
          onClick={() => workspace.refetch()}
        >
          Retry
        </Button>
      </Alert>
    )
  const { offering, course, term, roster } = workspace.data
  const instructor =
    user?.role === "INSTRUCTOR"
      ? user.name
      : directory.data?.data.find((item) => item.id === offering.instructor_id)
          ?.name
  const rows = roster.filter(({ student }) =>
    `${student.student_number} ${student.first_name} ${student.last_name}`
      .toLowerCase()
      .includes(search.toLowerCase())
  )
  return (
    <div className="space-y-6">
      <header>
        <Button asChild variant="outline">
          <Link to="/course-offerings">Back to classes</Link>
        </Button>
        <h1 className="mt-4 text-2xl font-semibold">Class roster</h1>
        <p className="mt-1">
          {course.course_code} — {course.course_title} · Section{" "}
          {offering.section}
        </p>
        <p className="text-sm text-muted-foreground">
          {term.semester} {term.academic_year} · {offering.schedule} · Room{" "}
          {offering.room}
        </p>
        <p className="text-sm">
          Instructor: {instructor ?? `#${offering.instructor_id}`} ·{" "}
          {roster.filter((row) => row.enrollment.status === "ACTIVE").length}/
          {offering.capacity} active enrollments
        </p>
        <Badge>{offering.status}</Badge>
      </header>
      {directory.isError ? (
        <Alert tone="danger">
          Instructor name could not be loaded.{" "}
          <Button variant="outline" onClick={() => directory.refetch()}>
            Retry instructor name
          </Button>
        </Alert>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Input
          className="max-w-md"
          aria-label="Search roster"
          placeholder="Search student number or name"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Button
          variant="outline"
          disabled={workspace.isFetching}
          onClick={() => workspace.refetch()}
        >
          Refresh
        </Button>
        {user?.role !== "INSTRUCTOR" ? (
          <Button asChild>
            <Link to={`/enrollments?create=1&course_offering_id=${id}`}>
              Enroll a student
            </Link>
          </Button>
        ) : null}
      </div>
      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <p className="p-6">
            {roster.length
              ? "No students match your search."
              : "No students enrolled in this class yet."}
          </p>
        ) : (
          <div
            className="overflow-x-auto"
            role="region"
            aria-label="Class roster table"
            tabIndex={0}
          >
            <Table>
              <thead>
                <tr>
                  {[
                    "Student",
                    "Enrollment",
                    "Midterm",
                    "Final",
                    "Grade entry",
                  ].map((name) => (
                    <th className="p-3 text-left" key={name}>
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr className="border-t" key={row.enrollment.id}>
                    <td className="p-3">
                      <Link
                        className="underline"
                        to={`/students/${row.student.id}`}
                      >
                        {row.student.student_number} — {row.student.first_name}{" "}
                        {row.student.last_name}
                      </Link>
                    </td>
                    <td className="p-3">
                      <Badge>{row.enrollment.status}</Badge>
                    </td>
                    <td className="p-3">
                      {row.grade?.midterm_grade ?? "Not graded"}
                    </td>
                    <td className="p-3">
                      {row.grade?.final_grade ?? "Not graded"}
                    </td>
                    <td className="p-3">
                      <Button
                        aria-label={`${row.grade ? "Edit grade" : "Create grade"} for ${row.student.student_number} ${row.student.first_name} ${row.student.last_name}`}
                        onClick={() =>
                          setGrading({ ...row, offering, course, term })
                        }
                      >
                        {row.grade ? "Edit grade" : "Create grade"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Card>
      {grading ? (
        <GradeDialog
          key={grading.enrollment.id}
          context={grading}
          onClose={() => setGrading(null)}
        />
      ) : null}
    </div>
  )
}
