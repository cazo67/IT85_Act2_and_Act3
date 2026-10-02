# Demonstration Evidence Checklist

Capture evidence only after exercising the real seeded API. Do not include Bearer tokens or private environment values.

- [ ] Backend health and frontend API base URL
- [ ] Invalid and valid login
- [ ] Protected route redirect and current role
- [ ] Student loading, data, search, filters, sorting, and pagination
- [ ] Student create, backend validation, edit, deactivate/delete confirmation
- [ ] Program or Course management
- [ ] Academic Term and Course Offering management
- [ ] Enrollment success and duplicate/capacity conflict
- [ ] Authorized grade update and unauthorized 403
- [ ] Term-grouped Academic Record
- [ ] Backend-unreachable state and retry
- [ ] Desktop, tablet, and mobile navigation/layout
- [ ] Lint, typecheck, test, and build results

Known contract limitation: Staff cannot query the admin-only user list needed to discover instructor IDs for a friendly offering selector.
