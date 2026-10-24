# Portal design overhaul

24 October 2026. Local changes on `codex/portal-design-overhaul`; no deployment.

## Presentation system

All working portals share a 232px expanded sidebar, 64px desktop / 60px mobile topbar, 24px page titles, 18px section headings, 14px body text, 16px content-card padding, and 10px card corners. Desktop gutters remain 20px and mobile gutters 12px. Filters and actions retain 44px minimum targets. Long content can increase card heights.

The existing portal body scope in `portal-system.css` owns density and reaches menus/dialogs mounted outside the shell. It uses Segoe UI for operational text, bundled Plus Jakarta Sans for headings, and tabular numerals for records. Root defaults remain available to public/authentication/setup screens. Light/dark themes use the same geometry.

Ordinary page headings are borderless title/action rows. Profile identity and account summary surfaces retain their borders and surfaces. No UI framework or dependency was added.

## Layout changes

- Admin dashboard main column holds attendance and recent violations; the supporting column holds service progress, offense distribution, and secondary actions. Each column follows its own content height. Date/actions participate in normal header flow.
- Department recent attendance and near-completion sections share an independent main column; service progress occupies the supporting column. Empty panels no longer stretch to match the neighbor.
- Inactive student attendance is a compact strip. Active sessions still show every timer, department, warning, error, and credit explanation. Student summary columns align to their content; mobile service totals fit three columns.
- Reports places Generate/Clear within its four/two/one-column filter grid, preserves visible hints and all report-specific fields, and uses a compact results toolbar. Empty states use inline text rather than oversized dashed boxes.
- Shared header/card/filter dimensions apply to directories, service, attendance, clearance, audit, administration, monitoring, analytics, messages, profiles, and settings. Pending service results use a compact empty state; editing forms retain bounded widths.
- Routes, role permissions, business calculations, timers, mutation behavior, exports, QR quiet zones/viewfinders, certificates/signatures, handbook reading layouts, and published content are preserved. `ReportFilters` accepts optional presentation children to place its existing actions; no API/data contracts changed.

## Measured result

Fresh synthetic captures before editing and after the final visual correction, at 1366 x 900 in light mode. Measurements are the vertical viewport position of the existing records/results section; this is layout density, not a task-speed study.

| Screen | Before | After | Earlier |
| --- | ---: | ---: | ---: |
| Admin dashboard | 606.9px | 402.5px | 33.7% |
| Reports | 579.1px | 412.7px | 28.7% |
| Department dashboard | 332.6px | 248.1px | 25.4% |
| Student dashboard | 723.9px | 540.6px | 25.3% |

The desktop admin dashboard and Reports also meet the 25% target at 1920px in both themes. The dashboard gap regression explicitly checks that recent violations begin 16px after attendance, independently of the service card. A small committed numeric baseline fixture makes that check repeatable without committing screenshot binaries.

## Validation

Commands run from `frontend/` with the existing external Playwright installation available through `NODE_PATH`:

| Command | Result |
| --- | --- |
| `node --test --test-concurrency=1 tests/*.test.js` | 525 passed, 0 failed/skipped. |
| `npm.cmd run lint` | Passed, zero warnings. |
| `npm.cmd run audit:performance` | Production build and all configured asset budgets passed. |
| `node scripts/check-ui-consistency.mjs --theme-audit` | 944 recorded checks passed; all 51 authorized role/route combinations at 390/768/1440px in both themes, representative routes at eight additional widths, stress states, clearance/dialog/Back flows, zoom, and public/auth/setup regressions. Dark-theme findings: 0. |
| `node scripts/check-ui-consistency.mjs --density-only` | 24 route/theme/viewport captures and geometry checks passed, including independent columns and earlier results. |
| `node scripts/check-ui-consistency.mjs --report-flows` | All seven report types generated and downloaded at 390/1366px in both themes. Applied-filter exports after draft edits, Clear, empty results, errors, and Retry passed. |
| `node scripts/check-ui-consistency.mjs --message-flow` | Eight admin/student, light/dark, 390/1366px flows passed: open conversation, visible 44px composer action, Enter to send, cleared draft, and mobile Back. All message writes were intercepted synthetic fixtures. |
| `node scripts/check-admin-dashboard.mjs` | All 49 viewport/theme/zoom, active timer, notification, sidebar, focus, and loading/empty/error checks passed. |
| `node scripts/check-student-filters.mjs` | Selection, keyboard, dismissal, filtering/reset, disabled state, and viewport placement passed across desktop/tablet/mobile and both themes. |

Independent code review found no actionable issues. The mechanical design scan returned legacy accent/transition advisories; timer/alert accents remain meaningful, and existing portal rules suppress legacy decorative effects. No new broad animation or asset was introduced.

## Evidence

- [Before admin dashboard, desktop](../frontend/artifacts/ui-consistency/density-before/admin-dashboard-light-1920.png) / [After](../frontend/artifacts/ui-consistency/density-after/admin-dashboard-light-1920.png)
- [Before Reports, desktop](../frontend/artifacts/ui-consistency/density-before/admin-reports-light-1366.png) / [After](../frontend/artifacts/ui-consistency/density-after/admin-reports-light-1366.png)
- [Before department dashboard](../frontend/artifacts/ui-consistency/density-before/department-dashboard-light-1366.png) / [After](../frontend/artifacts/ui-consistency/density-after/department-dashboard-light-1366.png)
- [Before student dashboard, mobile/dark](../frontend/artifacts/ui-consistency/density-before/student-dashboard-dark-390.png) / [After](../frontend/artifacts/ui-consistency/density-after/student-dashboard-dark-390.png)
- [Before measurements](../frontend/artifacts/ui-consistency/density-before/measurements.json) / [After measurements](../frontend/artifacts/ui-consistency/density-after/measurements.json)
- [Route checklist](../frontend/artifacts/ui-consistency/coverage-routes.json) / [Theme audit](../frontend/artifacts/ui-consistency/theme-audit.json)

Screenshots and detailed logs are local ignored artifacts. The numeric baseline and browser assertions are tracked source. Use `--density-baseline` only to capture an intentional pre-change baseline; it does not rewrite the committed regression baseline.

Browser checks intercept all external traffic and use synthetic records. Report downloads exercise browser/download behavior with fixture bytes; existing unit tests cover filenames, server errors, and URL cleanup. No real school messages, records, or services were changed. Physical phones/cameras, Safari/Firefox, live email/export services, printing, and a complete screen-reader audit were not exercised.
