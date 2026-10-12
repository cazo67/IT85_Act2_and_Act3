import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Alert,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Field,
  Input,
} from "@/components/ui/primitives"
import { gradesService } from "@/services/api/services"
import { invalidateResource } from "@/services/api/query-support"
import type { Course, CourseOffering, AcademicTerm } from "@/types/domain"
import type { RosterEntry } from "@/services/api/workspaces"
import {
  ProtectedDialog,
  useFormProtection,
} from "@/components/ui/protected-dialog"
import { useServerErrors } from "@/components/ui/use-server-errors"

export type GradeContext = RosterEntry & {
  course: Course
  offering: CourseOffering
  term: AcademicTerm
}

function GradeForm({
  context,
  onClose,
}: {
  context: GradeContext
  onClose: () => void
}) {
  const { student, enrollment, grade, course, offering, term } = context
  const [midterm, setMidterm] = React.useState(
    grade ? String(grade.midterm_grade) : ""
  )
  const [final, setFinal] = React.useState(
    grade ? String(grade.final_grade) : ""
  )
  const [remarks, setRemarks] = React.useState(grade?.remarks ?? "")
  const client = useQueryClient()
  const saving = React.useRef(false)
  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        midterm_grade: Number(midterm),
        final_grade: Number(final),
        remarks: remarks.trim() || null,
      }
      return grade
        ? gradesService.update(grade.id, payload)
        : gradesService.create({ ...payload, enrollment_id: enrollment.id })
    },
    onSuccess: async (response) => {
      await invalidateResource(client, "grades")
      toast.success(response.message)
      onClose()
    },
    onSettled: () => {
      saving.current = false
    },
  })
  useFormProtection(
    midterm !== (grade ? String(grade.midterm_grade) : "") ||
      final !== (grade ? String(grade.final_grade) : "") ||
      remarks !== (grade?.remarks ?? ""),
    mutation.isPending
  )
  const { formRef, errors } = useServerErrors(mutation.error)
  return (
    <DialogContent>
      <DialogTitle>{grade ? "Edit grade" : "Create grade"}</DialogTitle>
      <DialogDescription>
        {student.student_number} — {student.first_name} {student.last_name}.{" "}
        {course.course_code} — {course.course_title}, Section {offering.section}
        , {term.semester} {term.academic_year}. Enrollment #{enrollment.id} (
        {enrollment.status}).
      </DialogDescription>
      <form
        ref={formRef}
        className="mt-5 grid gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (saving.current) return
          saving.current = true
          mutation.mutate()
        }}
      >
        <fieldset disabled={mutation.isPending} className="contents">
          <Field
            label="Midterm grade"
            required
            error={errors.midterm_grade?.[0]}
          >
            <Input
              type="number"
              required
              min={0}
              max={100}
              step={0.01}
              value={midterm}
              onChange={(event) => setMidterm(event.target.value)}
            />
          </Field>
          <Field label="Final grade" required error={errors.final_grade?.[0]}>
            <Input
              type="number"
              required
              min={0}
              max={100}
              step={0.01}
              value={final}
              onChange={(event) => setFinal(event.target.value)}
            />
          </Field>
          <Field label="Remarks" error={errors.remarks?.[0]}>
            <Input
              maxLength={100}
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
            />
          </Field>
          {mutation.isError ? (
            <Alert tone="danger">{mutation.error.message}</Alert>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                disabled={mutation.isPending}
              >
                Cancel
              </Button>
            </DialogClose>
            <Button disabled={mutation.isPending}>
              {mutation.isPending
                ? "Saving..."
                : grade
                  ? "Save changes"
                  : "Create grade"}
            </Button>
          </div>
        </fieldset>
      </form>
    </DialogContent>
  )
}

export function GradeDialog(props: {
  context: GradeContext
  onClose: () => void
}) {
  const grade = props.context.grade
  const detail = useQuery({
    queryKey: ["grade-editor", grade?.id],
    queryFn: ({ signal }) => gradesService.get(grade!.id, signal),
    enabled: Boolean(grade),
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  })
  return (
    <ProtectedDialog open onClose={props.onClose}>
      {grade && (detail.isPending || detail.isError) ? (
        <DialogContent>
          <DialogTitle>Edit grade</DialogTitle>
          <DialogDescription>
            Load the current grade before editing.
          </DialogDescription>
          {detail.isError ? (
            <Alert tone="danger">
              {detail.error.message}
              <Button variant="outline" onClick={() => detail.refetch()}>
                Retry current grade
              </Button>
            </Alert>
          ) : (
            <p role="status">Loading current grade...</p>
          )}
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
        </DialogContent>
      ) : (
        <GradeForm
          {...props}
          context={{
            ...props.context,
            grade: grade ? detail.data!.data : null,
          }}
        />
      )}
    </ProtectedDialog>
  )
}
