# Component migration audit

Evidence, not a competing specification. See [design.md](../design.md).

| Conflict | Evidence | Replacement |
|---|---|---|
| Pill material repeated in frontend | `.glass-pill`, `#voice-bar`, `.top-btn`, modal actions define their own chrome | `Pill` and shared tokens |
| Pill parent and label disagree | `#voice-bar` inherits 16px/400; visible `#voice-text` is 10px/300 | Pill uses measured label typography |
| New material overrides old pill | `maya-buttons.css` loads last and adds 18% dark fill | Baseline captures this current computed result, not an invented transparent default |
| Fractional border varies by display | Source 0.5px computes to 1px at DPR 1 | Explicit measured 1px token; editor can preview 0.5px |
| Backend broad overrides collide | `maya-canon.css` has generic button, campaign, dense surface and late drawer rules | Explicit component classes and intensity attributes |
| Drawer material/markup diverges | Frontend drawer, Admin `#drawer`, Outbound `#outbound-drawer`, Brief settings | Shared `Drawer` shell, same material, separate content |
| Filter can bleed underlying rows | Drawer transparency reused above table rows | `FilterPopover`, overlay intensity, native top layer |
| Metrics and pills confuse roles | Local `.stat`, `.tile` and totals have unrelated sizing | `Metric` keeps label/value hierarchy and content width |
| Inline styles mix layout/state with appearance | Source inventory records locations/counts | Keep geometry/state bindings; move only material/type values into tokens |

## Applied in this review build

Six shared components replace conflicting implementations in the component gallery.
One material declaration and explicit quiet/standard/overlay variants serve both
frontend and backend examples. No broad selectors or page overrides in the new system.
Older specifications archived; root design.md is the sole active authority.

## Held for owner preview

Production pages still use legacy CSS. Removing their overrides or importing new
component tokens now would apply the system globally before review. After approval,
migrate one component family at a time, preserving IDs/events/data boundaries, and
remove the corresponding old declarations rather than adding another override layer.

Order: Pill/IconButton; GlassSurface/Metric; Drawer; FilterPopover. Validate computed
styles, open-menu geometry, keyboard behavior and seven widths at each step. Frontend
scroll-snap navigation is a page behavior; preserve it when adopting the Drawer shell.

Machine inventory: [css-audit.json](design-archive/css-audit.json).
Archived rule evidence: [legacy-material-rules.json](design-archive/legacy-material-rules.json).
Reproduce with `python3 tests/design-audit.py`. It includes backend JS and shared UI
modules; repeated declaration groups are candidates, not necessarily obsolete rules.
