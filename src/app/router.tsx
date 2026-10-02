/* eslint-disable react-refresh/only-export-components */
import { Navigate, createBrowserRouter } from "react-router-dom"

import { Alert, Card } from "@/components/ui/primitives"
import { Button } from "@/components/ui/button"
import { AcademicRecordPage } from "@/features/academic-record/academic-record-page"
import { LoginPage } from "@/features/auth/login-page"
import { RequireAuth } from "@/features/auth/require-auth"
import { DashboardPage } from "@/features/dashboard/dashboard-page"
import { ProfilePage } from "@/features/profile/profile-page"
import { ResourcePage } from "@/features/resources/resource-page"
import { resources } from "@/features/resources/resource-definitions"

function ErrorPage({ code, title, message }: { code: string; title: string; message: string }) {
  return <main className="grid min-h-[70svh] place-items-center p-4"><Card className="max-w-lg p-8 text-center"><p className="text-sm font-medium text-primary">{code}</p><h1 className="mt-2 text-2xl font-semibold">{title}</h1><p className="mt-2 text-sm text-muted-foreground">{message}</p><Button className="mt-6" asChild><a href="/dashboard">Return to dashboard</a></Button></Card></main>
}

function ResourceRoute({ name }: { name: keyof typeof resources }) {
  return <ResourcePage definition={resources[name]} />
}

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/403", element: <ErrorPage code="403" title="Access denied" message="Your account does not have permission to open this resource." /> },
  { element: <RequireAuth />, children: [
    { index: true, element: <Navigate to="/dashboard" replace /> },
    { path: "/dashboard", element: <DashboardPage /> },
    { path: "/students", element: <ResourceRoute name="students" /> },
    { path: "/programs", element: <ResourceRoute name="programs" /> },
    { path: "/courses", element: <ResourceRoute name="courses" /> },
    { path: "/academic-terms", element: <ResourceRoute name="academic-terms" /> },
    { path: "/course-offerings", element: <ResourceRoute name="course-offerings" /> },
    { path: "/enrollments", element: <ResourceRoute name="enrollments" /> },
    { path: "/grades", element: <ResourceRoute name="grades" /> },
    { path: "/academic-record", element: <AcademicRecordPage /> },
    { path: "/profile", element: <ProfilePage /> },
  ] },
  { path: "*", element: <ErrorPage code="404" title="Page not found" message="The page you requested does not exist." /> },
])

export function NetworkNotice() {
  return <Alert tone="danger">The backend is unreachable. Start the API and try again.</Alert>
}
