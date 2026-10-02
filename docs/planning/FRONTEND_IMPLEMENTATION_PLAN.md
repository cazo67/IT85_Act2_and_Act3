# Laboratory 3 Frontend Implementation Plan

> **Historical document:** This plan records the structure before the completed
> frontend-only cleanup. References to nested `frontend/` and `backend/`
> directories are retained as historical planning evidence.

This document is a planning artifact only. It is based on the current `frontend/` source and the preserved `backend/` FastAPI application. No frontend feature or backend change is part of this planning pass.

## 1. Current Project Assessment

### Repository and frontend

- The repository is split into `backend/` and `frontend/`, with a project-level README. The root Git worktree already contains the structural refactor as uncommitted moves. `frontend/` also retains its own clean nested Git repository.
- The frontend is a minimal Vite 8, React 19, TypeScript 6 application. The installed tree currently resolves React 19.3.0, Vite 8.3.0, Tailwind CSS 4.3.3, and shadcn 4.21.0.
- The shadcn configuration is valid and must remain the foundation: `radix-luma` style, Radix base, neutral base color, CSS variables, default-translucent menu, subtle menu accent, and Hugeicons. Only `Button` is generated today.
- `src/index.css` contains the full light/dark token set, Inter Variable, a green primary palette, sidebar tokens, and compact `0.45rem` base radius. These tokens should be extended only when necessary, not replaced.
- `ThemeProvider` already supports light/dark/system, persists only the theme in `localStorage`, reacts to system changes, and supports the `d` keyboard shortcut.
- `App.tsx` is only the generated “Project ready” screen. There are no routes, pages, layouts, API utilities, authentication state, domain types, forms, or application tests.
- No frontend `.env` or `.env.example` exists. No API base URL is configured.
- The frontend has no routing, server-state, form, validation, or test dependencies. Recommended additions must therefore be explicit and limited: React Router for routes, TanStack Query for shared server state/invalidation, React Hook Form plus Zod and its resolver for forms, Vitest/Testing Library/MSW for component-integration tests, and Playwright for one critical browser flow. TanStack Query is justified by the number of related paginated CRUD resources; it is not a general client-state store.
- The existing scripts are `dev`, `build`, `lint`, `format`, `typecheck`, and `preview`. The current build and typecheck pass. Lint currently reports the generated `button.tsx` `react-refresh/only-export-components` issue; address it narrowly during Phase 1 without redesigning the primitive.
- Vite currently defaults to port 5173, while the backend `.env.example` allows `http://localhost:3000`. Plan to set Vite's development port to 3000 and use `http://localhost:3000` so frontend work does not require a backend source change. CORS must still be verified at runtime.

### Verified backend contract

- API prefix: `/api/v1`; local API base: `http://127.0.0.1:8000/api/v1` in Postman.
- Health is outside the prefix at `GET /health`. Swagger and OpenAPI are `/api/docs` and `/api/openapi.json`.
- Successful JSON responses are `{ success: true, message, data }`; paginated responses also contain `meta: { page, per_page, total, last_page }`.
- Error responses are `{ success: false, message, errors }`. Request validation uses an error dictionary such as `{ email: ["..."] }`; manually raised 422 errors can have `errors: null` and only a useful `message`.
- Collection defaults are `page=1`, `per_page=20`; `per_page` is limited to 1-100. `last_page` is at least 1, including an empty collection.
- Authentication is a JSON login followed by a Bearer JWT. The token expires after the configured 60 minutes by default. There is no refresh token and no cookie session. Logout records the token ID server-side, so the frontend must call logout rather than merely hiding the token.
- Roles are exactly `ADMIN`, `STAFF`, `INSTRUCTOR`, and `STUDENT`. Record status is exactly `ACTIVE` or `INACTIVE`.
- Only Students supports backend search, filters, and sorting: `search`, `program_id`, `year_level`, `status`, and `sort`. Supported sort fields are `last_name`, `student_number`, and `created_at`; prefix `-` means descending.
- Other collection endpoints expose pagination only. The frontend must not pretend that client-side filtering of one page is a complete backend search.
- Serialized records contain table columns only, not nested relationship names. Reference labels must be resolved through allowed reference endpoints. Academic Record is the one aggregate response and contains `student` plus term buckets containing `academic_term` and `courses[]` entries with `enrollment`, `course`, `offering`, and nullable `grade`.
- Deletes return HTTP 204 with no JSON body. The API has no grade-delete route.

### Verified authorization summary

| Capability | ADMIN | STAFF | INSTRUCTOR | STUDENT |
|---|---:|---:|---:|---:|
| Login, logout, current user | Yes | Yes | Yes | Yes |
| List/get programs, courses, terms | Yes | Yes | Yes | Yes |
| Create/update programs, courses, terms | Yes | Yes | No | No |
| Delete programs, courses, terms | Yes | No | No | No |
| List students | All | All | Assigned students | Own record |
| Get student | Any | Any | Assigned only | Own only |
| Create/update student | Yes | Yes | No | No |
| Delete student | Yes | No | No | No |
| List/get offerings | All | All | Assigned offerings | Enrolled offerings |
| Create/update offering | Yes | Yes | No | No |
| Delete offering | Yes | No | No | No |
| List/get enrollments | All | All | Assigned offerings | Own only |
| Create/update/delete enrollment | Yes | Yes | No | No |
| List/get grades | All | All | Assigned offerings | Own only |
| Create/update grade | Yes | Yes | Assigned offerings only | No |
| Academic record | Any student | Any student | Assigned students only | Own only |
| List/create/update users | Yes | No | No | No |

### Major gaps and constraints

- There is no dashboard aggregate endpoint. Any dashboard count must come from an allowed list request with `per_page=1` and `meta.total`; no decorative or fabricated analytics.
- `/auth/me` returns the user row but not the linked `student_id`. A student can safely discover it from role-scoped `GET /students`, which returns only their record.
- Staff may create/update course offerings but cannot call the admin-only `/users` list to discover instructor accounts. Staff also cannot discover available student user accounts for optional student-account linking. This is a backend contract gap; do not hardcode IDs or claim the workflow is fully user-friendly until resolved.
- Offering, enrollment, and grade rows mostly contain foreign-key IDs. Course and term labels can be resolved for all roles, but non-admin users cannot resolve arbitrary instructor IDs to names. Show a safe ID fallback or “Current instructor” for the logged-in instructor; do not invent names.
- Profile is read-only because the backend offers `/auth/me` but no self-profile update or password-change endpoint.
- The backend has hard delete plus status updates for several resources. Prefer “Deactivate” through `PATCH status=INACTIVE` in normal workflows; expose hard delete only to ADMIN with explicit dependency/conflict warnings.

## 2. Existing Files to Preserve

- `frontend/components.json`: source of truth for the radix-luma preset, aliases, Hugeicons, menu styling, and CSS-variable mode.
- `frontend/src/index.css`: preserve the preset tokens, dark theme, Inter font, and base behaviors; add only small application layout utilities if Tailwind composition is insufficient.
- `frontend/src/components/theme-provider.tsx`: retain theme persistence and system-theme behavior; compose a visible theme control around `useTheme`.
- `frontend/src/components/ui/button.tsx`: preserve the generated primitive and variants; make only the smallest lint-compatible adjustment if required.
- `frontend/src/lib/utils.ts`: retain the preset's `cn` export.
- `frontend/vite.config.ts` and TypeScript configs: preserve Vite/Tailwind/React plugins, strict TypeScript, and `@/*` alias; add only the dev port and test configuration needed later.
- `frontend/package.json` and `package-lock.json`: continue using npm and update both together only during approved implementation.
- `frontend/public/` and `frontend/src/assets/`: keep until the starter assets are proven unreferenced after the new shell replaces the starter screen.
- `backend/` in its entirety: read-only contract authority. Do not modify backend source, migrations, database, tests, configuration, or documentation during frontend implementation unless separately authorized.
- Root project files and `CODEX_FRONTEND_PLANNING_PROMPT.md`: preserve as project/refactor documentation.

No removal is planned initially. Starter assets may be reconsidered only after `rg` confirms they have no references and the user approves cleanup.

## 3. Proposed Final Architecture

```text
frontend/
├── .env.example
├── src/
│   ├── app/
│   │   ├── router.tsx
│   │   └── providers.tsx
│   ├── components/
│   │   ├── ui/                    # Generated shadcn primitives; minimal direct edits
│   │   ├── layout/                # App shell, sidebar, header, mobile navigation
│   │   └── shared/                # Page header, states, badges, pagination, field errors
│   ├── features/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── students/
│   │   ├── programs/
│   │   ├── courses/
│   │   ├── academic-terms/
│   │   ├── course-offerings/
│   │   ├── enrollments/
│   │   ├── grades/
│   │   ├── academic-record/
│   │   └── profile/
│   ├── services/
│   │   └── api/                   # HTTP client, envelope/error types, endpoint services
│   ├── hooks/                     # Cross-feature hooks only
│   ├── types/                     # Backend-aligned shared record and response types
│   ├── test/                      # Test setup and reusable API handlers
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── e2e/                           # One or more critical Playwright flows
└── docs/                          # API map, architecture note, AI log, demo evidence index
```

- `app/` wires global providers and route boundaries.
- `components/layout/` owns application-wide navigation and responsive framing.
- `components/shared/` owns reusable application compositions, not replacements for shadcn primitives.
- `features/` keeps each domain's pages, forms, table definitions, query hooks, and tests together without excessive nesting.
- `services/api/` is the only layer allowed to know raw endpoint strings and transport details.
- `types/` mirrors actual backend records/envelopes; feature-only input/view types stay with their feature.
- `test/` and `e2e/` separate fast mocked integration tests from browser demonstrations.

## 4. Design and Navigation Plan

### App shell

- Use a protected shell with a persistent shadcn Sidebar on desktop, a compact header, breadcrumb, user/role menu, visible theme selector, and one clear page-level primary action.
- On tablet, allow the sidebar to collapse to icons with tooltips. On narrow screens, replace it with a Sheet opened by a labeled menu button; do not merely compress desktop columns.
- Constrain reading/form pages to a comfortable maximum width; allow data-table pages to use the available content width. Use consistent `p-4 md:p-6`, 24-32px section gaps, `text-2xl` page headings, preset radii, 16px icons, and 44px minimum mobile touch targets.
- Use the existing green primary token for primary actions, neutral surfaces for structure, and destructive tokens only for irreversible actions. Status badges must contain text as well as color.

### Role-aware navigation

| Navigation item | ADMIN | STAFF | INSTRUCTOR | STUDENT |
|---|---:|---:|---:|---:|
| Dashboard | Yes | Yes | Yes | Yes |
| Students | Full | Full except hard delete | Assigned only, read-only | Own profile/detail only |
| Programs / Courses / Terms | Manage + delete | Manage, no delete | Read-only reference | Read-only reference only when useful |
| Course Offerings | Manage + delete | Manage, no delete | “My Offerings” | “My Courses” |
| Enrollments | Manage | Manage | Assigned-class roster view | “My Enrollments” |
| Grades | Manage | Manage | Assigned grade workflow | “My Grades” read-only |
| Academic Record | Student selector | Student selector | Assigned-student selector | Own record |
| Profile | Yes | Yes | Yes | Yes |

Menu visibility is only presentation. Every request must still accept and clearly render backend 401/403 decisions.

## 5. Screen / Module Plan

### Login

- **Purpose/roles:** public entry for all four roles.
- **Actions/API:** email/password form; `POST /auth/login`; then `GET /auth/me` to verify/rebuild identity.
- **UI:** Card, Form, Input, Button, Alert, password visibility control.
- **States:** inline 422 field errors; generic 401 “Invalid email or password”; pending lockout; backend-unreachable alert; redirect authenticated users to dashboard.
- **Responsive:** centered single-column card with full-width controls and no protected navigation.

### Dashboard

- **Purpose/roles:** role-specific orientation and quick navigation, not fake analytics.
- **Actions/API:** allowed collection requests with `page=1&per_page=1`, using `meta.total`; student identity bootstrap through role-scoped `/students`; no nonexistent aggregate route.
- **UI:** Card, Badge, Skeleton, Alert, quick-link Buttons.
- **Role content:** admin/staff get operational totals and management shortcuts; instructor gets assigned offerings/students/grades totals; student gets own enrollment/grade totals and Academic Record link.
- **Responsive:** one column on mobile, two on tablet, up to four concise cards on desktop.

### Students

- **Roles:** ADMIN/STAFF manage; INSTRUCTOR sees assigned records; STUDENT sees own record.
- **API:** `GET /students` with `search`, `program_id`, `year_level`, `status`, `sort`, `page`, `per_page`; `POST /students` ADMIN/STAFF; `GET /students/{id}` with object scope; `PATCH /students/{id}` ADMIN/STAFF; `DELETE /students/{id}` ADMIN only.
- **Actions:** search; Program + Status + Year filters; supported sorting; paginated list; view; create/edit for ADMIN/STAFF; deactivate for ADMIN/STAFF; hard delete for ADMIN only after confirmation.
- **UI:** PageHeader, Input, Select/Combobox, Table, DropdownMenu, Badge, Pagination, Sheet/Dialog form, AlertDialog, Skeleton, Alert, toast.
- **States:** debounced search with cancellation; loading rows; “no students yet” versus “no matches”; 409 duplicate/link conflict; 422 mapped fields; 403/404; retryable network/server states.
- **Responsive:** table with horizontal scrolling at medium widths; mobile student cards show number, name, program, year, status, and overflow actions. Filters move into a Sheet while active-filter chips remain visible.

### Programs

- **Roles/API:** all roles may `GET /programs` and `/programs/{id}`; ADMIN/STAFF may POST/PATCH; ADMIN alone may DELETE.
- **Actions:** paginated list, view, create/edit, deactivate, admin hard delete. No unsupported backend search/filter controls.
- **UI/states:** Table/Card, Dialog/Sheet form, Badge, DropdownMenu, AlertDialog, Skeleton, EmptyState, ErrorState, Pagination.
- **Responsive:** compact mobile cards; description can collapse behind detail view.

### Courses

- **Roles/API:** all authenticated roles may GET; ADMIN/STAFF may POST/PATCH; ADMIN may DELETE.
- **Fields/actions:** code, title, description, units (greater than 0 and at most 12), status; create/edit/deactivate/admin delete.
- **UI/states/responsive:** same reusable resource pattern as Programs, with a numeric units input and conflict feedback for duplicate course codes.

### Academic Terms

- **Roles/API:** all authenticated roles may GET; ADMIN/STAFF may POST/PATCH; ADMIN may DELETE.
- **Fields/actions:** academic year, semester, start date, end date, status; enforce end date after start date while preserving backend errors.
- **UI:** Table/Card, Form, Calendar/Date Picker or native date input if simpler and accessible, Badge, Dialog/Sheet, AlertDialog, Pagination.
- **Responsive:** dates remain paired and readable; form becomes one column on narrow screens.

### Course Offerings

- **Roles/API:** scoped `GET /course-offerings`; scoped `GET /course-offerings/{id}`; ADMIN/STAFF POST/PATCH; ADMIN DELETE. `GET /course-offerings/{id}/students` is available to ADMIN/STAFF and the assigned INSTRUCTOR, never STUDENT.
- **Fields/actions:** course, term, instructor ID, section, schedule, room, capacity, status; manage for ADMIN/STAFF; roster for allowed roles.
- **UI:** Table/Card, Combobox for course/term, instructor selector only when an allowed lookup exists, Dialog/Sheet, Tabs for details/roster, Badge, Pagination.
- **States:** missing references (404), invalid instructor role (422), deletion conflict (409), scoped 403.
- **Responsive:** key course/section/schedule first; details and roster stack. Do not show a fake instructor name when it cannot be resolved.

### Enrollments

- **Roles/API:** scoped `GET /enrollments` and `/enrollments/{id}`; ADMIN/STAFF POST/PATCH/DELETE; scoped `GET /students/{studentId}/enrollments`.
- **Actions:** select student and offering, optional enrollment date, ACTIVE/INACTIVE status; list/update/remove; links to student/offering context.
- **UI:** Table/Card, Combobox, date control, Select, Dialog/Sheet, AlertDialog, Badge, Pagination, toast.
- **States:** 404 references; 409 duplicate or capacity; 422 validation; clear note that inactive enrollment is different from hard delete.
- **Responsive:** show student/offering labels when resolvable and IDs only as honest fallback; move secondary fields into details.

### Grades

- **Roles/API:** scoped `GET /grades`, `/grades/{id}`, and `/students/{studentId}/grades`; ADMIN/STAFF and assigned INSTRUCTOR may POST/PATCH; STUDENT read-only. There is no DELETE endpoint.
- **Actions:** enter/update midterm and final grades from 0-100 plus optional remarks up to 100 characters.
- **UI:** Table/Card, Form, numeric Input, Textarea/Input for remarks, Dialog/Sheet, Badge, Alert, toast.
- **States:** 404 enrollment, 409 existing grade, 422 range errors, instructor 403 for another offering.
- **Responsive:** grade entry uses a narrow focused form; student/course context remains visible while editing.

### Academic Record

- **Roles/API:** `GET /students/{studentId}/academic-record`; ADMIN/STAFF any student, INSTRUCTOR assigned students only, STUDENT own record only.
- **Actions:** authorized student selection where possible; read grouped term history; navigate to related details.
- **UI:** PageHeader, student summary Card, term Accordion or stacked Cards, responsive Table, Badge, Skeleton, EmptyState.
- **States:** no terms, missing student, ownership/assignment 403, network/server retry.
- **Responsive:** each term becomes a card; course rows may become stacked records on mobile. Do not calculate GPA because the backend defines no GPA rule.

### Profile / Account

- **Purpose/API:** read-only current account from `GET /auth/me`; display name, email, exact role, status, and timestamps. STUDENT may link to their role-scoped student detail.
- **UI:** Avatar fallback, Card, Badge, Separator, theme control, logout Button.
- **Constraint:** do not show edit-password/profile controls because no self-update endpoint exists.

### 403

- Render backend-denied access with an Alert and safe role-appropriate navigation. Do not automatically reinterpret it as 404 or hide the backend message.

### 404

- Distinguish an unmatched client route from an API record not found. Provide “Back” and dashboard actions.

### Network Error

- Use a shared retryable state that explicitly says the API at the configured base URL cannot be reached. Preserve form input and avoid endless loading. This may be a full-page boundary for session bootstrap and an inline state for individual modules.

## 6. API Integration Plan

### Configuration and client

- Add `frontend/.env.example` with `VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1`. Validate at startup that it is a non-empty URL and strip one trailing slash.
- `services/api/client.ts` owns URL construction, JSON headers, Bearer injection, `AbortSignal`, parsing, 204 handling, and network error conversion. No feature component uses raw `fetch` or literal endpoint roots.
- Model the envelopes as `ApiSuccess<T>`, `PaginatedSuccess<T>`, `ApiFailure`, and `PageMeta`. Keep serialized backend dates as ISO strings at transport boundaries; format only for display.
- Services: `auth`, `users` (admin/reference only), `students`, `programs`, `courses`, `academic-terms`, `course-offerings`, `enrollments`, `grades`, and `academic-record`.
- Use `URLSearchParams` and omit empty values. Query keys include all filters/page values so cancellation and cache separation work correctly.

### Error normalization

- Normalize failures to `{ kind, status, message, fieldErrors, retryable }` while retaining the original backend message.
- 401: clear the token/session once, cancel protected queries, and redirect to `/login?from=...`; avoid redirect loops on the login request itself.
- 403: route-level denial goes to `/403`; action-level denial stays inline/toast so context is not lost.
- 404: record NotFound state; unmatched frontend path uses the client 404 route.
- 409: show the backend conflict message next to the workflow and keep input.
- 422: map `errors` keys to controls; manual backend 422 messages with `errors: null` become a form-level Alert.
- 500+: safe retryable message; never expose stack traces.
- Fetch rejection/timeout: `network` kind and explicit backend-unreachable UI. Aborted/stale requests do not show error toasts.

### API integration map

| Frontend feature | Method and endpoint | Backend scope |
|---|---|---|
| Login/logout/session | POST `/auth/login`, POST `/auth/logout`, GET `/auth/me` | Public login; otherwise authenticated |
| Dashboard counts | GET allowed collections with `per_page=1` | Role-scoped by backend |
| Student management | GET/POST `/students`; GET/PATCH/DELETE `/students/{id}` | Scoped reads; A/S writes; A delete |
| Programs | GET/POST `/programs`; GET/PATCH/DELETE `/programs/{id}` | All read; A/S write; A delete |
| Courses | GET/POST `/courses`; GET/PATCH/DELETE `/courses/{id}` | All read; A/S write; A delete |
| Academic terms | GET/POST `/academic-terms`; GET/PATCH/DELETE `/academic-terms/{id}` | All read; A/S write; A delete |
| Offerings/roster | GET/POST `/course-offerings`; GET/PATCH/DELETE `/course-offerings/{id}`; GET `/course-offerings/{id}/students` | Scoped reads; A/S write; A delete |
| Enrollments | GET/POST `/enrollments`; GET/PATCH/DELETE `/enrollments/{id}`; GET `/students/{id}/enrollments` | Scoped reads; A/S write/delete |
| Grades | GET/POST `/grades`; GET/PATCH `/grades/{id}`; GET `/students/{id}/grades` | Scoped reads; A/S/assigned I write |
| Academic record | GET `/students/{id}/academic-record` | Ownership/assignment scoped |
| Profile | GET `/auth/me` | Current authenticated user |

## 7. Authentication and Authorization Plan

- Store the Bearer access token in `sessionStorage`, not `localStorage`, because the backend has no refresh-token mechanism and the token should not silently persist across browser restarts. Keep the current user in memory/TanStack Query; neither store is an authoritative user database.
- On boot, read the token and call `/auth/me`. Show a bounded session skeleton while checking. A successful response establishes identity; 401 clears storage and shows login.
- Login submits JSON `{ email, password }`, stores `data.access_token`, uses `data.user` immediately, then permits `/auth/me` to remain the canonical session check.
- Logout calls `/auth/logout` with the current token to preserve server revocation. Clear local state afterward even if the network call fails, while explaining that server revocation could not be confirmed.
- `RequireAuth` protects the shell. Route metadata/navigation maps roles to intended UX, but backend responses remain authoritative.
- A student bootstrap query calls scoped `GET /students?page=1&per_page=1` to obtain the linked student record ID; if none exists, show a clear account-linking state instead of building invalid URLs.
- Preserve the intended destination on unauthenticated redirects, but only accept internal paths when returning after login.
- Never decode JWT claims to make authorization decisions: the JWT contains only `sub`, `jti`, and `exp`, while role comes from the returned user record.

## 8. Data, State, Search, Filter, and Pagination Plan

- **Server state:** TanStack Query owns users/current user, students, reference data, offerings, enrollments, grades, and records. Query keys are domain-based and include IDs/query objects.
- **Local UI state:** component state or URL search parameters own open dialogs, selected rows, local form drafts, active tabs, and mobile filter sheets. No general global-state library is needed.
- **Mutation policy:** on success, update a safe item cache when the response contains the complete record, invalidate affected lists/counts/details, and show one concise toast. Enrollment mutations also invalidate offering roster, student enrollment, dashboard, grade eligibility, and academic-record queries. Grade mutations invalidate grade lists/details and academic record.
- **Students query state:** URL parameters store `search`, `program_id`, `year_level`, `status`, `sort`, `page`, and `per_page`. Debounce only search text; reset page to 1 when search/filter/sort changes. Cancel stale requests.
- **Other resources:** store only supported `page` and `per_page` in the URL. Do not add misleading full-dataset search until the backend supports it.
- **Reference data:** request pages up to the backend limit of 100 for selectors, fetch subsequent pages when needed, and never assume the first 100 are complete. Use a paginated selector or “load more” for larger sets.
- Preserve list query state when opening a detail and returning. Clamp a page after deletion if it exceeds the new `last_page`.

## 9. Forms and Validation Plan

- Use React Hook Form with Zod schemas aligned exactly to backend constraints. Client validation is for usability; always submit to and display the backend decision.
- Reusable handling: labeled controls, descriptions only where needed, required indicators, `aria-invalid`, linked error text, pending button text, disabled duplicate submission, preserved values on errors, top-level Alert for non-field errors, and focus on the first invalid field.
- **Login:** valid email; password 8-128 characters.
- **Student:** required number/name/program/year; name limits; optional email/date/contact/address/account link; year 1-6; exact status enum. Edit schema must not submit untouched optional fields as null accidentally.
- **Program:** code 1-30, name 1-150, optional description, status.
- **Course:** code 1-30, title 1-180, units `>0` and `<=12`, optional description, status.
- **Academic Term:** academic year 4-20, semester 1-30, required dates, end strictly after start, status.
- **Offering:** required course/term/instructor IDs, section 1-30, schedule 1-150, room 1-50, capacity 1-500, status. Block a friendly Staff workflow when no authorized instructor lookup exists rather than guessing an ID.
- **Enrollment:** required student/offering IDs, optional date defaulting visibly to today, status. Surface both duplicate and capacity 409 messages.
- **Grade:** required enrollment, midterm/final 0-100, remarks max 100; edit only fields intentionally changed.
- Map backend keys directly where possible. For keys such as `body.field` or `query.page`, normalize to the final relevant segment only when it matches a known form control; otherwise show it in the form Alert.

## 10. shadcn Component Map

| Use case | shadcn component | App component/file |
|---|---|---|
| Desktop navigation | Sidebar, Tooltip, Separator | `components/layout/app-sidebar.tsx` |
| Mobile navigation | Sheet, Button | `components/layout/mobile-nav.tsx` |
| Header/user/theme | Breadcrumb, Dropdown Menu, Avatar, Button | `components/layout/app-header.tsx` |
| Page hierarchy | Breadcrumb, Button | `components/shared/page-header.tsx` |
| Status display | Badge | `components/shared/status-badge.tsx` |
| Tables/actions | Table, Dropdown Menu, Tooltip | feature list/table files |
| Backend pagination | Pagination, Select | `components/shared/data-pagination.tsx` |
| Search/filters | Input, Select, Popover/Command, Sheet | `features/students/student-filters.tsx` |
| CRUD forms | Form, Input, Textarea, Select, Calendar/Popover | feature form files |
| Create/edit workflow | Dialog on desktop, Sheet/Drawer on mobile | `components/shared/responsive-form-shell.tsx` |
| Destructive confirmation | AlertDialog | `components/shared/confirm-action.tsx` |
| Loading | Skeleton | `components/shared/loading-state.tsx` |
| Empty/error/access | Alert, Button, Card | `components/shared/*-state.tsx` |
| Feedback | Sonner | `app/providers.tsx` and mutation hooks |
| Academic record grouping | Card, Accordion, Table | `features/academic-record/academic-record-page.tsx` |

Add primitives only as their phase needs them. Keep Hugeicons because it is the configured shadcn icon library; do not add Lucide solely to follow a generic suggestion.

## 11. File-by-File Implementation Map

| File path | Action | Purpose / main responsibility | Depends on |
|---|---|---|---|
| `frontend/package.json`, `package-lock.json` | MODIFY | Add the justified router/query/form/test packages and test scripts | npm compatibility check |
| `frontend/.env.example` | CREATE | Document public API base URL only | backend prefix |
| `frontend/vite.config.ts` | MODIFY | Keep existing plugins/alias; set dev port 3000 and add test config if separate config is not used | backend CORS origin |
| `frontend/src/main.tsx` | MODIFY | Mount consolidated providers and router | `app/providers.tsx` |
| `frontend/src/App.tsx` | MODIFY | Replace starter screen with route outlet/root boundary only | router |
| `frontend/src/index.css` | MODIFY | Preserve preset; add minimal app-level layout/accessibility rules | existing tokens |
| `frontend/src/app/providers.tsx` | CREATE | Theme, QueryClient, auth, router-adjacent feedback providers | query/auth/Sonner |
| `frontend/src/app/router.tsx` | CREATE | Public login, protected shell, nested pages, 403/404 routes | auth/layout/features |
| `frontend/src/types/api.ts` | CREATE | Envelopes, pagination, errors | backend response helpers |
| `frontend/src/types/domain.ts` | CREATE | Exact serialized User/Student/Program/Course/Term/Offering/Enrollment/Grade types | backend models/serializer |
| `frontend/src/services/api/client.ts` | CREATE | Base URL, Bearer header, parsing, abort, 204, normalized failures | env/auth token accessor |
| `frontend/src/services/api/errors.ts` | CREATE | Failure types and 401/403/422 normalization | backend error envelope |
| `frontend/src/services/api/*.service.ts` | CREATE | One service per backend domain; only location for endpoint strings | client/domain types |
| `frontend/src/features/auth/*` | CREATE | Session context/hooks, login, protected route, role helpers | auth service/router |
| `frontend/src/components/layout/*` | CREATE | Desktop/mobile app shell and role-aware navigation | shadcn/router/auth |
| `frontend/src/components/shared/*` | CREATE | Page/state/pagination/status/confirmation compositions | shadcn primitives |
| `frontend/src/features/dashboard/*` | CREATE | Role-aware real totals and shortcuts | scoped list queries |
| `frontend/src/features/students/*` | CREATE | Core list, filters, details, forms, mutations, tests | student/program/users services |
| `frontend/src/features/programs/*` | CREATE | Paginated list/details/form/actions | programs service |
| `frontend/src/features/courses/*` | CREATE | Paginated list/details/form/actions | courses service |
| `frontend/src/features/academic-terms/*` | CREATE | Paginated list/details/form/actions | terms service |
| `frontend/src/features/course-offerings/*` | CREATE | Scoped offering list/details/form/roster | offering/reference services |
| `frontend/src/features/enrollments/*` | CREATE | Scoped list, create/status/remove workflows | enrollment/student/offering services |
| `frontend/src/features/grades/*` | CREATE | Scoped list and authorized entry/update | grade/enrollment services |
| `frontend/src/features/academic-record/*` | CREATE | Term-grouped aggregate presentation | academic-record service |
| `frontend/src/features/profile/*` | CREATE | Read-only current-account view | auth query |
| `frontend/src/test/*`, feature `*.test.tsx` | CREATE | Vitest setup, MSW envelopes, focused integration tests | services/components |
| `frontend/e2e/*` | CREATE | Critical Playwright login/student flow | live frontend/backend seed |
| `frontend/README.md` | MODIFY | Actual setup, environment, run/build/test, two-app instructions | completed implementation |
| `frontend/docs/API_INTEGRATION_MAP.md` | CREATE | Page -> method/endpoint -> role map | verified backend contract |
| `frontend/docs/ARCHITECTURE.md` | CREATE | Router, client, auth, state, components | final code |
| `frontend/docs/AI_DEVELOPMENT_LOG.md` | CREATE | Prompt/result/human review/evidence log | implementation phases |
| `frontend/docs/DEMO_EVIDENCE.md` | CREATE | Screenshot/evidence checklist without committing secrets | completed demo |
| `frontend/src/components/ui/*` | KEEP / ADD | Keep generated button; generate only needed shadcn primitives | phase component map |
| `backend/**` | KEEP | Authoritative API; no frontend-plan changes | separate backend project |

No `REMOVE` action is approved by this plan. Check starter assets for references after implementation and report them rather than deleting automatically.

## 12. Implementation Phases

### Phase 1 - Project audit and foundation cleanup

- **Files:** package files, Vite config, `.env.example`, current starter/theme files.
- **Tasks:** reconfirm clean frontend baseline; add pinned dependencies; configure port 3000/API environment; fix the existing button lint issue narrowly; add scripts.
- **Dependencies:** backend remains runnable; npm install succeeds.
- **Checkpoint:** dev/build/typecheck/lint all pass; no feature UI yet.
- **Visible result:** starter still renders at `http://localhost:3000` with preserved theme.

### Phase 2 - App shell, routing, and design system

- **Files:** `app/router.tsx`, providers, layout/shared components, required shadcn primitives.
- **Tasks:** protected/public route topology, desktop sidebar, mobile Sheet, header, breadcrumb, theme control, page/state patterns, 403/404/network pages.
- **Dependencies:** Phase 1.
- **Checkpoint:** route navigation and responsive shell tests; direct refresh works through Vite fallback.
- **Visible result:** navigable empty application shell on desktop/mobile.

### Phase 3 - API client and authentication

- **Files:** API types/client/errors/auth service; auth feature; login/profile.
- **Tasks:** exact envelopes, sessionStorage Bearer token, login/me/logout, 401 coordination, protected redirect, role menu.
- **Dependencies:** Phase 2 and reachable API/CORS.
- **Checkpoint:** invalid login, valid four-role login, refresh bootstrap, logout revocation, expired/revoked token.
- **Visible result:** real protected session and role identity.

### Phase 4 - Reference modules

- **Files:** Programs, Courses, Academic Terms, supporting services/forms.
- **Tasks:** paginated lists, details, A/S create-edit-deactivate, A-only deletes, shared states.
- **Dependencies:** auth and common CRUD compositions.
- **Checkpoint:** every role's read scope and write denial; 204/409/422 handling.
- **Visible result:** three working backend-driven reference modules.

### Phase 5 - Student management

- **Files:** Students service/types/list/filters/detail/form/actions/tests.
- **Tasks:** exact query controls, URL state, pagination, CRUD/deactivate/delete, field errors, responsive cards/table.
- **Dependencies:** Programs reference data and auth roles.
- **Checkpoint:** search + three filters + sort + page; create/edit; 409/422; staff/admin/instructor/student behavior.
- **Visible result:** complete core demonstration screen.

### Phase 6 - Academic transactions

- **Files:** Offerings, Enrollments, Grades and reference lookup hooks.
- **Tasks:** scoped lists/details, offering roster, enrollment conflicts/capacity, grade entry/update, dependency invalidation.
- **Dependencies:** reference modules and Students.
- **Checkpoint:** assigned instructor can grade only own offering; student read-only; Staff instructor-lookup blocker handled honestly.
- **Visible result:** end-to-end academic workflow where the contract permits it.

### Phase 7 - Academic record and role views

- **Files:** Academic Record, Dashboard, Profile.
- **Tasks:** grouped term presentation, student-ID bootstrap, real scoped totals, role-specific shortcuts, read-only account view.
- **Dependencies:** Phase 6.
- **Checkpoint:** each role sees only backend-authorized data; no invented GPA/analytics.
- **Visible result:** complete role-specific landing and record views.

### Phase 8 - UX, error, accessibility, and responsive hardening

- **Files:** shared state/layout components and all feature pages.
- **Tasks:** keyboard/focus review, 44px mobile controls, narrow tables/cards, field focus, empty/error differentiation, abort/stale requests, toast consistency.
- **Dependencies:** all screens functional.
- **Checkpoint:** desktop/tablet/mobile manual matrix; keyboard-only critical flows; backend-offline exercise.
- **Visible result:** stable demo-quality UX under success and failure.

### Phase 9 - Testing

- **Files:** test setup, MSW handlers, feature tests, Playwright config/specs.
- **Tasks:** automate auth, student list/form, authorization, enrollment/grade errors, routing, and one critical E2E.
- **Dependencies:** stable UI/API services.
- **Checkpoint:** test/build/typecheck/lint pass and live API smoke test passes.
- **Visible result:** repeatable regression evidence.

### Phase 10 - Documentation and demo readiness

- **Files:** frontend README and `docs/*`.
- **Tasks:** commands/env/CORS, integration map, architecture, AI log, evidence index, rehearse all 20 demo items.
- **Dependencies:** verified final behavior.
- **Checkpoint:** a fresh setup can follow docs; no secrets/screenshots with tokens; every demo item has evidence.
- **Visible result:** submission-ready frontend package and defensible walkthrough.

## 13. Test Plan

### Automated

- **Unit:** query serialization; envelope/204/error parsing; internal redirect sanitization; role navigation mapping; date/grade/form schemas.
- **Component/integration with MSW:** successful/invalid login; protected route; expired-session 401; Student loading/list/search/filter/page/create/edit; 409 and field/form-level 422; 403 action; enrollment duplicate/capacity; grade validation/authorization; network and 500 retry.
- **Routing:** direct nested route, preserved list query, 403, record 404, unmatched 404.
- **E2E with seeded backend:** login as Staff or Admin, load/search Students, create/edit/deactivate a uniquely named test student, and verify real API persistence. Use controlled test data and do not delete shared seed data.

### Manual

- Verify ADMIN, STAFF, INSTRUCTOR, and STUDENT navigation/data/action matrices against actual 401/403 responses.
- Verify 1280px desktop, tablet, 390px mobile, and keyboard-only flows; inspect overflow, dialogs/sheets, focus return, and readable status contrast.
- Stop the backend during list load and form submit; confirm bounded network UI and preserved input.
- Confirm `npm run lint`, `npm run typecheck`, `npm run build`, automated tests, and preview deep links.
- Confirm browser requests use only `VITE_API_BASE_URL`, send Bearer only when authenticated, and contain no backend secret/database access.

## 14. Live Demonstration Map

| # | Page/file | Action | Expected backend/UI result |
|---:|---|---|---|
| 1 | Backend README + terminal | Start preserved API and health check | `/health` succeeds; backend unchanged |
| 2 | `.env.example`, login | Start Vite and show environment | UI uses configured `/api/v1` base; CORS succeeds |
| 3 | `/login` | Submit bad password | Backend 401 shown without clearing inputs |
| 4 | `/login`, `/profile` | Valid login | Token stored for tab session; exact role/name displayed |
| 5 | protected shell | Open protected URL logged out/in | Redirect to login, then safe return after auth |
| 6 | `/students` | Load page | Real scoped `GET /students` data |
| 7 | `/students` | Search by name/number/email | Debounced backend `search` query |
| 8 | `/students` | Filter/sort/change page | Backend query and `meta` drive controls |
| 9 | Student form | Create as A/S | 201 record, refetched list, success toast |
| 10 | Student form | Invalid email/year or link | Backend 422 mapped to field/form Alert |
| 11 | Student detail/form | Edit year/status | PATCH response updates visible record |
| 12 | Student actions | Deactivate; admin delete if safe | Confirmed PATCH or 204; conflict handled |
| 13 | Programs or Courses | Create/edit/deactivate | Real reference CRUD with role controls |
| 14 | Terms + Offerings | Create term/offering as authorized | Valid references; blocker explained if Staff lacks instructor lookup |
| 15 | Enrollments | Enroll student twice | First 201; duplicate 409 clearly explained |
| 16 | Grades | Assigned instructor update | Authorized PATCH succeeds; 0-100 validation shown |
| 17 | Academic Record | Open authorized student | Terms and courses render from aggregate response |
| 18 | Restricted action/URL | Use wrong role | Hidden action UX plus actual backend 403 page/Alert |
| 19 | Any data page | Stop backend and retry | Explicit network state, no infinite loader |
| 20 | Responsive shell + docs | Resize and explain architecture | Mobile navigation works; API/auth/state/AI log are traceable |

## 15. Risks / Unknowns / Blockers

- **Staff instructor lookup blocker:** Staff can write offerings but cannot list users/instructors. Resolve through an authorized backend reference endpoint or an explicitly approved backend response expansion; until then, do not hardcode or guess instructor IDs.
- **Non-admin instructor labels:** offering payloads contain only `instructor_id`, and `/users` is admin-only. Non-admin views need an honest ID/self fallback unless the backend contract changes.
- **Student account linking:** `user_id` is optional, but only ADMIN can list student-role users. Staff can create a student without a link, but cannot provide a safe account selector.
- **CORS/origin:** current backend environment permits `http://localhost:3000`; Vite currently defaults to 5173. The plan aligns Vite to 3000, but runtime use of `127.0.0.1:3000` would still be a different origin and must not be assumed to work.
- **No refresh token:** sessions cannot be silently renewed. Expiry requires login again.
- **No self-profile mutation:** Profile must remain read-only.
- **No dashboard endpoint:** multiple small list requests are acceptable for a lab, but must be bounded and role-scoped.
- **No search/filter for most collections:** only pagination should be offered for those lists unless the backend is separately extended.
- **Hard deletes may conflict:** related records can produce 409. Deactivation is the safer normal action where status exists.
- **Nested frontend Git repository:** decide separately whether it remains independent or becomes a proper submodule/part of the root repository; do not remove `.git` during feature work without approval.
- **Testing stack is absent:** installation versions must be checked for React 19/Vite 8/TypeScript 6 compatibility during Phase 1.

## 16. Final Implementation Checklist

- [ ] API base URL comes only from `VITE_API_BASE_URL`.
- [ ] Vite development origin matches verified backend CORS.
- [ ] All core data comes from the real REST API; no direct database access or hardcoded core records.
- [ ] Exact success, pagination, error, and 204 shapes are handled centrally.
- [ ] Login, `/auth/me`, server-revoking logout, expiry, and invalid sessions work.
- [ ] Protected routes and safe return navigation work.
- [ ] Role-aware navigation matches the verified matrix without being treated as security.
- [ ] Backend 401 and 403 behavior is exercised for real.
- [ ] Dashboard uses only real accessible totals/shortcuts.
- [ ] Students supports backend search, Program/Year/Status filters, supported sort, and pagination.
- [ ] Student create/edit/deactivate and admin-only delete handle 409/422/204 correctly.
- [ ] Programs, Courses, Terms, Offerings, Enrollments, Grades, Academic Record, and Profile are complete within backend capabilities.
- [ ] Staff instructor/account lookup gaps are resolved or visibly documented without guessed IDs.
- [ ] Grade UI has no delete action and enforces the backend 0-100 range.
- [ ] Profile is read-only unless a backend endpoint is separately approved.
- [ ] Every data page has bounded loading, empty, error, network, and success feedback.
- [ ] Forms preserve input, map backend validation, prevent duplicate submits, and focus errors.
- [ ] Desktop, tablet, and narrow mobile layouts are usable; mobile is not just a shrunken table.
- [ ] Keyboard navigation, focus visibility, labels, dialog focus, icon labels, contrast, and non-color status cues pass review.
- [ ] No frontend bundle contains JWT signing secrets, database credentials, service keys, or committed tokens.
- [ ] Server state is not duplicated across disconnected stores; mutation invalidation is verified.
- [ ] Unit/component integration tests and one critical real-backend E2E flow pass.
- [ ] Lint, typecheck, build, preview, and deep-link refresh pass.
- [ ] README, API Integration Map, Architecture Note, AI Development Log, and Demo Evidence are complete.
- [ ] All 20 live demonstration steps have been rehearsed and evidenced.
- [ ] Backend source, migrations, database, and tests remain unchanged.
