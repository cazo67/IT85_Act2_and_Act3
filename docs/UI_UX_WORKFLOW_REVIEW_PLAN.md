# Lab 03 UI/UX and School Workflow Review Plan

Date: 2026-10-05 (Asia/Manila)  
Reviewed frontend commit: `edb57b822c6428838eb127bd45eba9cc2a28353a`  
Status: audit and proposed plan only; no application changes implemented.

## 1. Assessment and evidence boundaries

The core laboratory workflows work: authentication, role-scoped CRUD, enrollment visibility, instructor grade updates, and student academic records. The next improvement is to connect the existing resource pages into understandable school tasks. Passing CRUD tests does not establish completeness for everyday registrar or instructor use.

This review inspected Lab 03 routes, navigation, forms, query caching, API services, types, UI primitives, and existing E2E tests, plus the canonical sibling Lab 02 routes, schemas, models, and relevant backend tests. Lab 03 remains the frontend; backend recommendations belong in `../lab-02-student-api`.

Evidence labels used below:

- **Source-confirmed:** directly visible in the inspected code; new runtime reproduction was not performed in this audit.
- **Previously runtime-verified:** the preceding verification in this conversation passed lint, type checking, 6 unit tests, build, and 11 desktop Chrome E2E tests on 2026-10-05. These checks were not rerun for this document. The checked-in `QA_REPORT.md` separately records the older 2026-09-26 run.
- **Proposed:** a usability improvement or school-policy-dependent extension, not proof of a laboratory defect.
- **Needs verification:** browser behavior, assistive technology, concurrency, or policy that source inspection cannot establish alone.

No new browser/mobile/accessibility test was executed in this audit. No normal database was mutated. The laboratory rubric and institution-specific grading/registration rules were not supplied, so this report does not claim missing optional features violate the assignment or a universal school standard.

## 2. Current role workflows

| Role | Current supported path | Main friction or missing connection |
|---|---|---|
| Admin | Manage programs, courses, terms, students, offerings, enrollments, and grades; view academic records | User creation/editing is API-only; account linking and instructor assignment require numeric IDs. No linked student workspace or class roster page. |
| Staff | Create/edit academic resources and students; create/edit/delete enrollments; create/edit grades; view records | Cannot list users, yet forms require instructor/student-account IDs. Academic work is spread across separate generic lists. |
| Instructor | Read assigned offerings, enrollments, and students; create/edit grades for assigned enrollments; view scoped records | Starts from generic lists, then selects `Enrollment #n`; no offering-to-roster-to-grade workspace or pending-grades view. |
| Student | Read own student/enrollment/grade/offerings data, browse catalogs, view own term-grouped academic record and account | Same navigation labels as staff; grade list lacks student-readable course/term context. Profile is an account card, not an academic overview. |

Evidence: `src/app/router.tsx:27`, `src/components/layout/app-shell.tsx:21`, `src/features/resources/resource-definitions.ts:68`, and Lab 02 `app/api.py` role checks. All sidebar items currently omit the optional `roles` property; role-aware write buttons and server scoping still apply. Visible catalog links for students are not an authorization defect.

## 3. Grade and enrollment reflection map

| Change | Persistence / authorized readers | Current UI evidence | Remaining concern |
|---|---|---|---|
| Assign instructor to offering | Offering stores `instructor_id`; assigned instructor can read it | Existing offering/enrollment E2E changes roles and verifies visibility | Staff must supply instructor ID manually; offering list does not show instructor or room |
| Enroll student in offering | Enrollment links student and offering; student sees own classes and enrollments | Existing E2E verifies appearance, status changes, and deletion across roles | Offering chooser shows section/ID rather than full course and term; no linked student registration screen |
| Instructor updates grade | Grade is linked to enrollment; server checks instructor assignment and commits values | Existing grade E2E edits 88.25/91.75, reloads, signs in as Student, and verifies Grades and Academic Record | This proves persisted reads after reload/login, not automatic updates in an already-open second user's tab |
| Read academic record | Backend aggregates student -> enrollments -> offering/course/term -> optional grade | UI renders term groups and courses | Student picker stops at 100 for Admin/Staff/Instructor; empty remarks incorrectly produce `Not graded` |

Evidence: `e2e/cross-role/academic-workflows.spec.ts:19`, `:155`; Lab 02 `app/api.py:337`, `:383`, `:459`, `:478`, `:500`; `src/features/academic-record/academic-record-page.tsx:11`.

Current grade values are visible to authorized readers after saving and fetching them. There is no draft, submission, approval, release, or lock state. Do not insert approval or hide student grades without an agreed policy and corresponding backend behavior.

## 4. Prioritized findings

Priority: **P1** = correctness or a major task obstacle; **P2** = meaningful usability/reliability improvement; **P3** = optional extension. Priority is for follow-up work, not a claim that the laboratory submission fails.

### F01 — Reference selectors and academic-record picker stop at 100 (P1)

**Classification:** source-confirmed frontend completeness defect.

`ResourcePage` fetches only `{page: 1, per_page: 100}` for each lookup. `AcademicRecordPage` does the same for students. Records outside that first page cannot be selected there; existing rows can fall back to bare IDs. The seeded 200 enrollments already exceed the grade lookup's maximum fetch size, although the previous grade E2E uses enrollment 1.

Evidence: `src/features/resources/resource-page.tsx:181`, `:230`; `src/features/academic-record/academic-record-page.tsx:11`; backend paginated list endpoints and `app/seed.py`.

**Proposed response:** for this school project, use a reusable paginated selector that follows response metadata and supports local search once loaded, or a server-backed searchable picker where supported. `/students` already supports search; other lists do not currently expose search/filter contracts. Avoid silently sending unsupported filters or issuing a request per row.

**Acceptance:** select an authorized student/enrollment beyond record 100; selected edit values remain visible; lookup pagination, loading, empty, and error states are explicit; permissions remain server-enforced.

### F02 — Lookup errors silently become empty choices (P1)

**Classification:** source-confirmed frontend error-state defect.

Only the main list's loading/error states are rendered. Failed or unfinished lookup queries become `[]`, so required selects appear empty and reference cells show IDs without explaining whether records are absent or unavailable.

Evidence: `src/features/resources/resource-page.tsx:176`, `:186`, `:134`, `:256`.

**Proposed response:** report loading/error per required dependency, provide retry, and disable submission only when the necessary reference cannot be validated. Preserve typed values on retry.

**Acceptance:** a failed offering lookup is distinguishable from no offerings, retries without closing the form, and does not silently remove a selected existing value.

### F03 — Mutation refresh covers only the edited resource (P1)

**Classification:** source-confirmed cache dependency gap; visible timing needs reproduction.

Success handlers invalidate `[definition.key]` only. Dashboard totals use `["dashboard", key]`, reference data uses `["lookup", source]`, the student picker uses `["record-students"]`, and records use `["academic-record", studentId]`. These keys are not invalidated by the current resource mutations. Default stale time is 30 seconds, lookup stale time 60 seconds, and focus refetch is disabled. A quick return to an already-cached view can display old data; stale time alone does not periodically refresh an open page.

Evidence: `src/features/resources/resource-page.tsx:102`, `:199`; `src/app/providers.tsx:10`; `src/features/dashboard/dashboard-page.tsx:22`; `src/features/academic-record/academic-record-page.tsx:11`.

**Proposed response:** centralize a dependency map. Grades invalidate grade lists, affected academic records, and grade summaries; enrollments invalidate enrollment lists/lookups, related record views and offering/enrollment summaries; student edits invalidate student lists/lookups/record selectors and related records; catalog edits refresh their labels wherever used. Start with safe targeted/prefix invalidation, not a new state framework. Add a visible refresh/last-updated affordance for users reading externally changed data; choose whether focus refetch or light polling is appropriate.

**Acceptance:** visit dependent views before a mutation, save a change, then return within 30 seconds and see correct values without logout/reload. Separately test two simultaneous role sessions; define the refresh action or interval explicitly rather than promising real-time synchronization.

### F04 — Enrollment reactivation bypasses capacity validation (P1)

**Classification:** source-confirmed backend consistency defect; browser reproduction not performed.

Create checks the active enrollment count against capacity. Updating enrollment status assigns the new status directly without that check. A class can fill after a student becomes inactive, then reactivation can exceed its advertised capacity. Offering updates can also reduce capacity below the current active count.

Evidence: Lab 02 `app/api.py:392`, `:411`, `:366`. Existing `tests/test_academics.py` covers duplicate/reference/grade cases, but does not establish capacity handling for reactivation or capacity reduction.

**Proposed response:** enforce capacity when transitioning INACTIVE -> ACTIVE and validate proposed offering capacity reductions. Preserve the old state on rejection and show the server conflict in the UI. Keep any override as an explicit future policy, not a hidden bypass.

**Acceptance:** with a full class, reactivation fails with a useful conflict; repeated ACTIVE -> ACTIVE updates do not wrongly fail; deactivation releases a seat; capacity reduction cannot silently overfill the class. Verify simultaneous last-seat enrollment separately before promising concurrency safety.

### F05 — Empty remarks are mislabeled as missing grades (P2)

**Classification:** source-confirmed frontend display defect.

The academic record renders `item.grade?.remarks ?? "Not graded"`. Remarks are optional, so a real grade with numeric midterm/final values and `remarks: null` is labeled `Not graded`. An empty string is also visually unhelpful.

Evidence: `src/features/academic-record/academic-record-page.tsx:20`; Lab 02 `app/schemas.py` `GradeIn`/`GradeUpdate`.

**Proposed response:** derive grading presence from whether the grade exists. Show a neutral dash or `No remarks` for empty remarks on an existing grade and `Not graded` only when the grade is absent. Do not calculate pass/fail without an agreed grading scale.

**Acceptance:** grade absent, grade with null remarks, grade with empty remarks, and zero-valued grades all display accurately.

### F06 — Grade entry lacks student/course context and a class roster path (P1)

**Classification:** source-confirmed major usability gap, not broken persistence.

Grade tables and selectors show `Enrollment #n`; offering labels show only offering ID and section. The operator must mentally join records and can easily choose the wrong enrollment. `academicService.offeringStudents`, `studentEnrollments`, and `studentGrades` exist, but no screen calls them. Offering View opens a generic details dialog without a roster action.

Evidence: `src/features/resources/resource-page.tsx:50`, `:57`, `:276`; `src/features/resources/resource-definitions.ts` grade/offering definitions; `src/services/api/services.ts:54`.

**Proposed response:** add a focused offering workspace: course + term + section + instructor header, authorized student roster, enrollment status, grading presence, and per-student Create/Edit grade. Add links from the offerings list and student details. Keep the generic catalog pages and existing permissions.

**Backend boundary:** `/course-offerings/{id}/students` returns paginated Student objects, not enrollment IDs or grades. Correct grade actions require an enrollment mapping; the existing `/enrollments` list has no offering filter. For small datasets, consume all authorized pages and join by offering/student/enrollment ID. Prefer a reviewed paginated roster contract including enrollment and grade IDs if this becomes unwieldy. Do not assume the existing student-only roster endpoint is sufficient or broaden instructor data access.

**Acceptance:** instructor chooses their class, identifies a student by number/name, sees course/term/section before saving, creates a grade only for an ungraded enrollment, and edits an existing grade otherwise. Student sees the result in both grade and academic-record views after the agreed refresh. Another instructor and unrelated student cannot access the same records.

### F07 — Account provisioning and instructor assignment are API-only (P2)

**Classification:** frontend capability gap plus Staff backend directory limitation.

`usersService` exists but there is no Users route/page. Student linking uses a numeric `user_id`; offerings require a numeric `instructor_id`. Staff cannot GET `/users`, despite being allowed to create students/offerings. The current instructional notes send operators to the Users API.

Evidence: `src/app/router.tsx:27`; `src/features/resources/resource-definitions.ts` student and offering fields/notes; `src/services/api/services.ts:43`; Lab 02 `app/api.py:132`, `:138`, `:152`, `:84`, `:96`.

**Proposed response:** add an Admin-only Users screen for existing create/read/update contracts, including password handling specific to user creation/reset rather than the generic `User` response type. Provide role-filtered named instructor/student account choices for Admin. Keep Staff directory access restricted until a minimal directory endpoint or Admin-only assignment workflow is chosen. Do not expose the full user-management endpoint to Staff.

**Acceptance:** Admin provisions a STUDENT account, links it to the correct record, and the new student signs in to see only their data. Admin assigns an INSTRUCTOR by name and that instructor sees the assigned class. Staff sees a clear permitted assignment path. No password/hash appears in list rows, logs, or success messages.

### F08 — Navigation and task entry points are generic (P2)

**Classification:** usability enhancement, not an authorization bug.

All sidebar labels are shared across roles. Instructor dashboard quick action leads to Students rather than My Classes; student menus still say Students, Enrollments, Grades. Student details offer no links to registration/history and selection is not carried into Academic Record.

Evidence: `src/components/layout/app-shell.tsx:21`, `:40`; `src/features/dashboard/dashboard-page.tsx:20`, `:24`; `src/features/resources/resource-page.tsx:276`; `src/features/academic-record/academic-record-page.tsx:12`.

**Proposed response:** keep permitted catalog access, but group navigation by task and use My Classes/My Enrollments/My Grades for scoped users. Add instructor class entry, registrar registration entry, and a student profile workspace with links retaining student context in the URL. Ensure deep links still get backend ownership checks.

**Acceptance:** each role can reach its primary task directly from the dashboard; student/history links open the correct authorized student and survive refresh; nonpermitted management actions remain unavailable.

### F09 — Accessible forms and mobile navigation need follow-up (P2)

**Classification:** source-confirmed omissions; full accessibility conformance unverified.

Labels are linked to generated control IDs, generic resource controls set `aria-invalid`, and dialogs use Radix. However, `Field` error paragraphs have no IDs or `aria-describedby` association. Login error fields do not explicitly set `aria-invalid`. The mobile drawer is a custom overlay without dialog semantics, focus containment/restoration, Escape handling, or background inertness in its code.

Evidence: `src/components/ui/primitives.tsx:82`; `src/features/auth/login-page.tsx`; `src/components/layout/app-shell.tsx:53`.

**Proposed response:** associate inline errors with controls, focus the first invalid field appropriately, and use the existing dialog system for the mobile drawer. Add a skip-to-content link and meaningful row-specific action names. Target 44px touch controls as a usability preference, without claiming every current 32/36px button fails WCAG: the WCAG 2.2 AA target-size minimum is 24px with defined exceptions.

**Acceptance:** keyboard users open/close the drawer, stay within it while open, and return to the trigger; Escape works; error descriptions are associated with inputs; dialogs/forms remain usable at 320/390/768px and 200% zoom. Validate contrast and screen-reader announcements separately.

Guidance: [W3C focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html), [W3C error identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html), [W3C target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html). These guide the proposed tests; this audit is not a WCAG certification.

### F10 — Destructive actions and unsaved changes need clearer safeguards (P2)

**Classification:** source-confirmed interaction gaps.

Create/edit Save is disabled while pending, but row delete/deactivate controls do not reflect `actionMutation.isPending`. Native confirmations identify only the resource type, not the student/course/section. Dialog close/cancel can discard edited values with no dirty check, and can close while saving. View/Edit use list-row snapshots even though `.get(id)` is available.

Evidence: `src/features/resources/resource-page.tsx:95`, `:193`, `:263`, `:269`, `:276`.

**Proposed response:** identify the exact record in confirmation, show row-level pending state, protect dirty forms, and reconcile save results after closing. Refetch detail when opening critical grade/student editors. Preserve server conflicts for records in use. Use enrollment deactivation as the normal reversible action where policy agrees; do not invent grade deletion.

**Acceptance:** rapid repeated clicks send one intended row action; cancellation sends no mutation; unsaved form exit requires an explicit discard; stale/not-found details produce a recoverable message.

### F11 — Academic pages need truthful empty/error states and useful context (P2)

**Classification:** source-confirmed presentation gaps plus optional enhancements.

Dashboard errors can display `0` because missing totals fall back to zero. The academic record's no-students message says `No linked student record` even for Staff/Instructor. Academic records omit units, enrollment status, room/schedule, and instructor context even though several fields are available in the aggregate. They cannot distinguish inactive historical enrollment from current registration visually.

Evidence: `src/features/dashboard/dashboard-page.tsx:24`; `src/features/academic-record/academic-record-page.tsx:20`; `src/types/domain.ts` `AcademicRecord`.

**Proposed response:** show unavailable totals as unavailable, role-specific empty guidance, units and enrollment status, and a clean print layout if requested. Replace backend-focused UI wording with school task language while retaining technical details in documentation.

**Acceptance:** a failed count does not imply zero students/grades; an instructor with no class gets assignment guidance; a linked student with no enrollments sees a distinct empty state; inactive registrations are labeled; printouts are not called official transcripts without school approval.

### F12 — Student search URL state may be overwritten on back navigation (P2, needs verification)

`searchDraft` initializes from the URL once; the debounce effect compares it to URL search and can write the draft back after navigation changes. Source inspection suggests browser back/forward or reused resource route state can restore a filter then immediately overwrite it. This was not reproduced in this audit.

Evidence: `src/features/resources/resource-page.tsx:156`, `:214`; `src/app/router.tsx` `ResourceRoute`.

**Proposed response:** verify back/forward and module switching first, then synchronize input and URL without debounce loops. Also validate malformed numeric page parameters rather than forwarding NaN.

**Acceptance:** searching A then B and navigating Back restores A in both input and results; switching modules does not leak student filters; malformed page URLs recover predictably.

## 5. School-policy-dependent extensions (P3 unless adopted)

These are reasonable discussion topics, not mandatory fixes or inferred institutional standards:

| Extension | Current limitation | Decision needed before implementation |
|---|---|---|
| Midterm-only grade entry | New `GradeIn` and database require both midterm and final; frontend requires both | Should an instructor enter a midterm before a final exists? If yes, backend nullable/partial lifecycle changes are needed; do not use zero as a placeholder |
| Grade submit/review/release/lock | Grade writes become readable immediately; no approval fields, endpoints, editor history, or locks | Who approves, when students see grades, Staff authority, rejection/reopening rules, and treatment of existing grades |
| Grade-change history and conflict protection | Timestamps exist, but no before/after actor log or optimistic concurrency check | Minimum audit history and edit-conflict behavior required by the school |
| Registration/drop/withdraw/completion states | Enrollment uses ACTIVE/INACTIVE only; roster lists include inactive entries | Meaning of inactive, whether grading inactive enrollment is allowed, and whether history remains visible |
| Current term, registration windows, active-reference rules | Term dates/status exist but do not enforce registration windows; referenced student/course/offering status is not consistently checked on enrollment | Whether inactive/closed offerings accept enrollment, how historical records differ from current work, and override authority |
| Schedule conflict detection | `schedule` is free text | Prefer a readable timetable first; structured days/times and conflict rules require backend design |
| GPA/pass-fail/transcript | Numeric scores and units exist without an institutional conversion/weighting policy | School grading scale, repeated courses, incomplete grades, and official document requirements |
| Account recovery | No self-service profile/password-change/recovery endpoint | An Admin-assisted reset may suffice for the lab; self-service recovery is a separate backend feature |

Do not add fees, admissions, attendance, messaging, parent portals, LMS features, or extensive analytics without a separate requirement. They are outside the inspected student-information scope.

## 6. Phased implementation proposal

Implementation begins only after this plan is reviewed. Keep Lab 02 and Lab 03 as separate repositories and retain the existing business flow and visual system.

### Phase 1 — Correctness and honest feedback

Address F01-F05 and the misleading dashboard/empty messages from F11. Centralize reference loading and mutation dependency invalidation; fix remark semantics; plan and implement capacity validation in Lab 02 with appropriate backend tests.

Likely frontend files: `resource-page.tsx`, `academic-record-page.tsx`, `dashboard-page.tsx`, `services.ts`, and a small reusable query/reference helper. Backend scope: `app/api.py`, relevant schemas only if needed, and `tests/test_academics.py`.

Exit criteria: records beyond 100 are selectable, required lookup failures are recoverable, dependent cached views reflect mutations, grade-presence labels are truthful, and capacity transitions preserve the agreed limit. Existing 11 E2E scenarios still pass.

### Phase 2 — Connect existing school tasks

Address F06-F08: offering detail/roster workspace, student detail links, contextual grade entry, role-specific dashboard entry points, and Admin user provisioning. Prefer existing APIs first. Review the roster contract and Staff directory approach before adding backend endpoints; retain existing permission boundaries.

Exit criteria: Admin can provision/link an account; Staff has a permitted assignment path; instructor can select a class and grade the intended student with full course/term context; student can identify the course behind each grade. Add grade creation coverage, not only grade editing.

### Phase 3 — Accessibility, responsive use, and recovery

Address F09-F12, error associations, drawer focus, meaningful confirmations, pending row state, dirty forms, numeric URL handling, and academic presentation. Use existing Radix components and shared UI primitives.

Exit criteria: keyboard-only use of navigation and forms works; 320/390/768/1440px layouts and 200% zoom keep essential actions reachable; wide tables scroll inside their containers; failed requests keep user input; browser back/forward preserves search. Confirm contrast and screen-reader behavior manually. Avoid a full redesign.

### Phase 4 — Adopt only agreed school policies

Select from Section 5. Design backend contracts/migrations before the UI depends on them. If grade approval is adopted, specify state transitions, authorization, locking, student visibility, rejection reasons, existing-grade backfill, and audit history first. A browser-only approval badge cannot enforce this workflow.

Exit criteria: policy decisions are recorded, backend permissions/state transitions have tests, and the frontend exposes only supported operations. If these policies are not adopted, stop after Phase 3 and describe immediate grade visibility accurately.

## 7. Verification plan and unverified items

Use the disposable migrated/seeded backend defined by `playwright.config.ts` and `e2e/scripts/start-test-backend.ps1`, or a separate explicitly isolated fixture database. Do not run new CRUD audit checks against the normal Lab 02 database.

| Scenario | Expected proof | Current status |
|---|---|---|
| Existing authentication/catalog/student/enrollment/grade E2E | 11 scenarios still pass | Passed earlier in this conversation; not rerun for this document |
| Grade creation for ungraded assigned enrollment | Correct student/course selected; new grade persists and appears to student | Missing from existing UI E2E; backend creation has a unit/API test |
| More than 100 students/enrollments | Selector/academic-record access beyond first page; no dropped edit value | Not covered by existing E2E |
| Lookup loading/error/retry | Empty vs failed data distinguished; inputs preserved | Not browser-verified |
| Warm-cache dependent views | Totals/lookups/records refresh after related mutation within stale window | Not covered by existing E2E |
| Two open Instructor/Student sessions | Defined refresh action/interval updates student without relogin | Existing test switches roles in one page; simultaneous sessions not covered |
| Capacity on reactivation/reduction | Full-class transition rejects safely; valid transitions work | Source-confirmed gap; new runtime test needed |
| Null/empty remarks with real grade | Numeric grades displayed without false Not graded label | Source-confirmed gap; new display check needed |
| Account creation/linking | Student own-record scoping and assigned instructor visibility | UI unavailable today |
| Mobile/keyboard/errors/zoom | Accessible navigation and essential tasks at stated widths | New checks required; current project has desktop Chrome only |
| Inactive/closed-term/partial-grade behavior | Matches explicitly agreed school rules | Policy unresolved |
| Concurrent capacity and grade edits | No unintended overbooking/lost-update behavior | Not established by current tests |

Run lint, type checking, unit tests, build, and existing E2E after future implementation; add focused tests for changed behavior rather than duplicating every UI field. Preserve server tests for unauthorized instructor/student access. Capture new manual/browser evidence separately from source-confirmed observations.

## 8. Recommended first scope

Start with Phase 1, then the instructor class roster and contextual grade entry from Phase 2. These directly improve correctness and the user's example of grades reflecting to students while preserving the working laboratory foundation. Keep approval/GPA/registration policy extensions as explicit choices.
