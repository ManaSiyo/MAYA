# MAYA V4 implementation audit

Prepared locally, September 26. Not deployed.
Primary reference: original `docs/Aesthetics.pdf`, all three pages, unchanged.
V4 extends that canon; the earlier V4 review proposal is superseded.

## What changed

| Area | Result |
| --- | --- |
| Fonts | 184 authored functional serif declarations moved to Jost. Cormorant retained for brand/display/editorial exceptions. Jost loads 400/500/600; functional 300 declarations migrated to 400. Technical monospace retained. |
| Scale | Four functional tokens: 12/14/18/28px. Brand displays and icon geometry remain exceptions. 727 font-size declarations tokenized. |
| Colors | Shared bone-white/secondary/tertiary, hairline, hover, selected and semantic status tokens. Delivering green retained. Status labels remain visible. |
| Surfaces | Shared capsule, navigation frost and quieter dense panel rules. Removed 38 superseded local surface/style declarations and the obsolete Systems Map polish stylesheet. |
| Components | Metrics, table data, Lead Station hierarchy/statuses, model groups, drawers, dropdowns, modals, buttons and input geometry share the canon. |
| Behavior | No API, route, account/project, persistence or action logic changes. All 37 executable inline scripts unchanged and syntax-checked. |

## Coverage and files

11 served sources: frontend/index.html, playground/index.html, backend/status.html
(shared with Affiliates), backend/outbound.html, backend/marketing.html,
backend/operations.html, backend/backend.html, backend/privacy.html,
backend/terms.html, backend/verify.html, aesthetics/operations/index.html.

New shared stylesheet: `aesthetics/ui/maya-canon.css`.
Source migration: 2,540 declaration substitutions, recorded by selector and
property in `MAYA-V4-migration.json`. These are authored declarations, not unique
components. Complete baseline candidate inventory: `MAYA-V3-style-inventory.json`.
It includes inline and JS style strings, overrides and duplicate page copies;
it is not proof of the computed cascade on every dynamic state.

Tests: canon-contract.mjs, canon-ui.mjs, outbound-ui.mjs,
admin-ui-contract.mjs and app-regression.mjs. Cloud Build adds the canon checks.
Continuity: AGENTS.md/CLAUDE.md, AI-HANDOFF.md, requests.txt, fixes.txt.
Specification: MAYA-V4-CANON.md and two-page output/pdf/MAYA-V4-Canon.pdf.

## Validation

- Shared source contract passes on all 11 pages.
- Desktop 1440px and mobile 390px render/computed-style checks pass on all pages.
  Actual local Jost/Cormorant files used for a second visual pass; CI can run with
  fallback fonts if those local files are unavailable.
- Existing Outbound/CRM interaction test passes, including drawer dismissal,
  status filter, messages, invoice access, grouped models and semantic colors.
- Admin UI: 11 checks pass.
- Existing Maya hands suite passes on frontend and Playground, with fake providers.
- Inline-script syntax and whitespace checks pass. Original V3 PDF untouched.
- New V4 PDF: two pages, reopened and both rendered pages visually checked.

## Remaining limits

- General page snapshots use static shells; authenticated data interactions use
  synthetic fixtures. Live account content, native Windows controls and every
  optional overlay have not been visually certified.
- Some legacy inline/template spacing, artwork colors, provider marks and
  specialized canvas controls remain. Shared functional CSS is centralized;
  this is not a claim that every CSS value in the product is now a token.
- Opaque no-blur fallback is intentional for legibility. Status :has() coloring
  degrades to labeled neutral text in browsers without that selector.
- Full historical app-regression suite is not claimed green (pre-existing stale
  assertions/SDK fixtures documented in handoff); new canon contract is integrated.
- No production/provider changes, paid operations or live deployment verification.
