# Phase 3 follow-up: retain school rules and close recovery gaps

Date: 2026-10-06 (Asia/Manila). User selected retaining current school rules, not adopting Phase 4 policies. Preserve all existing changes. No backend/schema/environment changes, normal database writes, commits, pushes or deployments.

## Scoped plan

1. Extend the shared protected editor to React Router navigation, including Back/Forward and same-page URL changes. Use the installed data-router blocker and existing Radix components. Cancelling navigation retains inputs; explicitly discarding resumes the requested destination; pending saves cannot be interrupted by route changes. Keep unload and dialog-close guards. Verify that successful saves and clean forms do not acquire unwanted prompts.
2. Inspect rendered light/dark text contrast, including active navigation, muted help, badges and placeholders. Correct only evidenced token/control contrast gaps within the existing palette. Use W3C's [contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) for tested text pairs; do not claim exhaustive WCAG conformance.
3. Add browser accessibility-tree checks for navigation/dialog/input names and error associations, plus keyboard-only table scrolling and theme coverage. This is structural evidence, not proof of spoken screen-reader behavior.
4. Re-run lint, type checking, unit tests, build, the full isolated E2E suite and disposable backend regressions. Check normal database SHA-256 before/after; baseline is `1A02DC29B7ABB36B1D5EFF58E2B3278918051E1C1A94101F72A48CC0AC1B633B`.

Native browser zoom and real screen-reader/device acceptance require separate assisted validation. Existing CSS magnification and half-width reflow are approximations, not native-zoom proof. [W3C resize-text guidance](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html) informs the manual checklist below. Do not add grade release, GPA, registration rules or concurrency policy.

## Manual acceptance checklist

- With a real screen reader, traverse primary navigation and an editor; confirm dialog titles, field labels, required/invalid state and error speech, then Escape and verify focus restoration.
- Set the browser's actual zoom to 200%, verify its zoom indicator, and open Students, a class roster, Academic Record and an editor. Confirm fields/actions remain reachable and wide tables scroll within their containers; restore zoom afterward.
- On an actual touch device, verify navigation, selector menus, scrolling and editor recovery. Verify hover/focus/disabled/forced-color states separately from tested default contrast pairs.

## Results

Implemented:

- `src/components/ui/protected-dialog.tsx`: shared router navigation guard using the existing data router and Radix dialog. Keep editing cancels navigation without losing inputs; explicit discard closes the editor and proceeds, including query-only navigation. Pending saves reset blocked navigation without exposing discard. Register the blocker only while an editor is open; retain unload and dialog dismissal protections.
- `src/index.css` and `src/components/ui/primitives.tsx`: measured contrast exposed light active-navigation text, light search placeholders, light muted year badges, light Delete text and dark role badges below 4.5:1. Adjusted the existing green/neutral/red tokens and linked shared input/textarea placeholders to the muted text token. No layout redesign or new dependencies.
- `src/components/ui/accessibility.test.tsx`: four added data-router regressions for cancelled/confirmed Back, pending saves, clean exits and same-route query changes.
- `e2e/phase-three/follow-up.spec.ts` and `contrast-support.ts`: Back/Forward/query recovery, pending-save failure recovery, 20 named default-state rendered text contrast samples across both themes, and Chrome accessibility-tree label/required/invalid/error checks. Contrast samples use computed colors and ancestor background alpha composition; this is not a whole-page contrast scanner.
- `e2e/phase-three/accessibility-recovery.spec.ts`: strengthened table scrolling to assert focus and actual ArrowRight scrolling, without setting scrollLeft programmatically.

Verification completed:

- `npm run lint`, `npm run typecheck`, `npm test` and `npm run build`: passed; 57 frontend tests across 8 files.
- Lab 02 `.venv\Scripts\python.exe -m pytest -q`: 21 tests passed using the existing isolated in-memory fixtures. No backend changes were needed.
- `npm run test:e2e`: all 24 scenarios passed on a fresh disposable database, one worker, no retries. This includes cross-role offering/enrollment and grade reflection, existing permission checks, all Phase 1-2 regressions and the additional Phase 3 safeguards.
- All 20 named default-state contrast samples meet 4.5:1. The new Chrome accessibility-tree assertions and real keyboard ArrowRight table-scrolling checks passed. These do not replace the manual checklist above.
- Earlier runs identified the remaining light Delete contrast gap, which was corrected. An intervening run was interrupted at initial sign-in by a development-server reload while test/document files were being updated; the final complete run was performed without file edits and passed.
- Normal database SHA-256 remained `1A02DC29B7ABB36B1D5EFF58E2B3278918051E1C1A94101F72A48CC0AC1B633B`. Frontend and backend `git diff --check` passed. Pre-existing backend changes were not modified.

Scope and remaining limitations:

- Lab 02 source and existing unrelated changes were preserved. No environment files, school rules, schema or normal database were changed; no commit, push or deployment was performed.
- Router protection applies to router-owned same-document entries. Arbitrary history entries created outside React Router, including native hash entries, are not guaranteed to be blockable. Browser unload warnings depend on browser behavior; they do not cancel an already-sent server request.
- Screen-reader speech, native browser zoom, physical-device use, exhaustive hover/focus/disabled/forced-color contrast and full accessibility conformance remain manual acceptance items. Chrome's accessibility tree is structural evidence only.
- Fresh reads still do not prevent simultaneous server-side edit conflicts. Existing chunk-size/deprecation warnings and non-failing Windows cancelled-connection logs remain. Phase 4 school-policy changes were not implemented.
