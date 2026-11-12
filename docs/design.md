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
width containment. Reopening the Brief drawer retains decoded cards and revalidates
the account-bound feed after one minute without blanking it. Account reset and
deletion invalidate private data; failed background reads retain the good list.
Hover/focus reveals the saved frontend garment description,
clamped to two P3 lines, over the existing
Favorites-style gradient. Hover or keyboard focus exposes the Glass circular X; touch reveals controls
through selection/focus. Close controls use the saved Close icon percentage
(default 80% on desktop; touch retains the shared minimum hit area). Confirmation is a compact, explicitly centered viewport dialog using
Inner/H3/P1/Glass, with a working Drawer preview. Brief deletion exists only on
its drawer cards, never as a second header action. Share uses
Inner/H3/P1/P3, shared fields and Glass Copy/Done, with a working dialog preview.

In House is the permanent exact layout baseline for Global Fabrics: identical
photo/caption dimensions, full available width, scrolling and exactly two caption
rows. A failed photo retains a compact two-line source link; never hide the result.
The toolbar order is Refresh → CSV → Expand, all the same height with the shared
P3 line and Glass padding. CSV exports saved research; the hover/focus X dismisses
an item. Expanded Fabrics closes on outside click or Escape.
Fabrics and a real active garment remain selected simultaneously. Full View or
pressing Fabrics again returns to the garment image. H4/P3/Inner/Glass and the single Fabric preview govern both. The sole bottom
P1 loading line is “Searching for Fabrics”. No unsolicited Dictate/Find/refinement
buttons. Preserve healthy photos and only retract sourced exclusions/wrong colors.

Frontend physical order is Inspo, Favorites, Community; dots match that order.
Favorites and all Community rows fit the visible viewport, including iPad landscape,
without cropping their top/bottom. The frontend uses the backend's circular logo.
Project rows use a spaced action group: Glass bubbles are 5% smaller and their
glyphs 5% larger on desktop; touch keeps the shared minimum hit area. The active
frontend centers project names/dates across the full row while actions are hidden;
hover/keyboard reveal the unchanged-size actions with half the shared icon gap.
Inspo, Favorites, Community, Pinterest and fabric descriptions share Community's
italic treatment: H2 font family and P1 size/weight, white text and 1.35 line height. Desktop descriptions
appear only on hover or visible keyboard focus, never persistent pointer selection.
They sit on a bottom tint; Community copy omits the author/yours line while retaining
accessible attribution. Dissect, stack and X align in one shared Glass row. Frontend
fabric tiles are square; Pinterest and fabric walls share equal outer padding and
balanced scrollbar gutters. Working card samples live in Aesthetic Control.
Project actions preview shares these rules. New projects auto-save on the first
photo/import, text or microphone action and appear in Projects after cloud
acknowledgement. Selecting an avatar alone does not create a project.
Avatar uploads/camera changes save automatically; no Avatar Save or bundled random
headshots. Operations is a component of the Brief, not a standalone navigation item.

Image inspection is shared by the app, Brief and fabric photographs. A second
click from the app card viewer opens a viewport-sized photograph. Hover reveals
an Inner-material rectangular magnifier, 35% larger on each axis; pinch, wheel and
drag inspect the expanded image only. Outer/card photos have no magnification or
image gesture interception, except the Operation Room garment frame: its enlarged
center view pans horizontally across the source triptych while vertical gestures
continue to scroll. Operation Room inspection opens in the parent viewport.
Fabric captions retain their original source links. Pinching must not swipe to
another version or zoom the board behind the image. Changing/removing a private
source closes its expanded view.

Design Notes starts closed 12px inside the left edge of the app card viewer. Its vertical
P3 label and Glass plus droplet follow the image center and reveal a sliding Glass
surface (data-maya-material="glass"), using shared Glass fill, border, frost and
padding without capsule geometry. The panel is 272px wide (20% narrower), constrained
on phones. When open the trigger shows only minus; rightward swipe dismisses it,
while vertical reading and cancelled gestures do not. Notes use H4/P1,
merge repeated color/reference values and contain no attribute pills. A working
notes/image preview lives beside the existing Drawer preview. Saved Drawer, Inner,
Glass, icon and typography settings retain authority.

Operation Room version 2 restores the 34/66 garment/pattern column ratio, stacks on
narrow screens and centers every image. Compact content-height toolbars put Start
beside the garment selector in a centered group. Both toolbars use the same P3/Glass
padding, trimmed one pixel in X/Y for the original Backend, with equal space above
and below. Shared grid rows keep garment/pattern
frames and outer panels aligned before, during and after generation; raster
images fit inside without resizing the frame. SVG retains its interactive canvas.
The original pattern window switches Mark 1 → Pipeline, with a green dot pulsing only while running. SVG export lives in Settings. Pipeline contains Pipeline
Live, retrieval details, book passages and the composed prompt, scrolling within
the same frame. It stays open during pipeline updates and resets with the project
or garment. The former separate Retrieval Trace section is removed only here;
Backend 2 keeps its Pattern / CLO 3D / Pipeline layout. Fabrics belongs only in the
original Brief, with four square fabric cards per row (two on phones), hover-only
white Community captions and adjacent heart/X actions.
The parent Brief owns vertical scrolling between screens, with section snap stops;
Pipeline owns only its internal overflow. Ordinary vertical wheel input scrolls over SVG too;
Ctrl/Command-wheel zooms its canvas. SVG tracing runs on demand in a bounded
worker, never automatically after the drawing. New versions generate only Mark
One. Required pocket pieces are individual outlines; displayed mirrored halves
each say CUT 1 instead of duplicating the pair count.
The version label uses P3 beside the H1 title; editable Settings reuse shared fields,
Drawer and roles. The active Operation Room preview lives in Aesthetic Control.
Pointer selection releases the original garment control's focus ring; keyboard
focus remains visible. The original page indicator uses the frontend's white active
dot. Brief and Operations share one Submissions / Settings drawer, including the actual
engine settings and context-bound SVG export. The page indicator has a half-pixel
border like the frontend and sits six pixels farther left on desktop.

Fromsa's November 6 instruction supersedes local browser/visual acceptance:
**do not use Chrome; Fromsa performs live visual and interaction checks after
Push.** Run non-browser code checks locally. The existing CI browser suite remains
an automated regression check, never owner acceptance. Do not claim a visual pass
from code checks or fixtures. Record visual acceptance as pending until reviewed.

Regenerate authored role locations with `python3 docs/typography-usage.py` after
markup changes. Counts are source locations, never invented live usage metrics.

Backend 2 is the separate November 11 playground, not a replacement for Brief.
Its image/pattern upper window retains 34/66 proportions at desktop/tablet (40/60
on a phone for usable controls), with contained images and original garment pan.
Full view only changes the displayed image, never the active garment's pattern
input. Pattern, CLO 3D and Pipeline swap the right panel; green pulses only while
the pattern engine is running. CLO keeps source-backed reference cards, filters,
alteration details and per-admin selections inside the same right-panel frame.
The bottom strip uses the same fabric cards/captions with horizontal scrolling.
Bio, Submissions and Settings use the frontend's three circular filing tabs and
shared Drawer material. Small-height windows may scroll for access; content never
shrinks images by changing their aspect ratio. Shared favorites belongs to the
whole backend, with a Glass heart immediately left of Global's X. Active hearts
use the existing icon color. Aesthetic Control includes matching interactive
snapshot/fabric/drawer samples. All collapsed Admin folds use Closed sections
spacing, with wrappers contributing no extra vertical gap.

Backend 2 compact experiment (owner requested November 11): remove outer
operation and fabric panels, keep one Inner frame, and use 5px toolbar padding
with 9px P3 controls locally. These size exceptions do not alter global Aesthetic
Control defaults. Shared Inner/Drawer/Glass colors, materials and icons retain
authority. Drawer order/default is Submissions (folder), Bio, Settings. Fabric
strip/card dimensions are smaller to recover vertical and horizontal space.

Backend 2 sourcing update (November 12): its fabric strip is a single horizontal
rail with view tabs/tools first, followed by square edge-to-edge photographs.
The controls scroll away with the photos. P1 titles/P3 source captions overlay
photos on hover/focus/first touch; source-only failures stay readable. Smaller
heart/X actions cluster at top right, preserving shared coarse-pointer targets.
The strip is 112–152px so the upper image/pattern workspace receives more height.
CLO uses bounded square photo cards with equivalent captions/actions and truthful
missing-preview fallbacks. Its imagery must come from source evidence. The
Backend 2 numeral uses 0.62em on the title baseline. Shared materials/fonts remain
controlled centrally; the compact control-size exception remains local.
Pipeline stages report real run/restored/error states; previews explicitly label
sample transitions. Drawer gestures must originate on handles or empty edges,
never hijack card/fabric scrolling or interactive controls.
