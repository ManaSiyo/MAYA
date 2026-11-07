# Visual canon

Aesthetic Control at /aesthetics/aesthetic-control.html is the sole presentation
authority. Sources live in docs/aesthetics; public URLs remain /aesthetics. Admin
opens the control in a same-origin dialog. Live Save is Admin-authenticated via
/api/admin/design, with a private atomic audit trail. Public /api/design strips
history. Local Save affects only the same browser origin.

| Role | Default font / size / weight | Purpose |
|---|---|---|
| H0 | Cormorant / responsive 104 / 400 | Sign-in MAYA |
| H1 | Cormorant / 24 / 300 | Brand/page title |
| H2 | Cormorant / 20 / 400 | Drawer title |
| H3 | Jost / 16 / 400 | Sections, dialogs, settings groups |
| H4 | Jost / 14 / 400 | Lead identity, fabric title |
| H5 | Jost / 10 / 300 | Lead date |
| P1 | Jost / 12 / 300 | Body, table, status |
| P2 | Jost / 12 / 400 | Metric label/value |
| P3 | Jost / 10 / 300 | Controls/captions |

Use data-maya-type, data-maya-control="field", data-maya-panel="inner" and existing
shared components. Page CSS owns positioning, containment and responsive layout;
shared saved settings own typography, materials, icons, borders and X/Y padding.
Do not add an independent palette or local substitute for shared controls.

Glass is the only pill family, including Edit and circular icons. Selected pills
use the hover white rim, with no blue selected fill. Default touch target 44px
(optional integer 32–56) applies to coarse pointers; compact board dots are exempt.
Keep semantic status colors and independent Inner/Table materials. Native selects
remain the functional source; custom menus use shared editor material and keyboard
navigation. Active defaults and changed saved values must propagate to previews
and consumers. Save snapshots and locks editing; Restore returns to last successful
Save. Padding debug highlights are preview-only and never saved. Old schemas remain
readable without migration writes; retired regularPill has no visual authority.

Admin uses Settings and Messages. Provider diagnostics, Insights and notification
commentary stay off the screens. Lead name H4/date H5 remain separate. Notes edit
inline; Enter/Save persist, outside/Escape/Cancel discard; failed saves keep drafts.
Messages keeps H2 above H3 contact, circular reviewed Phone/Share, no auto-sending.

Submission photo cards share Inner material, 3:2 aspect, Drawer scroll behavior and
width containment. Hover/focus reveals a P3 four-word description over the existing
Favorites-style gradient. Hover or keyboard focus exposes the Glass circular X; touch reveals controls
through selection/focus. Close controls use the saved Close icon percentage
(default 80% on desktop; touch retains the shared minimum hit area). Confirmation is a compact, explicitly centered viewport dialog using
Inner/H3/P1/Glass, with a working Drawer preview. Brief deletion exists only on
its drawer cards, never as a second header action. Share uses
Inner/H3/P1/P3, shared fields and Glass Copy/Done, with a working dialog preview.

In House is the permanent exact layout baseline for Global Fabrics: identical
photo/caption dimensions, full available width, scrolling and exactly two caption
rows. H4/P3/Inner/Glass and the single Fabric preview govern both. The sole bottom
P1 loading line is “Searching for Fabrics”. No unsolicited Dictate/Find/refinement
buttons. Preserve healthy photos and only retract sourced exclusions/wrong colors.

Frontend physical order is Inspo, Favorites, Community; dots match that order.
Favorites and all Community rows fit the visible viewport, including iPad landscape,
without cropping their top/bottom. The frontend uses the backend's circular logo.
Avatar uploads/camera changes save automatically; no Avatar Save or bundled random
headshots. Operations is a component of the Brief, not a standalone navigation item.

Image inspection is shared by the app, Brief and fabric photographs. A second
click from the app card viewer opens a viewport-sized photograph. Hover reveals
an Inner-material rectangular magnifier; pinch, wheel and drag inspect the image.
Fabric captions retain their original source links. Pinching must not swipe to
another version or zoom the board behind the image. Changing/removing a private
source closes its expanded view.

Design Notes starts closed at the left edge of the app card viewer. Its vertical
P3 label and Glass plus droplet reveal a sliding Drawer surface. Notes use H4/P1,
merge repeated color/reference values and contain no attribute pills. A working
notes/image preview lives beside the existing Drawer preview. Saved Drawer, Inner,
Glass, icon and typography settings retain authority.

Fromsa's November 6 instruction supersedes local browser/visual acceptance:
**do not use Chrome; Fromsa performs live visual and interaction checks after
Push.** Run non-browser code checks locally. The existing CI browser suite remains
an automated regression check, never owner acceptance. Do not claim a visual pass
from code checks or fixtures. Record visual acceptance as pending until reviewed.

Regenerate authored role locations with `python3 docs/typography-usage.py` after
markup changes. Counts are source locations, never invented live usage metrics.
