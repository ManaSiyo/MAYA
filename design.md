# MAYA design

**The sole active design specification for client MAYA and every backend page.**
Older PDFs, V3/V4 documents and prior button references are [historical evidence](docs/design-archive/README.md),
not additional authorities. “No screen invents its own button.”

## Identity

Cosmos, bone-white text, restrained glass and quiet highlights. Important titles
are white; supporting information gray. Only important things glow. Dense content
gets quieter. No white haze, heavy borders, decorative sweeps or generic dashboard skin.

Jost is functional. Cormorant is reserved for MAYA/Mana Siyo branding and rare
editorial moments. Numbers use Jost and tabular numerals, never serif. Preserve
approved sizes: 11px dense data, 12–14px UI and 18px sections. Compact metric labels and
values are both 12px; use weight 500 for numbers instead of enlarging them.
The measured master pill is the explicit small-label exception below.

Use an 8px spacing rhythm, with 4px for dense internals. Circular logo cutout only:
no square backing, bezel or ring. Keep copy short and avoid repeated headings.

## Master pill: measured Tap to listen

Extracted from `frontend/index.html` at commit `149314e`, including its loaded
shared stylesheet. [Computed evidence](docs/design-archive/tap-to-listen-computed.json)
records Chromium, viewport and measurement limits. Scripts/external fonts were
blocked; font-family is the declared Jost, not a verified loaded font file.

| Property | Default token value |
|---|---|
| Padding | 6px vertical, 14px horizontal |
| Label | Jost 10px, weight 300, 1.5px tracking, uppercase, normal line-height |
| Shape | 100px radius; 8px internal gap |
| Listen width | 160px minimum; other pills fit content |
| Border | 1px solid white at 22% opacity |
| Fill | `rgb(3 15 29 / 18%)` |
| Frost | 22px blur, 180% saturation |
| Highlight | Inset top white 28%; inset bottom black 18% |
| Shadow | 0 4px 16px black 22% |
| Text | `rgba(245,250,255,.85)` |

The authored 0.5px border resolves to 1px at DPR 1. The master defaults to that
measured value; the gallery allows a fractional alternative. No silent redesign.

## Shared components

Source: [tokens.css](aesthetics/ui/components/tokens.css),
[components.css](aesthetics/ui/components/components.css),
[components.js](aesthetics/ui/components/components.js).
Native DOM factories preserve semantics without a framework or provider calls.

| Component | Shape and behavior |
|---|---|
| Pill | Capsule; centered label; hover, focus, selected, pressed, disabled/loading states |
| GlassSurface | 16px panel corners; material only, no invented interaction |
| IconButton | True 32px circle with centered SVG; accessible name required; no label-sized oval |
| Drawer | Rounded side panel; shared header/body/footer; Escape, focus containment/return |
| FilterPopover | Rounded compact overlay; anchored/clamped to viewport; native top layer; selection + Apply |
| Metric | Content-width capsule; quiet label, tabular value; zero and unavailable are distinct |

All components use one glass material with explicit intensity:

| Intensity | Fill | Blur | Top highlight | Use |
|---|---|---|---|---|
| quiet | 45% dark | 12px | 12% | Information panels and metrics |
| standard | 18% dark | 22px | 28% | Master pill and action controls |
| overlay | 90% dark | 22px | 28% | Drawers and filters over text |

Intensity changes material, not typography or shape. Logos, hamburger handles,
plain links, table cells and whole rows must not acquire glass button boxes.
Dense data must not instantiate thousands of backdrop filters.

## Frontend

`frontend/index.html`, served at maya.manasiyo.com, is the client experience.
Preserve its cosmic composition, image focus, approved brand sizes, navigation
and voice/project behavior. Keep setup and operational detail out of client UI.
Playground is the review surface, not a second aesthetic specification.

## Backend

All operational pages: Admin/Systems/Affiliates, Outbound, Brief,
Operation Room and its embedded engine. Privacy, Terms and verification share the
same visual vocabulary. Their existing access rules remain unchanged.

Same component material as frontend, quieter intensity for dense information.
Compact controls; left-aligned tables; 44px rows where content permits. Long content
must remain accessible. No clipped dropdowns or text showing through filters.
Status is text plus color: gray Not contacted, blue Contacted, amber In progress/
Follow-up due, emerald Booked/Replied, restrained red Cancelled/error.

Outbound: All, Ceremonial, Corporate, Fashion House; identical source columns,
including Category. Full-dataset filtering precedes batching. Email History stays
in the sidebar. Keep API behavior, account isolation and live data intact.

## Preview, then promote

Open [component gallery](playground/components/index.html) through the local server.
Start with Fonts: fixed Jost/Arial comparisons and Cormorant branding samples.
A plain-language text guide maps each style to where it is used. Buttons and menus
show real contexts; repeated states and fine adjustments stay collapsed. Arial is
a preview alternative, not a global font change. Technical fonts are documented
as Menlo/system monospace with SF Mono/generic fallbacks.
Edit optional settings, test drawers/filters, reset or export CSS. Changes persist only in this browser's gallery storage.
They cannot update live pages or production settings.

This build replaces conflicting component recipes in the gallery only. Existing
production CSS is a legacy adapter, not active design authority. Global component
migration and deletion of its old rules happen **after owner review of the gallery**.
[Migration audit](docs/DESIGN-MIGRATION-AUDIT.md) identifies conflicts and removal order.

Acceptance: 320/390/650/768/1024/1440/1920px; no page overflow, long labels, actual
keyboard focus, disabled controls, open overlays, readable text, reduced motion,
forced colors and no-blur fallback. Tokens own appearance; components own shape
and semantics; pages own layout/data. No page-specific material overrides.

## Liquid glass review (September 29)

The component preview presents two sections: a current/proposed pill comparison
and an 11-file page map grouped by audience. The proposed finish uses a brighter
curved rim and soft inset highlights over the galaxy; typography and geometry
stay measured and compact. It is scoped to the gallery via data-finish, not an
approved replacement for the master. Fonts, states and settings remain expandable.
Global application still follows owner review.

## Interactive finish and typography review

The gallery exposes Typography as a primary section: brand, editorial headline,
page headline, subheadline, body, paragraph, count, table, pill, caption and log
examples, each labeled with family/size/weight and usage. Existing 24px wordmark
and 26px editorial heading are references, not a global type-size increase.
Current / Proposed / Clearer are selectable finishes applied across all gallery
components and states. Clearer keeps the proposed hue/rim/highlight, reducing
base fill from 18% to 7% and tint from 16% to 7%. Displayed percentages describe
individual layers, never total composited transparency. Overlay backing remains
at least 90%; quiet data surfaces at least 45%. Simple sliders edit the selected
finish; the clearer toggle switches presets. This remains preview-only.
Preview icon circles follow the measured adjacent pill height via ResizeObserver.

## Color and weight review

The preview lists text color separately from size and weight: named color plus
CSS value, with semantic Admin/Outbound status and email-history examples.
Jost comparison includes real variable-font weights 300 and 350 (no opacity
simulation). These are review choices, not a global switch to 350.
Clear glass now uses 0% base fill, 0% tint, 20% rim, 30% highlight, 10px blur and
180% saturation. “100% transparent” describes its fill, not removal of highlights,
blur or the readable backing on menus. This replaces the earlier clear preset.
Source inventory is generated by tests/style-inventory.py across served HTML
style blocks, inline style attributes and linked local CSS; it includes legacy
overrides and does not claim computed coverage of every runtime state.

### Clear glass refinement

Clear preset: 5px blur and 90% saturation; other settings unchanged. The preview
provides a 0–200% saturation slider and explains 0% grayscale / 100% unchanged.
Neutral text labels use only White or Gray; exact CSS values remain visible.

## Typography review refinement

Preview brand, dialog headline and page headline use Cormorant Garamond 24px/300.
Paragraph/table use Jost 12px/300 and 1.7 line height; label/count uses 12px/400.
White text RGB channels are 255/255/255; preserve the displayed opacity and gray
colors. Clear glass highlight is now 15%. These choices remain preview-only.
Use real labels and page locations: “Name this project” in the client project-name
dialog and “OUTBOUND” in Outbound’s top-left header. “Your next design” was sample
copy, and the former “All prospects” page title is retired.

## Review page structure

Typography is ordered by descending font size, keeping Brand first among 24px
examples. The preview shell uses the proposed hierarchy: Garamond 24/300 titles,
Jost 12/300 body and 12/400 labels. Glass Pill Review, Icons and Page Map use
native collapsible sections with compact triangular arrows; navigation opens
its target section. Clear glass: 0px blur, 180% saturation, 10% rim, 15% highlight,
zero fill/tint. This supersedes previous clear preset values, preview only.
