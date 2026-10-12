# Phase 1 implementation plan

Scope: F01-F05 and only the misleading summary/empty states from F11 in `UI_UX_WORKFLOW_REVIEW_PLAN.md`. Findings reconfirmed in the current code. Existing Lab 02 README changes and the review document are preserved.

1. Add a cancellable paginated lookup helper that follows `meta.last_page` using existing list APIs and 100-row pages. Keep existing select controls, add local search, and show loading/error/retry/empty states. Preserve form state and selected IDs; block saves only for unresolved required editable references.
2. Share mutation dependency invalidation for resource lists, lookups, summaries, student selectors and academic records. Add explicit Refresh controls for external changes. No live-sync promise or polling requirement.
3. Use the same lookup helper for the academic-record picker. Distinguish no linked Student profile, no assigned Instructor students, and an empty registrar directory. Render `Not graded` only when the grade itself is absent. Render unavailable dashboard totals honestly with retry.
4. In canonical Lab 02 `app/api.py`, reuse active-enrollment counting; check INACTIVE -> ACTIVE transitions and offering capacity reductions before assigning values. Preserve existing role checks, status types, and API responses. No migration or grading-policy changes.
5. Add focused frontend regression tests for pagination/failure/cancellation, dependent caches, lookup retry/input preservation, totals/remarks/empty guidance; add isolated backend tests for capacity rejection, unchanged state, deactivation, and idempotent activation. Run lint, typecheck, unit tests, build, backend pytest and existing disposable-database E2E; add targeted Phase 1 browser scenarios.

Files: new `src/services/api/query-support.ts` and tests; reusable reference selector and tests; `resource-page.tsx`, `academic-record-page.tsx`, `dashboard-page.tsx` and focused UI tests; Phase 1 E2E tests. Backend: `../lab-02-student-api/app/api.py`, `tests/test_academics.py` only.

Acceptance: records beyond 100 are usable; incomplete lookups never masquerade as empty; retry keeps drafts; related cached views refresh after saves; manual refresh retrieves external changes; zero grades/null remarks and unavailable totals are truthful; sequential capacity transitions cannot overfill a class or silently shrink below active enrollment.

Test safety: backend fixtures create fresh in-memory SQLite databases. Playwright uses only `test-results/e2e-student-api.db` on ports 8100/3100. Snapshot normal database hashes before/after to verify unchanged contents. Do not overwrite env files, seed the normal database, commit, push or deploy.

Rollback: reverse only these scoped hunks/new files after reviewing both repository diffs; retain unrelated user changes. No database schema/data rollback is needed. Generated reports/build outputs are ignored. Do not reset repositories or delete broad paths.

Limitations: loading all lookup pages is appropriate for this small laboratory dataset; large production directories should use server search. Concurrent last-seat transactions and grade edit conflict prevention remain outside Phase 1. Existing permissions and immediate grade visibility remain unchanged.

## Verification results

Completed on 2026-10-05 (Asia/Manila).

| Check | Result |
|---|---|
| `npm run lint` | Passed, including new and updated E2E files |
| `npm run typecheck` | Passed |
| `npm test` | 19/19 passed across 4 files |
| `npm run build` | Passed; existing bundle-size warning remains |
| Lab 02 `.venv\\Scripts\\python.exe -m pytest -q` | 18/18 passed with fresh in-memory databases; dependency deprecation warnings only |
| `npm run test:e2e` | 14/14 passed: all 11 existing scenarios plus 3 Phase 1 regressions |
| Diff checks in both repositories | Passed |
| Normal Lab 02 database SHA256 before/after | Identical: `1A02DC29B7ABB36B1D5EFF58E2B3278918051E1C1A94101F72A48CC0AC1B633B` |

New browser evidence: authorized enrollment 101 is selectable; a program save updates a warm dashboard count without reload; an open Student session retrieves an Instructor grade change through Refresh and displays `No remarks` correctly. Unit tests additionally cover multi-page student selection, lookup failures and retry without losing drafts, selected-ID preservation, query invalidation, zero grades, null/empty remarks, role-specific empty states, and summary recovery. Backend regressions cover full-class reactivation, unchanged rejected state, deactivation freeing a seat, idempotent activation, capacity reduction, and permissions.

The first E2E run exposed two ambiguous preexisting dropdown locators after adding search inputs. Those locators now target combobox roles; no assertions or permission scenarios were removed. The complete rerun passed. Windows logged a non-failing connection-reset message during browser navigation.

Only Phase 1 application/test files and this plan were changed. Existing Lab 02 README edits and the prior review document were preserved. No environment files, normal database contents, grading policies, schema migrations, commits, pushes, or deployments were changed.

Refresh is explicit across separate user sessions; automatic live updates are not implemented. All-page selectors suit the laboratory dataset, not an unlimited production directory. Concurrent last-seat requests remain unverified and are not guaranteed by the sequential capacity checks.
