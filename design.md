# MAYA design

**Master aesthetic specification for frontend and every backend page.**
Read this before changing UI. Update it when Fromsa approves a new visual rule.

“Page 1 is canon. Every other screen replicates. No screen invents its own button.”

V3 [Aesthetics.pdf](docs/Aesthetics.pdf) remains the foundation. [V4](docs/MAYA-V4-CANON.md)
adds density rules. This file consolidates the current decisions; older experiments
are not competing references. Explicit new owner direction takes precedence.

## Shared identity

Cosmos, bone-white chrome, transparent frost, capsule controls, subtle inset
highlights. Only important things glow. More information means quieter decoration.
Keep existing font sizes and layout unless the request specifically changes them.
No glossy plastic, white haze, heavy borders, light sweeps or decorative animation.

| Element | Rule |
|---|---|
| Functional type | Jost. Regular 400; Medium 500; Semibold 600 only for emphasis. |
| Brand type | Cormorant Garamond for MAYA, Mana Siyo and rare display moments. |
| Numbers | Jost with tabular numerals. Preserve approved metric sizes. Never serif. |
| Hierarchy | Important titles white; descriptions gray; metadata quieter gray. No routine italics. |
| Sizes | Compact data 11px; UI 12–14px; section titles 18px; major metrics 28px. Do not inflate the client reference. |
| Spacing | 8px rhythm; 4px allowed inside dense controls/rows. |
| Geometry | Capsule actions; 12–16px content corners; circular icon controls. |
| Logo | Existing circular cutout. No square backing, ring, border or bezel. |
| Motion | Brief state transitions, normally 180ms. Respect reduced motion. |
| Copy | Short labels, one heading per purpose. Avoid repeated totals/instructions. |

## Liquid Glass buttons

Visual reference: [Glass Button by Hossain Jahed](https://21st.dev/@jahed/components/glass-button),
from the [owner-supplied preview](https://21st.dev/community/components?preview=%2F%40jahed%2Fcomponents%2Fglass-button).
Use its rounded, dimensional glass direction within MAYA's existing Tap to listen
language. The shared CSS is a native implementation, not a copied React component.

**One finish, shared across both surfaces:**

| Property | MAYA recipe |
|---|---|
| Fill | Dark translucent `rgb(3 15 29 / 18%)` |
| Edge | 0.5px white at 22% opacity |
| Frost | 22px blur, 180% saturation |
| Depth | Subtle top inset highlight, bottom inset shade, soft exterior shadow |
| Hover | Slightly brighter fill and edge; no movement or enlargement |
| Selected | Restrained blue tint/edge; retain semantic text colors |
| Focus | Visible 2px blue outline with 3px offset |
| Disabled | Reduced opacity, no shadow, existing disabled behavior retained |
| Fallback | Dark readable backing without backdrop-filter; system colors in forced-color mode |

Implementation: [maya-buttons.css](aesthetics/ui/maya-buttons.css), loaded after
page styles. New action buttons use `.maya-glass-button`; choose dimensions in the
component. Existing action classes map to the same recipe. Preserve compact sizes,
content-width pills and centered labels. Icon buttons remain true circles.

Glass is a material, not a requirement to box every element. Logos, hamburger
handles, text links, table-header filters, image tiles and switches retain their
purpose-specific treatment. Dense table cells and entire rows never become glass
buttons. Do not add blur to thousands of records. Do not add a runtime dependency
or animated distortion just for this finish.

## Frontend: client MAYA

Scope: `frontend/index.html`, served at **maya.manasiyo.com/**.
Playground mirrors the material for testing; it is not a separate design system.

- Preserve the approved cosmic composition, typography, brand size and image focus.
- Tap to listen is the action reference. Other action buttons share its material.
- Drawers retain their icon navigation, clear content spacing and compact footer.
- Keep the logo and voice control visually grouped; avoid a large empty footer.
- No admin tables, setup details or operational copy in the client experience.
- Preserve all project, image, voice and Pinterest interactions.

## Backend: every operational page

Scope: Admin/Systems Map and Affiliates (`status.html`), Outbound, Marketing,
Brief (`backend.html`), Operation Room and its embedded engine, Privacy, Terms,
and deployment verification. Public policy pages share the visual language even
though they are accessible without an admin account.

- Same typography, button material, logo treatment and drawer vocabulary as frontend.
- Information takes priority: calmer surfaces, compact controls, readable overlays.
- Drawer sections have consistent spacing. Setup is collapsed; Messages stays focused.
- Lead Station and Outbound use left-aligned table headers/data and compact 44px rows.
  Long text may wrap or expand accessibly; never force overlapping content.
- Popovers must sit above tables, remain readable over row text and fit the viewport.
- Status uses text plus color: gray Not contacted, blue Contacted, amber In progress/
  Follow-up due, emerald Booked/Replied, restrained red Cancelled/error.
- Outbound primary lists: All, Ceremonial, Corporate, Fashion House. Same columns,
  including Category, in each list. Filters search the full dataset before batching.
- Email History belongs in the sidebar. Metrics and campaign pills fit their content.
- Keep API behavior, consent, account isolation and live data unchanged by styling.

## Implementation and acceptance

`maya-buttons.css` owns shared action material. `maya-canon.css` owns backend density,
semantic tokens and surfaces. Existing frontend styles own its layout. Do not create
another per-page glass recipe. Consolidate obsolete overrides when editing a component.

Check 320, 390, 650, 768, 1024, 1440 and 1920px widths, long labels, empty/populated
states, keyboard focus, disabled/selected states, open drawers and dropdowns. Controls
wrap cleanly; tables scroll internally; no page overflow or clipped menus. Check
reduced motion and no-blur fallbacks. Preserve text contrast over cosmic imagery.

Current limitation: shared button material does not yet unify drawer markup.
Outbound still has text tabs and an Admin footer; frontend has icon tabs and a voice
footer. Track this explicitly rather than claiming identical component structure.
