# Playwright End-to-End QA Report

Date: 2026-09-26  
Command: `npm run test:e2e`  
Environment: Desktop Google Chrome, Lab 03 UI on port 3100, Lab 02 application code on port 8100, disposable migrated and seeded SQLite database

| ID | Feature | Roles | CRUD action | Expected | Actual | Result | Severity |
|---|---|---|---|---|---|---|---|
| AUTH-01 | Authentication | Anonymous | Invalid login | Login is rejected with useful feedback | Error displayed; session not created | PASS | - |
| AUTH-02 | Session lifecycle | Admin | Login, refresh, logout | Session persists on refresh and revoked token fails afterward | Session restored; old token returned 401 after logout | PASS | - |
| CAT-01 | Programs | Admin, Student | Create, read, update, delete | Changes persist and reflect to read-only Student | Full lifecycle and cross-role reflection verified | PASS | - |
| CAT-02 | Courses | Admin, Student | Create, read, update, delete | Changes persist and reflect to read-only Student | Full lifecycle and cross-role reflection verified | PASS | - |
| CAT-03 | Academic Terms | Admin, Student | Create, read, update, delete | Changes persist and reflect to read-only Student | Full lifecycle and cross-role reflection verified | PASS | - |
| ACA-01 | Offerings and Enrollments | Admin, Instructor, Student | Create, read, update, delete | Assignment/enrollment controls visibility and status changes reflect across roles | Full lifecycle, refresh persistence, scoping, and deletion verified | PASS | - |
| GRD-01 | Grades and Academic Record | Instructor, Student | Read and update | Instructor update persists in Student Grades and Academic Record | Updated values appeared after refresh in both Student views | PASS | - |
| PERM-01 | Program permissions | Student | Unauthorized create | UI is read-only and backend denies direct create | Actions hidden; direct request returned 403 | PASS | - |
| PERM-02 | Student-record permissions | Student | Unauthorized read | Student cannot fetch another student's record | Direct request returned 403 | PASS | - |
| PERM-03 | User permissions | Staff | Unauthorized read | Staff cannot access admin-only users endpoint | Direct request returned 403 | PASS | - |
| STU-01 | Students | Admin, Staff, Student | Create, read, update, deactivate, delete | Changes persist for authorized roles and remain hidden from unrelated Student | Lifecycle, duplicate rejection, role reflection, refresh, and cleanup verified | PASS | - |

## Summary

- Total tests: 11
- Passed: 11
- Failed: 0
- Blocked: 0

## Failed Major Workflows

None in the final run.

## Notes

- Grade deletion is not tested because the backend intentionally exposes no grade-delete endpoint and the UI has no grade-delete action.
- User management is API-only and has no Lab 03 page, so the suite checks its authorization boundary rather than inventing UI CRUD.
- The suite recreates `test-results/e2e-student-api.db` and does not use or change Lab 02's normal `student_api.db`.
- Screenshots, video, traces, console errors, and failed network requests are retained on failures. The HTML report is generated under `playwright-report/`.
- Windows may log a non-failing `ConnectionResetError` when browser navigation cancels an in-flight request; it did not fail a workflow in the final run.
