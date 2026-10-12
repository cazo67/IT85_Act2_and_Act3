import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, Navigate } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Alert,
  Badge,
  Card,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Field,
  Input,
  Select,
  Skeleton,
  Table,
} from "@/components/ui/primitives"
import { useAuth } from "@/features/auth/auth-context"
import { usersService } from "@/services/api/services"
import { invalidateResource, listAll } from "@/services/api/query-support"
import type { Role, Status, User } from "@/types/domain"
import {
  ProtectedDialog,
  useFormProtection,
} from "@/components/ui/protected-dialog"
import { useServerErrors } from "@/components/ui/use-server-errors"

function UserForm({
  user,
  onSaved,
}: {
  user: User | null
  onSaved: () => void
}) {
  const [name, setName] = React.useState(user?.name ?? "")
  const [email, setEmail] = React.useState(user?.email ?? "")
  const [password, setPassword] = React.useState("")
  const [role, setRole] = React.useState<Role>(user?.role ?? "STUDENT")
  const [status, setStatus] = React.useState<Status>(user?.status ?? "ACTIVE")
  const client = useQueryClient()
  const saving = React.useRef(false)
  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: name.trim(),
        role,
        status,
        ...(password ? { password } : {}),
      }
      return user
        ? usersService.update(user.id, payload)
        : usersService.create({ ...payload, email: email.trim() })
    },
    onSuccess: async () => {
      await invalidateResource(client, "users")
      toast.success(user ? "Account updated." : "Account created.")
      onSaved()
    },
    onSettled: () => {
      saving.current = false
    },
  })
  useFormProtection(
    name !== (user?.name ?? "") ||
      email !== (user?.email ?? "") ||
      Boolean(password) ||
      role !== (user?.role ?? "STUDENT") ||
      status !== (user?.status ?? "ACTIVE"),
    mutation.isPending
  )
  const { formRef, errors } = useServerErrors(mutation.error)
  return (
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
        <Field label="Name" required error={errors.name?.[0]}>
          <Input
            required
            maxLength={150}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field label="Email" required error={errors.email?.[0]}>
          <Input
            type="email"
            required
            disabled={Boolean(user)}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field
          label={user ? "New password (optional)" : "Password"}
          required={!user}
          error={errors.password?.[0]}
        >
          <Input
            type="password"
            autoComplete="new-password"
            required={!user}
            minLength={8}
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <Field label="Role" required error={errors.role?.[0]}>
          <Select
            value={role}
            onChange={(event) => setRole(event.target.value as Role)}
          >
            {["STUDENT", "INSTRUCTOR", "STAFF", "ADMIN"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </Select>
        </Field>
        <Field label="Status" required error={errors.status?.[0]}>
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value as Status)}
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </Select>
        </Field>
        <p className="text-sm text-muted-foreground">
          {user
            ? "Leave the password blank to keep it unchanged. Email changes are not supported by the current API."
            : "Provide this account's initial credentials directly to its owner."}{" "}
          Student accounts must also be linked to a student record.
        </p>
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
              : user
                ? "Save changes"
                : "Create account"}
          </Button>
        </div>
      </fieldset>
    </form>
  )
}

function UserEditor({
  user,
  onSaved,
}: {
  user: User | null
  onSaved: () => void
}) {
  const detail = useQuery({
    queryKey: ["user-editor", user?.id],
    queryFn: ({ signal }) => usersService.get(user!.id, signal),
    enabled: Boolean(user),
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  })
  if (user && detail.isPending)
    return (
      <p role="status" className="mt-4">
        Loading current account...
      </p>
    )
  if (user && detail.isError)
    return (
      <Alert tone="danger">
        Could not load the current account. {detail.error.message}
        <Button variant="outline" onClick={() => detail.refetch()}>
          Retry current account
        </Button>
        <DialogClose asChild>
          <Button variant="outline">Cancel</Button>
        </DialogClose>
      </Alert>
    )
  return <UserForm user={user ? detail.data!.data : null} onSaved={onSaved} />
}

export function UsersPage() {
  const { user } = useAuth()
  const allowed = user?.role === "ADMIN"
  const users = useQuery({
    queryKey: ["users"],
    queryFn: ({ signal }) => listAll(usersService.list, signal),
    enabled: allowed,
  })
  const [editing, setEditing] = React.useState<User | null | undefined>()
  const [search, setSearch] = React.useState("")
  if (!allowed) return <Navigate to="/403" replace />
  const rows = (users.data?.data ?? []).filter((item) =>
    `${item.id} ${item.name} ${item.email} ${item.role}`
      .toLowerCase()
      .includes(search.toLowerCase())
  )
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-sm text-muted-foreground">
          Create accounts, maintain access, and provision students and
          instructors.
        </p>
      </header>
      <div className="flex flex-wrap gap-3">
        <Input
          className="max-w-md"
          aria-label="Search users"
          placeholder="Search name, email or role"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Button onClick={() => setEditing(null)}>Create account</Button>
        <Button
          variant="outline"
          disabled={users.isFetching}
          onClick={() => users.refetch()}
        >
          Refresh
        </Button>
      </div>
      {users.isPending ? (
        <Skeleton className="h-40" />
      ) : users.isError ? (
        <Alert tone="danger">
          {users.error.message}
          <Button
            className="ml-3"
            variant="outline"
            onClick={() => users.refetch()}
          >
            Retry
          </Button>
        </Alert>
      ) : (
        <Card className="overflow-hidden">
          {rows.length === 0 ? (
            <p className="p-6">No matching accounts.</p>
          ) : (
            <div
              className="overflow-x-auto"
              role="region"
              aria-label="Users table"
              tabIndex={0}
            >
              <Table>
                <thead>
                  <tr>
                    {["ID", "Name", "Email", "Role", "Status", "Actions"].map(
                      (label) => (
                        <th key={label} className="p-3 text-left">
                          {label}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="p-3">{item.id}</td>
                      <td className="p-3">{item.name}</td>
                      <td className="p-3">{item.email}</td>
                      <td className="p-3">
                        <Badge>{item.role}</Badge>
                      </td>
                      <td className="p-3">
                        <Badge>{item.status}</Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            aria-label={`Edit account ${item.name} (#${item.id})`}
                            variant="outline"
                            onClick={() => setEditing(item)}
                          >
                            Edit account
                          </Button>
                          {item.role === "STUDENT" ? (
                            <Button asChild variant="outline">
                              <Link
                                aria-label={`Create linked student for ${item.name} (#${item.id})`}
                                to={`/students?create=1&link_user_id=${item.id}`}
                              >
                                Create linked student
                              </Link>
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card>
      )}
      <ProtectedDialog
        open={editing !== undefined}
        onClose={() => setEditing(undefined)}
      >
        <DialogContent>
          <DialogTitle>
            {editing ? "Edit account" : "Create account"}
          </DialogTitle>
          <DialogDescription>
            Account management is restricted to administrators.
          </DialogDescription>
          {editing !== undefined ? (
            <UserEditor
              key={editing?.id ?? "new"}
              user={editing}
              onSaved={() => setEditing(undefined)}
            />
          ) : null}
        </DialogContent>
      </ProtectedDialog>
    </div>
  )
}
