import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import BookOpen01Icon from "@hugeicons/core-free-icons/BookOpen01Icon"
import Calendar03Icon from "@hugeicons/core-free-icons/Calendar03Icon"
import Chart01Icon from "@hugeicons/core-free-icons/Chart01Icon"
import Home01Icon from "@hugeicons/core-free-icons/Home01Icon"
import Logout01Icon from "@hugeicons/core-free-icons/Logout01Icon"
import Menu01Icon from "@hugeicons/core-free-icons/Menu01Icon"
import School01Icon from "@hugeicons/core-free-icons/School01Icon"
import Sun03Icon from "@hugeicons/core-free-icons/Sun03Icon"
import UserGroupIcon from "@hugeicons/core-free-icons/UserGroupIcon"
import { NavLink, Outlet, useLocation } from "react-router-dom"

import { Button } from "@/components/ui/button"
import {
  Badge,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/primitives"
import { useTheme } from "@/components/theme-provider"
import { useAuth } from "@/features/auth/auth-context"
import type { Role } from "@/types/domain"

type NavItem = {
  to: string
  label: string
  icon: typeof Home01Icon
  roles?: Role[]
}
const items: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: Home01Icon },
  { to: "/students", label: "Students", icon: UserGroupIcon },
  { to: "/programs", label: "Programs", icon: School01Icon },
  { to: "/courses", label: "Courses", icon: BookOpen01Icon },
  { to: "/academic-terms", label: "Academic Terms", icon: Calendar03Icon },
  { to: "/course-offerings", label: "Course Offerings", icon: BookOpen01Icon },
  { to: "/enrollments", label: "Enrollments", icon: UserGroupIcon },
  { to: "/grades", label: "Grades", icon: Chart01Icon },
  { to: "/academic-record", label: "Academic Record", icon: BookOpen01Icon },
  { to: "/users", label: "Users", icon: UserGroupIcon, roles: ["ADMIN"] },
]

const roleLabel: Record<Role, string> = {
  ADMIN: "Administrator",
  STAFF: "Registrar / Staff",
  INSTRUCTOR: "Instructor",
  STUDENT: "Student",
}

export function AppShell() {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const location = useLocation()
  const visible = items
    .filter((item) => !item.roles || (user && item.roles.includes(user.role)))
    .map((item) => {
      const scoped = user?.role === "STUDENT" || user?.role === "INSTRUCTOR"
      const labels: Record<string, string> = {
        "/course-offerings": "My Classes",
        "/enrollments": "My Enrollments",
        "/grades": "My Grades",
        "/students":
          user?.role === "STUDENT" ? "My Student Record" : "My Students",
      }
      return {
        ...item,
        label: scoped ? (labels[item.to] ?? item.label) : item.label,
      }
    })

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-3 border-b px-5">
        <div className="grid size-9 place-items-center rounded-lg bg-primary font-bold text-primary-foreground">
          SI
        </div>
        <div>
          <p className="text-sm font-semibold">Student Info</p>
          <p className="text-xs text-muted-foreground">Management System</p>
        </div>
      </div>
      <nav
        aria-label="Primary navigation"
        className="flex-1 space-y-1 overflow-y-auto p-3"
      >
        {visible.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition ${isActive ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent"}`
            }
          >
            <HugeiconsIcon icon={item.icon} size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t p-3">
        <NavLink
          to="/profile"
          className="mb-2 flex items-center gap-3 rounded-lg p-2 hover:bg-sidebar-accent"
        >
          <div className="grid size-9 place-items-center rounded-full bg-primary/10 font-semibold text-primary">
            {user?.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user?.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {user ? roleLabel[user.role] : ""}
            </p>
          </div>
        </NavLink>
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() => void logout()}
        >
          <HugeiconsIcon icon={Logout01Icon} size={17} />
          Sign out
        </Button>
      </div>
    </div>
  )

  return (
    <div className="min-h-svh bg-muted/20">
      <a
        href="#main-content"
        className="sr-only fixed top-4 left-4 z-[100] rounded-lg bg-background p-3 focus:not-sr-only"
      >
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-sidebar md:block">
        {sidebar}
      </aside>
      <div className="min-w-0 md:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-3">
            <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
              <DialogTrigger asChild>
                <Button
                  className="md:hidden"
                  size="icon"
                  variant="outline"
                  aria-label="Open navigation"
                >
                  <HugeiconsIcon icon={Menu01Icon} size={20} />
                </Button>
              </DialogTrigger>
              <DialogContent className="top-0 left-0 h-svh max-h-svh w-[min(90vw,19rem)] max-w-none translate-x-0 translate-y-0 rounded-none bg-sidebar p-0">
                <DialogTitle className="sr-only">Navigation</DialogTitle>
                <DialogDescription className="sr-only">
                  Choose a school task or manage your account.
                </DialogDescription>
                <DialogClose asChild>
                  <Button
                    className="absolute top-2 right-2"
                    size="icon"
                    variant="outline"
                    aria-label="Close navigation"
                  >
                    ×
                  </Button>
                </DialogClose>
                {sidebar}
              </DialogContent>
            </Dialog>
            <div className="hidden text-sm text-muted-foreground sm:block">
              Home <span className="px-1">/</span>{" "}
              <span className="font-medium text-foreground capitalize">
                {location.pathname.split("/")[1]?.replaceAll("-", " ") ||
                  "Dashboard"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user ? <Badge>{roleLabel[user.role]}</Badge> : null}
            <Button
              size="icon"
              variant="ghost"
              aria-label="Change color theme"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <HugeiconsIcon icon={Sun03Icon} size={19} />
            </Button>
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto max-w-[1600px] min-w-0 p-4 outline-none md:p-6"
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}
