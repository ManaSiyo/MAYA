# MAYA V4 Canon

V3 remains the foundation: `Aesthetics.pdf`, page 1.
“Page 1 is canon. Every other screen replicates. No screen invents its own button.”

**The more information a surface contains, the quieter it becomes.**
Consumer MAYA can be cinematic. Admin MAYA must be precise.

| Keep from V3 | V4 extension |
| --- | --- |
| Cosmos, bone-white chrome, 0.5px hairlines | Same identity across every page |
| Transparent/frosted surfaces, capsule controls | Strong frost on navigation and overlays; quieter frost on dense panels |
| Subtle inset highlights; important things alone glow | No decorative glow on tables, metrics or statuses |
| Cormorant brand/display moments | Jost 400/500 for all functional content; 600 only for emphasis |

## Typography

Four functional sizes: **12** metadata, **14** UI/data, **18** section, **28** key metric.
Brand displays retain V3's exceptional scale. Existing marquee identity remains.
Metrics use Jost 500 and `font-variant-numeric: tabular-nums`.
No Cormorant in CRM, numbers, analytics, statuses, forms, dates or system information.
Technical code may keep monospace. Hierarchy comes from size, weight, spacing and contrast.

## Surfaces and controls

Capsule: transparent; 100px radius; 0.5px white hairline; white 4% hover.
Navigation: approximately 22px blur, restrained saturation and inset highlights.
Dense panels: translucent dark scrim, quieter blur, no decorative shadow or animation.
No gradient pills, opaque default panels, heavy borders, decorative sweeps or competing glows.
Opaque fallback is permitted only when backdrop blur is unavailable, for readability.

## Information

Names primary; status immediate; notes secondary; category/date tertiary.
Booked/Delivering: existing green `#4ade80`. In progress: amber `#fbbf24`.
Cancelled/error: restrained red `#fda4af`. Inactive: gray `#b5bdc8`.
Selected: subtle MAYA blue tint; no painted blue chrome. Always retain text labels.

## Implementation

Shared tokens/components: `/aesthetics/ui/maya-canon.css`.
8px spacing base; 16px panel radius; 180ms feedback; visible focus; reduced-motion support.
Retain routes, API/data behavior, account/project isolation and all existing actions.
V2-style proposals and the earlier long V4 review are superseded.

## September 26 clarification: frontend component master
Backend chrome inherits the actual frontend drawer glass gradient, inset highlights,
capsules, tab rings and footer treatment. This gradient is restricted to floating
surfaces; no gradient pills or decorative table fills. Keep the restored compact
Admin data sizes. Preserve backend actions rather than adding consumer-only actions.

Consumer frontend and Playground are restored to pre-September-26 styles and do
not load backend canon CSS. Backend drawer frost matches that master at 28px;
capsule frost stays 22px. CRM data uses campaign-scale 11px. Logos and drawer
handles are borderless. Log headings are white and details secondary gray.
