import * as React from "react"
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useSearchParams } from "react-router-dom"

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
} from "@/services/api/services"
import { ApiError } from "@/types/api"
import type { FieldDefinition, ResourceDefinition } from "./resource-definitions"

type Row = Record<string, unknown> & { id: number }
type FormValues = Record<string, string>
type LookupSource = NonNullable<FieldDefinition["reference"]>

const lookupServices = {
  programs: programsService,
  courses: coursesService,
  terms: termsService,
  users: usersService,
  students: studentsService,
  offerings: offeringsService,
  enrollments: enrollmentsService,
}

function displayName(source: LookupSource, item: Row) {
  if (source === "programs") return `${item.code} — ${item.name}`
  if (source === "courses") return `${item.course_code} — ${item.course_title}`
  if (source === "terms") return `${item.academic_year} — ${item.semester}`
  if (source === "users") return `${item.name} (${item.role})`
  if (source === "students") return `${item.student_number} — ${item.first_name} ${item.last_name}`
  if (source === "offerings") return `Offering #${item.id} — Section ${item.section}`
  return `Enrollment #${item.id}`
}

function initialValues(definition: ResourceDefinition, row: Row | null) {
  return Object.fromEntries(
    definition.fields
      .filter((field) => !(row && field.createOnly))
      .map((field) => {
        const value = row?.[field.key]
        if (value !== undefined && value !== null) return [field.key, String(value)]
        if (field.key === "status") return [field.key, "ACTIVE"]
        if (field.key === "enrollment_date") return [field.key, new Date().toISOString().slice(0, 10)]
        return [field.key, ""]
      })
  )
}

function toPayload(fields: FieldDefinition[], values: FormValues, editing: boolean) {
  const payload: Record<string, unknown> = {}
  fields.forEach((field) => {
    if (editing && field.createOnly) return
    const raw = values[field.key]
    if (raw === "" || raw === undefined) {
      if (!field.required && editing) payload[field.key] = null
      return
    }
    payload[field.key] = field.type === "number" || field.type === "year" || field.type === "reference" ? Number(raw) : raw
  })
  return payload
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "The request could not be completed."
}

function ResourceForm({ definition, row, lookups, onSaved }: { definition: ResourceDefinition; row: Row | null; lookups: Partial<Record<LookupSource, Row[]>>; onSaved: () => void }) {
  const [values, setValues] = React.useState<FormValues>(() => initialValues(definition, row))
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({})
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => {
      const payload = toPayload(definition.fields, values, Boolean(row))
      return row ? definition.service.update(row.id, payload) : definition.service.create(payload)
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: [definition.key] })
      toast.success(response.message)
      onSaved()
    },
    onError: (error) => {
      if (error instanceof ApiError) setFieldErrors(error.fieldErrors)
    },
  })

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setFieldErrors({})
    if (definition.key === "academic-terms" && values.end_date <= values.start_date) {
      setFieldErrors({ end_date: ["End date must be after start date."] })
      return
    }
    mutation.mutate()
  }

  return (
    <form className="mt-5 grid gap-4" onSubmit={submit}>
      {definition.notes ? <Alert>{definition.notes}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {definition.fields.filter((field) => !(row && field.createOnly)).map((field) => {
          const common = {
            value: values[field.key] ?? "",
            onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setValues((current) => ({ ...current, [field.key]: event.target.value })),
            required: field.required,
            "aria-invalid": Boolean(fieldErrors[field.key]),
          }
          let control: React.ReactNode
          if (field.type === "textarea") control = <Textarea {...common} />
          else if (field.type === "status") control = <Select {...common}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></Select>
          else if (field.type === "year") control = <Select {...common}><option value="">Select year</option>{[1,2,3,4,5,6].map((year) => <option key={year} value={year}>Year {year}</option>)}</Select>
          else if (field.type === "reference" && field.reference) {
            control = <Select {...common}><option value="">Select {field.label.toLowerCase()}</option>{(lookups[field.reference] ?? []).map((item) => <option key={item.id} value={item.id}>{displayName(field.reference!, item)}</option>)}</Select>
          } else control = <Input {...common} type={field.type ?? "text"} min={field.min} max={field.max} step={field.step} />
          return <Field key={field.key} label={field.label} required={field.required} error={fieldErrors[field.key]?.[0]}>{control}</Field>
        })}
      </div>
      {mutation.isError ? <Alert tone="danger">{errorText(mutation.error)}</Alert> : null}
      <div className="flex justify-end gap-2 border-t pt-4">
        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
        <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Saving…" : row ? "Save changes" : `Create ${definition.singular}`}</Button>
      </div>
    </form>
  )
}

export function ResourcePage({ definition }: { definition: ResourceDefinition }) {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = React.useState<Row | null | undefined>(undefined)
  const [viewing, setViewing] = React.useState<Row | undefined>(undefined)
  const [searchDraft, setSearchDraft] = React.useState(params.get("search") ?? "")
  const page = Math.max(1, Number(params.get("page") ?? 1))
  const perPage = Math.min(100, Math.max(1, Number(params.get("per_page") ?? 20)))
  const query: Record<string, unknown> = { page, per_page: perPage }
  if (definition.supportsStudentFilters) {
    for (const key of ["search", "program_id", "year_level", "status", "sort"]) {
      const value = params.get(key)
      if (value) query[key] = value
    }
  }

  const listQuery = useQuery({
    queryKey: [definition.key, query],
    queryFn: ({ signal }) => definition.service.list(query, signal),
  })

  const lookupSources = React.useMemo(() => Array.from(new Set([
    ...definition.fields.map((field) => field.reference),
    ...definition.columns.map((column) => column.reference),
    ...(definition.supportsStudentFilters ? ["programs" as const] : []),
  ].filter(Boolean))) as LookupSource[], [definition])

  const lookupQueries = useQueries({
    queries: lookupSources.map((source) => ({
      queryKey: ["lookup", source],
      queryFn: ({ signal }: { signal: AbortSignal }) => lookupServices[source].list({ page: 1, per_page: 100 }, signal),
      enabled: source !== "users" || user?.role === "ADMIN",
      staleTime: 60_000,
    })),
  })
  const lookups = Object.fromEntries(lookupSources.map((source, index) => [source, (lookupQueries[index]?.data?.data ?? []) as Row[]])) as Partial<Record<LookupSource, Row[]>>
  const rows = (listQuery.data?.data ?? []) as Row[]
  const meta = listQuery.data?.meta
  const canManage = Boolean(user && definition.managers.includes(user.role))
  const canDelete = Boolean(user && definition.deleters.includes(user.role))
  const queryClient = useQueryClient()

  const actionMutation = useMutation({
    mutationFn: async ({ row, action }: { row: Row; action: "deactivate" | "delete" }) => {
      if (action === "delete") return definition.service.remove(row.id)
      return definition.service.update(row.id, { status: "INACTIVE" })
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: [definition.key] })
      toast.success(response.message)
    },
    onError: (error) => toast.error(errorText(error)),
  })

  function setFilter(key: string, value: string) {
    setParams((current) => {
      if (value) current.set(key, value)
      else current.delete(key)
      if (key !== "page") current.set("page", "1")
      return current
    })
  }

  React.useEffect(() => {
    if (!definition.supportsStudentFilters) return
    const timer = window.setTimeout(() => {
      const currentSearch = params.get("search") ?? ""
      if (searchDraft === currentSearch) return
      setParams((current) => {
        if (searchDraft) current.set("search", searchDraft)
        else current.delete("search")
        current.set("page", "1")
        return current
      })
    }, 350)
    return () => window.clearTimeout(timer)
  }, [definition.supportsStudentFilters, params, searchDraft, setParams])

  function renderCell(row: Row, key: string, source?: LookupSource) {
    if (key === "full_name") return [row.first_name, row.middle_name, row.last_name, row.suffix].filter(Boolean).join(" ")
    if (key === "date_range") return `${row.start_date} to ${row.end_date}`
    if (key === "status") return <Badge tone={row.status === "ACTIVE" ? "success" : "muted"}>{String(row.status)}</Badge>
    if (source) {
      const match = (lookups[source] ?? []).find((item) => item.id === Number(row[key]))
      return match ? displayName(source, match) : `#${String(row[key])}`
    }
    return row[key] === null || row[key] === "" ? "—" : String(row[key])
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm text-muted-foreground">Student Information System</p><h1 className="text-2xl font-semibold tracking-tight">{definition.title}</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">{definition.description}</p></div>
        {canManage ? <Button onClick={() => setEditing(null)}>Create {definition.singular}</Button> : null}
      </header>

      {definition.supportsStudentFilters ? (
        <Card className="grid gap-3 p-4 md:grid-cols-6">
          <Input className="md:col-span-2" aria-label="Search students" placeholder="Search students…" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} />
          <Select aria-label="Program filter" value={params.get("program_id") ?? ""} onChange={(event) => setFilter("program_id", event.target.value)}><option value="">All programs</option>{(lookups.programs ?? []).map((program) => <option key={program.id} value={program.id}>{displayName("programs", program)}</option>)}</Select>
          <Select aria-label="Year filter" value={params.get("year_level") ?? ""} onChange={(event) => setFilter("year_level", event.target.value)}><option value="">All years</option>{[1,2,3,4,5,6].map((year) => <option key={year} value={year}>Year {year}</option>)}</Select>
          <Select aria-label="Status filter" value={params.get("status") ?? ""} onChange={(event) => setFilter("status", event.target.value)}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></Select>
          <Select aria-label="Sort students" value={params.get("sort") ?? "last_name"} onChange={(event) => setFilter("sort", event.target.value)}><option value="last_name">Last name A-Z</option><option value="-last_name">Last name Z-A</option><option value="student_number">Student no. A-Z</option><option value="-created_at">Newest first</option></Select>
        </Card>
      ) : null}

      {definition.notes ? <Alert>{definition.notes}</Alert> : null}
      {listQuery.isLoading ? <Card className="space-y-3 p-5">{[1,2,3,4,5].map((item) => <Skeleton key={item} className="h-10" />)}</Card> : null}
      {listQuery.isError ? <Alert tone="danger"><strong>Could not load {definition.title.toLowerCase()}.</strong><p className="mt-1">{errorText(listQuery.error)}</p><Button className="mt-3" variant="outline" onClick={() => listQuery.refetch()}>Try again</Button></Alert> : null}
      {!listQuery.isLoading && !listQuery.isError ? (
        <Card className="overflow-hidden">
          {rows.length === 0 ? <div className="p-10 text-center"><h2 className="font-medium">No {definition.title.toLowerCase()} found</h2><p className="mt-1 text-sm text-muted-foreground">Try another page or filter, or create the first record if your role allows it.</p></div> : (
            <div className="overflow-x-auto"><Table><thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr>{definition.columns.map((column) => <th key={column.key} className="px-4 py-3">{column.label}</th>)}<th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t hover:bg-muted/30">{definition.columns.map((column) => <td key={column.key} className="px-4 py-3">{renderCell(row, column.key, column.reference)}</td>)}<td className="px-4 py-3"><div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => setViewing(row)}>View</Button>{canManage ? <><Button size="sm" variant="outline" onClick={() => setEditing(row)}>Edit</Button>{"status" in row && row.status === "ACTIVE" ? <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Deactivate this ${definition.singular}?`)) actionMutation.mutate({ row, action: "deactivate" }) }}>Deactivate</Button> : null}{canDelete ? <Button size="sm" variant="destructive" onClick={() => { if (confirm(`Permanently delete this ${definition.singular}? This cannot be undone.`)) actionMutation.mutate({ row, action: "delete" }) }}>Delete</Button> : null}</> : null}</div></td></tr>)}</tbody></Table></div>
          )}
          <div className="flex flex-col gap-3 border-t p-4 text-sm sm:flex-row sm:items-center sm:justify-between"><p className="text-muted-foreground">{meta ? `${meta.total} total · Page ${meta.page} of ${meta.last_page}` : `${rows.length} records`}</p><div className="flex items-center gap-2"><Select className="w-24" aria-label="Rows per page" value={String(perPage)} onChange={(event) => setFilter("per_page", event.target.value)}><option value="10">10</option><option value="20">20</option><option value="50">50</option><option value="100">100</option></Select><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setFilter("page", String(page - 1))}>Previous</Button><Button variant="outline" size="sm" disabled={!meta || page >= meta.last_page} onClick={() => setFilter("page", String(page + 1))}>Next</Button></div></div>
        </Card>
      ) : null}

      <Dialog open={editing !== undefined} onOpenChange={(open) => { if (!open) setEditing(undefined) }}>
        <DialogContent>
          <DialogTitle>{editing ? `Edit ${definition.singular}` : `Create ${definition.singular}`}</DialogTitle>
          <DialogDescription>Required fields are marked. Backend validation remains authoritative.</DialogDescription>
          {editing !== undefined ? <ResourceForm key={editing?.id ?? "new"} definition={definition} row={editing} lookups={lookups} onSaved={() => setEditing(undefined)} /> : null}
        </DialogContent>
      </Dialog>
      <Dialog open={viewing !== undefined} onOpenChange={(open) => { if (!open) setViewing(undefined) }}>
        <DialogContent className="max-w-xl">
          <DialogTitle>{definition.singular.charAt(0).toUpperCase() + definition.singular.slice(1)} details</DialogTitle>
          <DialogDescription>Read-only data returned by the REST API.</DialogDescription>
          {viewing ? <dl className="mt-5 grid gap-4 sm:grid-cols-2">{definition.fields.map((field) => <div key={field.key} className={field.type === "textarea" ? "sm:col-span-2" : ""}><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{field.label}</dt><dd className="mt-1 break-words text-sm font-medium">{renderCell(viewing, field.key, field.reference)}</dd></div>)}</dl> : null}
          <div className="mt-6 flex justify-end border-t pt-4"><DialogClose asChild><Button variant="outline">Close</Button></DialogClose></div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
