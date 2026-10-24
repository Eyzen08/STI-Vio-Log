# STI Vio-Log visual consistency audit

Date: 23–24 October 2026. Changes remain local on `codex/invalidate-service-day`; no deployment or business-rule changes.

## Verified causes and changes

| Finding | Resolution |
| --- | --- |
| Working pages alternated between full width, 1500px, and 1120px containers. Older CSS added further 1600px/94rem caps. | Working pages share the available content width and 20px desktop / 12px mobile gutters. Actual editing forms retain a 760px maximum. Report/audit filter forms remain full width. |
| Student Management used a 32px desktop title while monitoring used 22px. Role headers also supplied different padding and minimum heights. | Shared 28px desktop / 24px mobile titles, 20px section headings, natural header height, and token-based padding. Public/authentication compositions and existing fonts remain intact. |
| A final blanket rule forced cards to 8px corners and suppressed every shadow. Separate pages overrode metric dimensions. | The existing shared presentation layer owns 12px cards, restrained light-theme elevation, no dark-theme elevation, natural card heights, 16px section gaps, 12px grid gaps, and 44px / 36px summary icons. |
| Page-specific action blues and local text/surface palettes drifted across QR, service, records, messaging, and violations. | Existing compatibility names now consume shared semantic colors. Primary action fills use the action token, while message bubbles retain their separate outgoing-message token. Provider logos and avatar identity colors remain intentional exceptions. |
| Dashboard minor/major badges and directory indicators used different palettes; monitoring healthy/failure states shared an informational treatment. | Minor, major, and grave severities retain distinct, theme-aware amber/orange/red treatments. Operational, degraded, unavailable, and configured states use success, warning, danger, and information treatments without changing reported states. |
| Monitoring health cards compressed their heading/status arrangement on tablets and imposed minimum heights. | Content-driven cards, an adaptive grid with a 14rem preferred minimum, and consistent provider/status placement preserve technology, latency, remediation, and last-checked details. |
| A second `:root` token block in `App.css` overrode theme-aware aliases, leaving signature-preview captions too dark. The active onboarding step used white on light blue in dark mode. | Removed the duplicate root block and used the contrasting action-surface token for the active step. |
| Mobile `html`/`body` rules hid horizontal overflow and created a scrolling ancestor that broke the sticky toolbar. | Removed the root overflow mask. Responsive route tests now check the actual document overflow; the scroll interaction checks verify the toolbar stays visible. |
| Light metadata/placeholder tokens missed normal-text contrast on pale surfaces; default department buttons used bright link blue behind white labels in dark mode. | Shared muted tokens meet 4.5:1 on canvas/card/nested surfaces. Default button fills and hover states use separate, contrasting action tokens in both themes. |

`index.css` owns shared tokens. `portal-system.css` owns shared headers, layout, surfaces, and portal-mounted overlays. Existing role/page styles retain specialized layouts and business-specific presentation. Superseded shared header/surface rules were moved out of `portal-overrides.css`, rather than adding another global stylesheet.

No routing, component props, API contracts, authentication, authorization, database schema, discipline calculations, service timing, clearance rules, or production data were changed.

## Coverage and acceptance checks

The browser checks use the actual application with isolated API fixtures. They do not contact production services or introduce fixture records into production views.

| Area | Coverage |
| --- | --- |
| Discipline Administrator | All 19 normal authorized routes |
| Discipline Office | All 15 normal authorized routes |
| Department Head | All 8 normal authorized routes |
| Student | All 9 normal authorized routes |
| Route matrix | Every role/route combination in both themes at 390px, 768px, and 1440px |
| Additional widths | Representative role dashboards, student directories/details, service, messages, QR, and settings at 320, 360, 430, 600, 1024, 1280, 1366, and 1920px |
| Public routes | Landing, login, password-reset routes, privacy, and terms in both themes across all eleven widths |
| Account setup | Onboarding and required password changes in both themes at 320, 390, 768, and 1440px |
| Stress cases | Long names, long IDs/program/section labels, empty directories, narrow password forms, department summary density, and genuine degraded/unavailable fixture states |
| Interactions | Fresh loads and SPA navigation; collapsed/expanded sidebar; keyboard focus; portaled filter and account menus; clearance approval success/conflict/retry; certificate review; signature dialogs/history; browser Back; modal dismissal; zoom-equivalent layouts |
| Layout assertions | Document overflow, table heading overlap, toolbar clipping and 44px targets, working-page widths, summary icon sizes, card radii, primary action colors, form widths, dark-theme contrast and accidental light surfaces |

The dark color audit evaluates rendered text against its composed background. It excludes hidden/decorative content, disabled controls, deliberate certificate/QR/native PDF paper canvases, and image/gradient-backed text requiring visual review. It is not a substitute for a complete assistive-technology audit.

## Changed source areas

- Foundation and shared presentation: `index.css`, `App.css`, `portal-system.css`, `portal-overrides.css`.
- Role/page styles: admin dashboard/students, department/student portals, community workflow, messages, student records/action drawers, violation management/drawers, and account setup.
- Verification: the existing UI consistency and dashboard browser scripts, a new visual contract test, and updated header/theme/layout source assertions. No React component implementation or public interface changed.

## Validation record

- Initial existing browser matrix: all 51 role/route combinations passed its original three widths and both themes. A subsequent clearance flow failed because the fixture omitted the double-submit CSRF cookie; the fixture now supplies that cookie. No authentication guard was weakened.
- The additional dashboard fixture now explicitly supplies the legal-acknowledgment state required by the current application.
- The new contract checks were observed failing on the original title/token/width/icon definitions. Browser regression checks separately reproduced the 106px department cards, inconsistent minor-severity color, and 766px department password form before their fixes.
- `node scripts/check-ui-consistency.mjs --theme-audit` — final responsive browser matrix: **944 recorded checks passed**, covering all 51 role/route combinations, public/setup pages, additional widths, and stress states. The rendered dark-theme audit returned an empty findings array.
- `node scripts/check-admin-dashboard.mjs` — dashboard browser regression: **49 checks passed**, including viewport/theme/zoom cases, sticky toolbar scrolling, notification counts and actions, and loading/empty/error states.
- Frontend suite (`node --test --test-concurrency=1 tests/*.test.js`): **525 passed, 0 failed, 0 skipped**. The same test files used by `npm test` were run serially because parallel Vite fixture servers contended for resources.
- `npm run lint`: passed with zero warnings.
- `npm run build`: passed.
- `node scripts/check-student-filters.mjs`: passed selection, keyboard, dismissal, filtering, reset, disabled-state, viewport placement, and light/dark desktop/tablet/mobile checks.
- Existing student-filter fixture assertions were refreshed for the current TESDA and Senior High options; no academic options or application behavior changed.

## Evidence

- [Before: Student Management, desktop](../frontend/artifacts/ui-consistency/before/admin-students-light-1920.png)
- [After: Student Management, desktop](../frontend/artifacts/ui-consistency/admin-students-light-1920.png)
- [After: Student Management, mobile](../frontend/artifacts/ui-consistency/admin-students-light-390.png)
- [After: System Monitoring, desktop](../frontend/artifacts/ui-consistency/DISCIPLINE_ADMIN-light-1920.png)
- [After: degraded monitoring, mobile](../frontend/artifacts/ui-consistency/monitoring-degraded-dark-320.png)
- [Machine-readable route checklist](../frontend/artifacts/ui-consistency/coverage-routes.json)
- [Rendered dark-theme color audit](../frontend/artifacts/ui-consistency/theme-audit.json)

Screenshots and detailed browser results are local ignored artifacts under `frontend/artifacts/`; commit or copy them separately if they need to travel with a review.

## Remaining limits

Chrome desktop viewport emulation was used, rather than physical phones/tablets or Safari/Firefox. Camera hardware, real account recovery, live email delivery, production service health, and physical printing were not exercised. QR/certificate paper canvases, public layouts/motion, legal content, provider logos, and role-specific workflows remain preserved.
