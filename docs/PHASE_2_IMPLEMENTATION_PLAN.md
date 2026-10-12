# Phase 2: connected school tasks

Date: 2026-10-06 (Asia/Manila). Scope: F06-F08 of the UI/UX review. Preserve all Phase 1 work and unrelated Lab 02 README edits. No grade approval, policy changes, migrations, environment changes, normal database writes, commits or deployments.

1. Add an offering workspace using existing scoped offering, roster, enrollment and grade APIs. Load complete authorized collections and join by offering/student/enrollment IDs. Show course, term, section, instructor, student number/name, enrollment status and grade presence. Reuse a contextual grade dialog for Create/Edit without exposing unrelated enrollments.
2. Add a student workspace using the existing academic-record aggregate, plus student-specific links to enrollment creation and academic history. Keep student context in the URL and enforce all deep links through backend ownership/assignment checks.
3. Improve grade-list and offering selector labels using existing authorized lookups; keep enrollment IDs alongside student/course/term context. Add links from resource views into workspaces.
4. Add Admin-only Users UI using existing POST/GET/PATCH contracts. Passwords are form-only, blank on edit, never in rows or response rendering. Offer Admin role-filtered student-account choices; Staff retains the existing verified-ID linking path with clearer guidance.
5. Add a minimal paginated GET `/directories/instructors` endpoint in canonical Lab 02, accessible only to Admin/Staff and exposing `id`, `name`, `role`, `status`. This resolves the required Staff assignment task without granting `/users` access or exposing emails/passwords. Use it for named instructor selectors and Admin/Staff class headers. Include inactive instructors with explicit status labels to preserve existing assignment semantics; no new active-status policy.
6. Add role-specific navigation labels and dashboard task links while retaining permitted catalog browsing. Guard Users and roster routes by role in the frontend, with server checks remaining authoritative.

Files: router/navigation/dashboard/resource/academic-record pages; new `features/workflows` and `features/users` components; API workspace/directory services and cache dependencies; focused frontend, backend and browser tests; API map. Backend changes stay in Lab 02 `app/api.py` and isolated tests.

Acceptance: an Admin provisions/links a Student account that sees only its record; Staff assigns an instructor by name while `/users` remains forbidden; assigned Instructor opens a class and creates or edits the intended student's grade; Student sees persisted values in Grades/Academic Record after refresh; deep-linked student context survives refresh; unrelated instructors/students are denied. Lookup failures must not create grade actions from incomplete joins.

Verification: frontend lint/typecheck/unit/build; all backend in-memory tests; existing disposable-database E2E plus Phase 2 scenarios for provisioning/linking, Staff assignment, roster grade creation/editing and forbidden deep links. Snapshot the normal Lab 02 database hash before/after. Test users cannot be deleted with the existing API: create them only in the disposable E2E database, deactivate after tests, and recreate the database on the next run.

Rollback: reverse only Phase 2 hunks/new files after reviewing repository diffs. Preserve Phase 1 and user edits. No database schema rollback is required. Complete collection joins are suitable for the lab dataset; server-side roster joins/search remain a future scaling option.

## Results

Implemented the connected offering/student workspaces, contextual grade creation/editing, Admin account management and student-account linking, named instructor selection, role-specific task navigation, URL-preserved academic-record context, and the restricted Lab 02 instructor directory. Existing components, scoped API permissions and Phase 1 behavior were retained.

Verification completed:

- Frontend lint, type checking and production build passed; 30 unit tests passed across 6 files.
- Lab 02 backend: 21 tests passed using disposable in-memory databases.
- Full isolated browser suite: 16 tests passed, including all existing scenarios and two new Phase 2 scenarios. Verified Admin provisioning/linking, Staff named instructor assignment without Users access, Instructor roster grade creation/editing, Student grade/academic-record reflection, refreshed deep links and denied unrelated records/rosters.
- The initial new browser-test fixture name mismatch was corrected; the complete clean-database rerun passed.
- Normal Lab 02 database SHA-256 remained `1A02DC29B7ABB36B1D5EFF58E2B3278918051E1C1A94101F72A48CC0AC1B633B`. No environment files, migrations, commits, pushes or deployments were made. Unrelated backend README changes were preserved.

Remaining limitations: collection joins target lab-sized datasets; Staff student-account linking remains Admin-assisted/verified-ID rather than granting access to the full Users directory. Cross-session updates require refresh. Grade approval and later-phase mobile/accessibility improvements were not added. The existing build chunk-size warning and backend dependency deprecation warnings are non-blocking.
