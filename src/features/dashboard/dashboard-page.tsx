import { useQueries } from "@tanstack/react-query"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Alert, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from "@/components/ui/primitives"
import { useAuth } from "@/features/auth/auth-context"
import { coursesService, enrollmentsService, gradesService, offeringsService, programsService, studentsService, termsService } from "@/services/api/services"

const allCards = [
  { key: "students", label: "Students", href: "/students", service: studentsService },
  { key: "programs", label: "Programs", href: "/programs", service: programsService },
  { key: "courses", label: "Courses", href: "/courses", service: coursesService },
  { key: "terms", label: "Academic terms", href: "/academic-terms", service: termsService },
  { key: "offerings", label: "Course offerings", href: "/course-offerings", service: offeringsService },
  { key: "enrollments", label: "Enrollments", href: "/enrollments", service: enrollmentsService },
  { key: "grades", label: "Grades", href: "/grades", service: gradesService },
]

export function DashboardPage() {
  const { user } = useAuth()
  const allowed = user?.role === "STUDENT" ? allCards.filter((item) => ["enrollments", "grades"].includes(item.key)) : user?.role === "INSTRUCTOR" ? allCards.filter((item) => ["students", "offerings", "enrollments", "grades"].includes(item.key)) : allCards
  const queries = useQueries({ queries: allowed.map((item) => ({ queryKey: ["dashboard", item.key], queryFn: ({ signal }: { signal: AbortSignal }) => item.service.list({ page: 1, per_page: 1 }, signal) })) })
  const hasError = queries.some((query) => query.isError)
  return <div className="space-y-6"><header><p className="text-sm text-muted-foreground">Overview</p><h1 className="text-2xl font-semibold tracking-tight">Welcome, {user?.name}</h1><p className="mt-1 text-sm text-muted-foreground">These totals come from the records your role is allowed to access.</p></header>{hasError ? <Alert tone="danger">Some summaries could not be loaded. Open a module to retry its data.</Alert> : null}<section aria-label="Record summaries" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{allowed.map((item, index) => <Card key={item.key}><CardHeader><CardDescription>{item.label}</CardDescription><CardTitle className="text-3xl">{queries[index]?.isLoading ? <Skeleton className="h-9 w-20" /> : queries[index]?.data?.meta?.total ?? 0}</CardTitle></CardHeader><CardContent><Button variant="outline" size="sm" asChild><Link to={item.href}>Open {item.label.toLowerCase()}</Link></Button></CardContent></Card>)}</section><Card><CardHeader><CardTitle>Quick actions</CardTitle><CardDescription>Continue with a role-appropriate workflow.</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-2"><Button asChild><Link to={user?.role === "STUDENT" ? "/academic-record" : "/students"}>{user?.role === "STUDENT" ? "View academic record" : "Open students"}</Link></Button><Button variant="outline" asChild><Link to="/profile">View account</Link></Button></CardContent></Card></div>
}
