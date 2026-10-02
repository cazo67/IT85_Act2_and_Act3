import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Navigate, useLocation, useNavigate } from "react-router-dom"
import { z } from "zod"

import { Alert, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input } from "@/components/ui/primitives"
import { Button } from "@/components/ui/button"
import { useAuth } from "./auth-context"
import { ApiError } from "@/types/api"

const schema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "Password must contain at least 8 characters.").max(128),
})
type LoginValues = z.infer<typeof schema>

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<LoginValues>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } })

  if (user) return <Navigate to="/dashboard" replace />

  const from = typeof location.state === "object" && location.state && "from" in location.state && typeof location.state.from === "string" && location.state.from.startsWith("/") ? location.state.from : "/dashboard"

  async function submit(values: LoginValues) {
    try {
      await login(values.email, values.password)
      navigate(from, { replace: true })
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Login failed. Please try again."
      setError("root", { message })
    }
  }

  return (
    <main className="grid min-h-svh place-items-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="pb-4">
          <div className="mb-4 grid size-11 place-items-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">SI</div>
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>Sign in to the Student Information Management System.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={handleSubmit(submit)}>
            <Field label="Email" required error={errors.email?.message}><Input type="email" autoComplete="email" autoFocus {...register("email")} /></Field>
            <Field label="Password" required error={errors.password?.message}><Input type="password" autoComplete="current-password" {...register("password")} /></Field>
            {errors.root?.message ? <Alert tone="danger">{errors.root.message}</Alert> : null}
            <Button className="mt-1 w-full" size="lg" disabled={isSubmitting}>{isSubmitting ? "Signing in…" : "Sign in"}</Button>
          </form>
          <p className="mt-5 text-center text-xs text-muted-foreground">Authentication and permissions are enforced by the Laboratory 2 REST API.</p>
        </CardContent>
      </Card>
    </main>
  )
}
