# Outbound versus frontend — September 29

Frontend remains unchanged and is the visual reference.

| Area | Frontend | Outbound finding / action |
|---|---|---|
| Glass controls | Tap to listen: transparent fill, 0.5px white edge, 22px blur, inset highlight, capsule | Campaign buttons had left alignment, 12/16px corners and shadow overrides. Removed conflicting rules; now centered with the same glass recipe. |
| Drawer | Icon tabs, branded footer, voice control | Outbound has text tabs, its own close button and Admin footer. Shared surface tokens do not make the markup or interactions identical. This difference remains; no fake voice control added. |
| CSS ownership | Frontend inline styles | Outbound has inline styles plus several shared stylesheet overrides. Competing selectors caused the alignment/radius regression. Removed conflicting campaign and retired To Do rules. Full drawer component consolidation remains. |
| Density | Small labels and a few primary actions | Removed workflow, duplicate campaign title, workspace heading, To Do, global status/job-title controls, add/export/assign row. Secondary views remain under drawer More. |
| Table | Not a consumer feature | Same source columns in every list; per-column sorting, contains and value filters run before 250-row batching. Category is never hidden. |
| History | Restrained contextual color | Sidebar Email History ring; matching legend, count and hover/focus/tap percentage. No inferred verification or fabricated follow-ups. |

Validation: populated seven-width browser checks, computed center alignment and
capsule geometry, desktop/mobile screenshots, 10k dataset filtering and reviewed
email flow, session/failure checks and full app regression. Providers are fixtures.
No live Gmail connection or production deployment claimed.
