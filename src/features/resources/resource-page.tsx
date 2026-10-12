import * as React from "react"
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { toast } from "sonner"
import { Link, useSearchParams } from "react-router-dom"

import { Button } from "@/components/ui/button"
import {
  Alert,
  Badge,
  Card,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Field,
  Input,
  Select,
  Skeleton,
  Table,
  Textarea,
} from "@/components/ui/primitives"
import { useAuth } from "@/features/auth/auth-context"
import {
  coursesService,
  enrollmentsService,
  offeringsService,
  programsService,
  studentsService,
  termsService,
  usersService,
  instructorsService,
} from "@/services/api/services"
import { ApiError } from "@/types/api"
import type {
  FieldDefinition,
  ResourceDefinition,
} from "./resource-definitions"
import { invalidateResource, listAll } from "@/services/api/query-support"
import { ReferenceSelect } from "./reference-select"
import {
  ProtectedDialog,
  useFormProtection,
} from "@/components/ui/protected-dialog"
import { positiveInteger, useStudentSearch } from "./url-state"

type Row = Record<string, unknown> & { id: number }
type FormValues = Record<string, string>
type LookupSource = NonNullable<FieldDefinition["reference"]>
type LookupState = { loading: boolean; error: boolean; retry: () => void }
type LookupStates = Partial<Record<LookupSource, LookupState>>

function LookupFeedback({ states }: { states: LookupStates }) {
  return (
    <>
      {Object.entries(states).map(([source, state]) =>
        state.error ? (
          <Alert key={source} tone="danger">
            Could not load {source} options.{" "}
            <Button type="button" variant="outline" onClick={state.retry}>
              Retry {source} options
            </Button>
          </Alert>
        ) : state.loading ? (
          <p
            key={source}
            role="status"
            className="text-sm text-muted-foreground"
          >
            Loading {source} options...
          </p>
        ) : null
      )}
    </>
  )
}

const lookupServices = {
  programs: programsService,
  courses: coursesService,
  terms: termsService,
  users: usersService,
  students: studentsService,
  offerings: offeringsService,
  enrollments: enrollmentsService,
  instructors: instructorsService,
  studentAccounts: usersService,
}

function displayName(
  source: LookupSource,
  item: Row,
  lookups: Partial<Record<LookupSource, Row[]>> = {}
): string {
  if (source === "programs") return `${item.code} — ${item.name}`
  if (source === "courses") return `${item.course_code} — ${item.course_title}`
  if (source === "terms") return `${item.academic_year} — ${item.semester}`
  if (["users", "instructors", "studentAccounts"].includes(source))
    return `${item.name} (${item.role}, ${item.status}) — #${item.id}`
  if (source === "students")
    return `${item.student_number} — ${item.first_name} ${item.last_name}`
  if (source === "offerings") {
    const course = lookups.courses?.find((row) => row.id === item.course_id)
    const term = lookups.terms?.find((row) => row.id === item.academic_term_id)
    return `Offering #${item.id} — ${course ? `${course.course_code} ${course.course_title}` : `Course #${item.course_id}`} — Section ${item.section} — ${term ? `${term.semester} ${term.academic_year}` : `Term #${item.academic_term_id}`}`
  }
  const student = lookups.students?.find((row) => row.id === item.student_id)
  const offering = lookups.offerings?.find(
    (row) => row.id === item.course_offering_id
  )
  return `Enrollment #${item.id} — ${student ? `${student.student_number} ${student.first_name} ${student.last_name}` : `Student #${item.student_id}`} — ${offering ? displayName("offerings", offering, lookups) : `Offering #${item.course_offering_id}`}`
}

function initialValues(definition: ResourceDefinition, row: Row | null) {
  return Object.fromEntries(
    definition.fields
      .filter((field) => !(row && field.createOnly))
      .map((field) => {
        const value = row?.[field.key]
        if (value !== undefined && value !== null)
          return [field.key, String(value)]
        if (field.key === "status") return [field.key, "ACTIVE"]
        if (field.key === "enrollment_date")
          return [field.key, new Date().toISOString().slice(0, 10)]
        return [field.key, ""]
      })
  )
}

function toPayload(
  fields: FieldDefinition[],
  values: FormValues,
  editing: boolean
) {
  const payload: Record<string, unknown> = {}
  fields.forEach((field) => {
    if (editing && field.createOnly) return
    const raw = values[field.key]
    if (raw === "" || raw === undefined) {
      if (!field.required && editing) payload[field.key] = null
      return
    }
    payload[field.key] =
      field.type === "number" ||
      field.type === "year" ||
      field.type === "reference"
        ? Number(raw)
        : raw
  })
  return payload
}

function errorText(error: unknown) {
  return error instanceof Error
    ? error.message
    : "The request could not be completed."
}

function ResourceForm({
  definition,
  row,
  lookups,
  lookupStates,
  defaults,
  onSaved,
}: {
  definition: ResourceDefinition
  row: Row | null
  lookups: Partial<Record<LookupSource, Row[]>>
  lookupStates: LookupStates
  defaults?: FormValues
  onSaved: () => void
}) {
  const [values, setValues] = React.useState<FormValues>(() => ({
    ...initialValues(definition, row),
    ...(!row ? defaults : {}),
  }))
  const [fieldErrors, setFieldErrors] = React.useState<
    Record<string, string[]>
  >({})
  const [baseline] = React.useState(values)
  const formRef = React.useRef<HTMLFormElement>(null)
  const saving = React.useRef(false)
  React.useEffect(() => {
    if (Object.keys(fieldErrors).length)
      formRef.current
        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.focus()
  }, [fieldErrors])
  const queryClient = useQueryClient()
  const blocked = definition.fields.some((field) => {
    if (!field.required || !field.reference || (row && field.createOnly))
      return false
    const state = lookupStates[field.reference]
    return (
      !state ||
      state.loading ||
      state.error ||
      !(lookups[field.reference] ?? []).some(
        (item) => String(item.id) === values[field.key]
      )
    )
  })
  const mutation = useMutation({
    mutationFn: () => {
      const payload = toPayload(definition.fields, values, Boolean(row))
      return row
        ? definition.service.update(row.id, payload)
        : definition.service.create(payload)
    },
    onSuccess: async (response) => {
      await invalidateResource(queryClient, definition.key)
      toast.success(response.message)
      onSaved()
    },
    onError: (error) => {
      if (error instanceof ApiError) setFieldErrors(error.fieldErrors)
    },
    onSettled: () => {
      saving.current = false
    },
  })
  useFormProtection(
    JSON.stringify(values) !== JSON.stringify(baseline),
    mutation.isPending
  )

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (blocked || saving.current) return
    setFieldErrors({})
    if (
      definition.key === "academic-terms" &&
      values.end_date <= values.start_date
    ) {
      setFieldErrors({ end_date: ["End date must be after start date."] })
      return
    }
    saving.current = true
    mutation.mutate()
  }

  return (
    <form ref={formRef} className="mt-5 grid gap-4" onSubmit={submit}>
      <fieldset disabled={mutation.isPending} className="contents">
        {definition.notes ? <Alert>{definition.notes}</Alert> : null}
        <LookupFeedback
          states={Object.fromEntries(
            definition.fields
              .filter((field) => field.reference && !(row && field.createOnly))
              .map((field) => [field.reference, lookupStates[field.reference!]])
              .filter((entry) => entry[1])
          )}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {definition.fields
            .filter((field) => !(row && field.createOnly))
            .map((field) => {
              const common = {
                name: field.key,
                value: values[field.key] ?? "",
                onChange: (
                  event: React.ChangeEvent<
                    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
                  >
                ) =>
                  setValues((current) => ({
                    ...current,
                    [field.key]: event.target.value,
                  })),
                required: field.required,
                "aria-invalid": Boolean(fieldErrors[field.key]),
              }
              let control: React.ReactNode
              if (field.type === "textarea") control = <Textarea {...common} />
              else if (field.type === "status")
                control = (
                  <Select {...common}>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </Select>
                )
              else if (field.type === "year")
                control = (
                  <Select {...common}>
                    <option value="">Select year</option>
                    {[1, 2, 3, 4, 5, 6].map((year) => (
                      <option key={year} value={year}>
                        Year {year}
                      </option>
                    ))}
                  </Select>
                )
              else if (field.type === "reference" && field.reference) {
                const state = lookupStates[field.reference]
                control = (
                  <ReferenceSelect
                    {...common}
                    label={field.label}
                    disabled={!state || state.loading || state.error}
                    options={(lookups[field.reference] ?? []).map((item) => ({
                      id: item.id,
                      label: displayName(field.reference!, item, lookups),
                    }))}
                  />
                )
              } else
                control = (
                  <Input
                    {...common}
                    type={field.type ?? "text"}
                    min={field.min}
                    max={field.max}
                    step={field.step}
                  />
                )
              return (
                <Field
                  key={field.key}
                  label={field.label}
                  required={field.required}
                  error={fieldErrors[field.key]?.[0]}
                >
                  {control}
                </Field>
              )
            })}
        </div>
        {mutation.isError ? (
          <Alert tone="danger">{errorText(mutation.error)}</Alert>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
          <DialogClose asChild>
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" disabled={mutation.isPending || blocked}>
            {mutation.isPending
              ? "Saving…"
              : row
                ? "Save changes"
                : `Create ${definition.singular}`}
          </Button>
        </div>
      </fieldset>
    </form>
  )
}

export function ResourcePage({
  definition: baseDefinition,
}: {
  definition: ResourceDefinition
}) {
  const { user } = useAuth()
  const definition = React.useMemo(
    () =>
      baseDefinition.key === "students" && user?.role === "ADMIN"
        ? {
            ...baseDefinition,
            fields: baseDefinition.fields.map((field): FieldDefinition =>
              field.key === "user_id"
                ? {
                    ...field,
                    label: "Linked student account",
                    type: "reference",
                    reference: "studentAccounts",
                  }
                : field
            ),
          }
        : baseDefinition,
    [baseDefinition, user?.role]
  )
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = React.useState<Row | null | undefined>(
    undefined
  )
  const [viewing, setViewing] = React.useState<Row | undefined>(undefined)
  const [searchDraft, setSearchDraft] = useStudentSearch()
  const createRequested = Boolean(
    user &&
    definition.managers.includes(user.role) &&
    params.get("create") === "1" &&
    ["students", "enrollments"].includes(definition.key)
  )
  React.useEffect(() => {
    // A workspace link opens the existing create form with authorized defaults.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (createRequested) setEditing(null)
  }, [createRequested, definition.key])
  const defaults: FormValues =
    definition.key === "enrollments"
      ? Object.fromEntries(
          ["student_id", "course_offering_id"]
            .filter((key) => params.get(key))
            .map((key) => [key, params.get(key)!])
        )
      : definition.key === "students" &&
          user?.role === "ADMIN" &&
          params.get("link_user_id")
        ? { user_id: params.get("link_user_id")! }
        : {}
  const page = positiveInteger(params.get("page"), 1)
  const perPage = positiveInteger(params.get("per_page"), 20, 100)
  const query: Record<string, unknown> = { page, per_page: perPage }
  if (definition.supportsStudentFilters) {
    for (const key of [
      "search",
      "program_id",
      "year_level",
      "status",
      "sort",
    ]) {
      const value = params.get(key)
      if (value) {
        if (key === "program_id" || key === "year_level") {
          const numeric = positiveInteger(value, 0)
          if (numeric && (key !== "year_level" || numeric <= 6))
            query[key] = numeric
        } else query[key] = value
      }
    }
  }

  const listQuery = useQuery({
    queryKey: [definition.key, query],
    queryFn: ({ signal }) => definition.service.list(query, signal),
  })

  const lookupSources = React.useMemo(() => {
    const sources = new Set(
      [
        ...definition.fields.map((field) => field.reference),
        ...definition.columns.map((column) => column.reference),
        ...(definition.supportsStudentFilters ? ["programs" as const] : []),
      ].filter(Boolean)
    )
    if (sources.has("enrollments")) {
      sources.add("students")
      sources.add("offerings")
    }
    if (sources.has("offerings")) {
      sources.add("courses")
      sources.add("terms")
    }
    return Array.from(sources) as LookupSource[]
  }, [definition])
  function canLoad(source: LookupSource) {
    if (source === "users" || source === "studentAccounts")
      return user?.role === "ADMIN"
    if (source === "instructors")
      return user?.role === "ADMIN" || user?.role === "STAFF"
    return true
  }

  const lookupQueries = useQueries({
    queries: lookupSources.map((source) => ({
      queryKey: ["lookup", source],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        listAll<unknown>(lookupServices[source].list, signal),
      enabled: canLoad(source),
      staleTime: 60_000,
    })),
  })
  const lookups = Object.fromEntries(
    lookupSources.map((source, index) => [
      source,
      ((lookupQueries[index]?.data?.data ?? []) as Row[]).filter(
        (row) => source !== "studentAccounts" || row.role === "STUDENT"
      ),
    ])
  ) as Partial<Record<LookupSource, Row[]>>
  const lookupStates: LookupStates = Object.fromEntries(
    lookupSources.filter(canLoad).map((source) => {
      const result = lookupQueries[lookupSources.indexOf(source)]
      return [
        source,
        {
          loading: result.isPending,
          error: result.isError,
          retry: () => {
            void result.refetch()
          },
        },
      ]
    })
  )
  const rows = (listQuery.data?.data ?? []) as Row[]
  const meta = listQuery.data?.meta
  const canManage = Boolean(user && definition.managers.includes(user.role))
  const canDelete = Boolean(user && definition.deleters.includes(user.role))
  const queryClient = useQueryClient()
  const actionLock = React.useRef(false)
  const detail = useQuery({
    queryKey: ["editor-detail", definition.key, editing?.id],
    queryFn: ({ signal }) => definition.service.get(editing!.id, signal),
    enabled: Boolean(editing),
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  })
  const viewDetail = useQuery({
    queryKey: ["view-detail", definition.key, viewing?.id],
    queryFn: ({ signal }) => definition.service.get(viewing!.id, signal),
    enabled: Boolean(viewing),
    staleTime: 0,
    gcTime: 0,
  })

  const actionMutation = useMutation({
    mutationFn: async ({
      row,
      action,
    }: {
      row: Row
      action: "deactivate" | "delete"
    }) => {
      if (action === "delete") return definition.service.remove(row.id)
      return definition.service.update(row.id, { status: "INACTIVE" })
    },
    onSuccess: async (response) => {
      await invalidateResource(queryClient, definition.key)
      toast.success(response.message)
    },
    onError: (error) => toast.error(errorText(error)),
    onSettled: () => {
      actionLock.current = false
    },
  })
  function identity(row: Row) {
    const label =
      row.student_number ??
      row.course_code ??
      row.code ??
      row.section ??
      row.name ??
      (definition.key === "grades" ? `Enrollment #${row.enrollment_id}` : null)
    return `${label ? `${label} ` : ""}(#${row.id})`
  }
  function act(row: Row, action: "deactivate" | "delete") {
    if (actionLock.current) return
    const prompt =
      action === "delete"
        ? `Permanently delete ${definition.singular} ${identity(row)}? This cannot be undone.`
        : `Deactivate ${definition.singular} ${identity(row)}?`
    if (!window.confirm(prompt)) return
    actionLock.current = true
    actionMutation.mutate({ row, action })
  }

  function setFilter(key: string, value: string) {
    setParams((current) => {
      if (value) current.set(key, value)
      else current.delete(key)
      if (key !== "page") current.set("page", "1")
      return current
    })
  }

  function renderCell(row: Row, key: string, source?: LookupSource) {
    if (key === "full_name")
      return [row.first_name, row.middle_name, row.last_name, row.suffix]
        .filter(Boolean)
        .join(" ")
    if (key === "date_range") return `${row.start_date} to ${row.end_date}`
    if (key === "status")
      return (
        <Badge tone={row.status === "ACTIVE" ? "success" : "muted"}>
          {String(row.status)}
        </Badge>
      )
    if (source) {
      const match = (lookups[source] ?? []).find(
        (item) => item.id === Number(row[key])
      )
      return match
        ? displayName(source, match, lookups)
        : `#${String(row[key])}`
    }
    return row[key] === null || row[key] === "" ? "—" : String(row[key])
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Student Information System
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {definition.title}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {definition.description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={
              listQuery.isFetching ||
              lookupQueries.some((result) => result.isFetching)
            }
            onClick={() => {
              void listQuery.refetch()
              lookupQueries.forEach((result, index) => {
                if (canLoad(lookupSources[index])) void result.refetch()
              })
            }}
          >
            Refresh
          </Button>
          {canManage ? (
            <Button onClick={() => setEditing(null)}>
              Create {definition.singular}
            </Button>
          ) : null}
        </div>
      </header>

      {definition.supportsStudentFilters ? (
        <Card className="grid gap-3 p-4 md:grid-cols-6">
          <Input
            className="md:col-span-2"
            aria-label="Search students"
            placeholder="Search students…"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
          />
          <Select
            aria-label="Program filter"
            value={params.get("program_id") ?? ""}
            onChange={(event) => setFilter("program_id", event.target.value)}
          >
            <option value="">All programs</option>
            {(lookups.programs ?? []).map((program) => (
              <option key={program.id} value={program.id}>
                {displayName("programs", program)}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Year filter"
            value={params.get("year_level") ?? ""}
            onChange={(event) => setFilter("year_level", event.target.value)}
          >
            <option value="">All years</option>
            {[1, 2, 3, 4, 5, 6].map((year) => (
              <option key={year} value={year}>
                Year {year}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Status filter"
            value={params.get("status") ?? ""}
            onChange={(event) => setFilter("status", event.target.value)}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </Select>
          <Select
            aria-label="Sort students"
            value={params.get("sort") ?? "last_name"}
            onChange={(event) => setFilter("sort", event.target.value)}
          >
            <option value="last_name">Last name A-Z</option>
            <option value="-last_name">Last name Z-A</option>
            <option value="student_number">Student no. A-Z</option>
            <option value="-created_at">Newest first</option>
          </Select>
        </Card>
      ) : null}

      {definition.notes ? <Alert>{definition.notes}</Alert> : null}
      <LookupFeedback states={lookupStates} />
      {listQuery.isLoading ? (
        <Card className="space-y-3 p-5">
          {[1, 2, 3, 4, 5].map((item) => (
            <Skeleton key={item} className="h-10" />
          ))}
        </Card>
      ) : null}
      {listQuery.isError ? (
        <Alert tone="danger">
          <strong>Could not load {definition.title.toLowerCase()}.</strong>
          <p className="mt-1">{errorText(listQuery.error)}</p>
          <Button
            className="mt-3"
            variant="outline"
            onClick={() => listQuery.refetch()}
          >
            Try again
          </Button>
        </Alert>
      ) : null}
      {!listQuery.isLoading && !listQuery.isError ? (
        <Card className="overflow-hidden">
          {rows.length === 0 ? (
            <div className="p-10 text-center">
              <h2 className="font-medium">
                No {definition.title.toLowerCase()} found
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Try another page or filter, or create the first record if your
                role allows it.
              </p>
            </div>
          ) : (
            <div
              className="overflow-x-auto"
              role="region"
              aria-label={`${definition.title} table`}
              tabIndex={0}
            >
              <Table>
                <thead className="bg-muted/60 text-left text-xs tracking-wide text-muted-foreground uppercase">
                  <tr>
                    {definition.columns.map((column) => (
                      <th key={column.key} className="px-4 py-3">
                        {column.label}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-t hover:bg-muted/30">
                      {definition.columns.map((column) => (
                        <td key={column.key} className="px-4 py-3">
                          {renderCell(row, column.key, column.reference)}
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            aria-label={`View ${definition.singular} ${identity(row)}`}
                            size="sm"
                            variant="outline"
                            onClick={() => setViewing(row)}
                          >
                            View
                          </Button>
                          {canManage ? (
                            <>
                              <Button
                                aria-label={`Edit ${definition.singular} ${identity(row)}`}
                                size="sm"
                                variant="outline"
                                onClick={() => setEditing(row)}
                              >
                                Edit
                              </Button>
                              {"status" in row && row.status === "ACTIVE" ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  aria-label={`Deactivate ${definition.singular} ${identity(row)}`}
                                  disabled={actionMutation.isPending}
                                  onClick={() => act(row, "deactivate")}
                                >
                                  {actionMutation.isPending &&
                                  actionMutation.variables?.row.id === row.id &&
                                  actionMutation.variables.action ===
                                    "deactivate"
                                    ? "Deactivating..."
                                    : "Deactivate"}
                                </Button>
                              ) : null}
                              {canDelete ? (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  aria-label={`Delete ${definition.singular} ${identity(row)}`}
                                  disabled={actionMutation.isPending}
                                  onClick={() => act(row, "delete")}
                                >
                                  {actionMutation.isPending &&
                                  actionMutation.variables?.row.id === row.id &&
                                  actionMutation.variables.action === "delete"
                                    ? "Deleting..."
                                    : "Delete"}
                                </Button>
                              ) : null}
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
          <div className="flex flex-col gap-3 border-t p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground">
              {meta
                ? `${meta.total} total · Page ${meta.page} of ${meta.last_page}`
                : `${rows.length} records`}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                className="w-24"
                aria-label="Rows per page"
                value={String(perPage)}
                onChange={(event) => setFilter("per_page", event.target.value)}
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </Select>
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setFilter("page", String(page - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!meta || page >= meta.last_page}
                onClick={() => setFilter("page", String(page + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      <ProtectedDialog
        open={editing !== undefined}
        onClose={() => setEditing(undefined)}
      >
        <DialogContent>
          <DialogTitle>
            {editing
              ? `Edit ${definition.singular}`
              : `Create ${definition.singular}`}
          </DialogTitle>
          <DialogDescription>
            Required fields are marked. Backend validation remains
            authoritative.
          </DialogDescription>
          {editing && detail.isPending ? (
            <p role="status" className="mt-4">
              Loading current record...
            </p>
          ) : null}
          {editing && detail.isError ? (
            <Alert tone="danger">
              Could not load the current record. {errorText(detail.error)}{" "}
              <Button variant="outline" onClick={() => detail.refetch()}>
                Retry current record
              </Button>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
            </Alert>
          ) : null}
          {editing !== undefined &&
          (!editing || (detail.isSuccess && !detail.isFetching)) ? (
            <ResourceForm
              key={editing?.id ?? "new"}
              definition={definition}
              row={editing ? (detail.data!.data as Row) : null}
              lookups={lookups}
              lookupStates={lookupStates}
              defaults={defaults}
              onSaved={() => setEditing(undefined)}
            />
          ) : null}
        </DialogContent>
      </ProtectedDialog>
      <Dialog
        open={viewing !== undefined}
        onOpenChange={(open) => {
          if (!open) setViewing(undefined)
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogTitle>
            {definition.singular.charAt(0).toUpperCase() +
              definition.singular.slice(1)}{" "}
            details
          </DialogTitle>
          <DialogDescription>
            Read-only data returned by the REST API.
          </DialogDescription>
          {viewing && definition.key === "students" ? (
            <Button asChild className="mt-3" variant="outline">
              <Link to={`/students/${viewing.id}`}>Open student workspace</Link>
            </Button>
          ) : null}
          {viewing &&
          definition.key === "course-offerings" &&
          user?.role !== "STUDENT" ? (
            <Button asChild className="mt-3" variant="outline">
              <Link to={`/course-offerings/${viewing.id}`}>
                Open class roster
              </Link>
            </Button>
          ) : null}
          {viewing && viewDetail.isPending ? (
            <p role="status">Loading current record...</p>
          ) : null}
          {viewing && viewDetail.isError ? (
            <Alert tone="danger">
              Could not load this record. {errorText(viewDetail.error)}{" "}
              <Button variant="outline" onClick={() => viewDetail.refetch()}>
                Retry current record
              </Button>
            </Alert>
          ) : null}
          {viewing && viewDetail.isSuccess ? (
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              {definition.fields.map((field) => (
                <div
                  key={field.key}
                  className={field.type === "textarea" ? "sm:col-span-2" : ""}
                >
                  <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {field.label}
                  </dt>
                  <dd className="mt-1 text-sm font-medium break-words">
                    {renderCell(
                      viewDetail.data.data as Row,
                      field.key,
                      field.reference
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          <div className="mt-6 flex justify-end border-t pt-4">
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
