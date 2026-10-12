# Phase 3: accessibility, responsive use and recovery

Date: 2026-10-06 (Asia/Manila). Scope: F09-F12 of the UI/UX review, preserving Phases 1-2 and unrelated local work. Frontend only; no policy changes, backend changes, migrations, environment changes, normal database writes, commits or deployments.

## Verified findings and implementation

1. Shared Field errors have no control association. Add stable error IDs, aria-describedby/aria-invalid and accessible validation feedback; retain React Hook Form's first-invalid focus and focus server-invalid fields in resource forms.
2. The mobile navigation uses a custom overlay. Reuse Radix dialog focus containment, Escape handling and trigger restoration; add an accessible title, close control and skip-to-content link.
3. Resource actions have generic confirmations and no pending lock. Include record identity, disable pending actions and prevent duplicate submissions. Fetch current detail before critical resource/user editors; expose recoverable loading/error states.
4. Resource/account/roster-grade forms can discard drafts. Reuse a protected dialog that requests explicit discard, prevents closing while saving and warns on browser unload. Preserve typed input after failed saves. Do not introduce registration/deactivation policies.
5. Search draft debounce can overwrite history-restored URL filters; numeric URL values can become NaN/fractions. Debounce user edits only, cancel on navigation, derive restored input from URL, isolate resource-route state and validate positive safe integers.
6. Academic aggregate already includes units, enrollment status, schedule and room. Present those without inventing instructor names, GPA, approval or transcript status. Add an explicit student-selection prompt.
7. Keep layouts bounded, scroll wide tables within keyboard-accessible named containers, wrap action groups, and improve touch target sizes without redesigning the visual system.
8. Full E2E verification reproduced a navigation recovery race: interrupted startup account checks could clear the stored session. Cancel obsolete checks and ignore their completion; scope late 401 handling to the token that sent the request. Keep current-token 401 revocation and backend permission checks intact. Cover Strict Mode cancellation and replaced-session failures with regression tests.

Implementation references: `src/components/ui/primitives.tsx`, `protected-dialog.tsx`, `use-server-errors.ts`, `button.tsx`; `src/components/layout/app-shell.tsx`; `src/features/resources/resource-page.tsx` and `url-state.ts`; Users, GradeDialog, offering/student workspace and academic-record pages; `src/app/router.tsx`. Regression coverage lives in `src/components/ui/accessibility.test.tsx`, `src/features/resources/phase-three.test.tsx`, the existing workflow tests and `e2e/phase-three/accessibility-recovery.spec.ts`.

Rollback: review and reverse only Phase 3 hunks/new files. Keep all Phase 1-2 changes and pre-existing backend/README edits. No database schema rollback is needed.

## Acceptance and verification

Add focused unit coverage for error associations, dirty/pending close guards, URL numbers/search history, fresh editor errors, and academic presentation. Add isolated browser scenarios for keyboard drawer focus/Escape/restoration, validation, cancellation/pending recovery, back/forward search, layouts at 320/390/768/1440px and a 200%-scale equivalent. Run lint, type checking, unit tests, build, all isolated E2E and disposable backend regression tests. Check the normal database SHA-256 before/after (baseline: `1A02DC29B7ABB36B1D5EFF58E2B3278918051E1C1A94101F72A48CC0AC1B633B`).

Screen-reader speech and full contrast/accessibility conformance require separate manual validation; browser/DOM checks are not certification. The original dialog/unload-only draft guards were subsequently extended to router-owned Back/Forward and same-route query navigation; see [Phase 3 follow-up](PHASE_3_FOLLOW_UP_VALIDATION.md). Fresh reads are not optimistic-concurrency protection; simultaneous-editor conflict handling remains unchanged.

## Results

Implemented within the frontend: associated field errors and first-invalid focus; Radix mobile drawer with contained/restored focus and Escape handling; skip-to-content; named, focusable table-scroll containers; 44px minimum button/input/select targets; record-specific action names/confirmations and pending locks; dirty/pending dialog guards and unload warnings; fresh resource/account/grade detail reads with retry; safe numeric query parameters and history-preserving search; academic units, enrollment status and schedule/room context; cancelled/obsolete account-check recovery.

Verification completed:

- Frontend lint, type checking and production build passed.
- Frontend unit suite: 53 tests passed across 8 files, including cancelled Strict Mode account checks, obsolete-token failures and genuine current-token 401 handling.
- Canonical Lab 02 backend: 21 tests passed using disposable in-memory databases. No backend code changes were made for Phase 3.
- Complete isolated E2E suite: 20 tests passed (the previous 16 plus four Phase 3 scenarios), with no retries. Verified keyboard drawer containment/Escape/restoration, skip-link focus, search Back/Forward and pending-draft navigation, malformed page parameters, discard cancellation, associated/focused server errors, pending-save protection and failed-save draft recovery.
- Responsive browser checks passed at 320/390/768/1440px for resource forms, class rosters and academic records; wide tables remain internally scrollable. Also verified 200% CSS magnification and 720px viewport reflow representing a 1440px display at 200% scale. This is not native browser-zoom certification.
- Earlier verification failures were resolved: the zoom harness now distinguishes magnification from responsive breakpoints; Student CRUD explicitly accepts the new discard confirmation; an interrupted account-check race found during cross-role navigation was fixed and regression-tested. The final clean-database full run passed.
- Normal database SHA-256 remained `1A02DC29B7ABB36B1D5EFF58E2B3278918051E1C1A94101F72A48CC0AC1B633B`. Prior phase work and unrelated local changes were preserved. No environment files, migrations, commits, pushes or deployments were changed/performed.

These results describe the initial Phase 3 run. The [follow-up validation report](PHASE_3_FOLLOW_UP_VALIDATION.md) records additional navigation safeguards, sampled contrast corrections and updated regression results.

Remaining limitations: manual screen-reader speech, exhaustive contrast review and native browser zoom/device testing remain unverified. Navigation protection covers router-owned entries, not arbitrary history entries created outside React Router; browser unload warnings remain subject to browser behavior. Fresh editor reads do not prevent simultaneous-server edit conflicts. The existing build chunk-size/dependency deprecation warnings and non-failing Windows cancelled-connection logs remain. Phase 4 school policies were not implemented.
