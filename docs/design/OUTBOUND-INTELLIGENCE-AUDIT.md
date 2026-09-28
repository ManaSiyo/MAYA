# September 27: Outbound intelligence and visual audit

Local implementation; live provider/deployment checks remain. The original V3
canon and approved compact frontend styling override Gemini's proposed redesign.

| Gemini finding | Decision |
|---|---|
| Larger five-tier typography and thicker borders | Rejected: preserve compact Jost sizes, Cormorant brand moments and 0.5px hairlines. |
| New status palette | Rejected: retain emerald booked, amber progress, gray inactive, restrained red cancelled. |
| More glow and darker opaque cards | Rejected: preserve frontend frost, capsule controls and restrained active states. |
| Misaligned numeric columns, active tabs, architecture columns | Existing rules already handle these; regression checks retained. |
| Marquee edge crowding | Wider fade added to the existing track. |
| Long Changes / Feature Requests sections | Bounded scrolling; two feature rooms on desktop, stacked on mobile. |
| Fixed prompt block blends into inputs | Quiet recessed, wrapping read-only block; existing input focus style retained. |
| Floating controls cover lower content | Added bottom scroll clearance; no extra HUD glow or border. |
| Dense headings and fold markers | Unified inline alignment and 8px gap without enlarging type. |
| Submission fades, counters, global card regrouping | Not applied: unrelated cosmetic restructuring conflicts with preserving the approved frontend master. |

New UI: 50-item pagination, two mailbox connections/sender choice, review/send,
master-list segments, chronological activity and unmatched-correspondent review,
editable three-color sample email, scheduler status and shared AI speedometer.
The meter's value sits below its needle. Contact/campaign cards have 16px corners;
actions retain capsule geometry. Consumer and Playground files are unchanged.

Checks: actual-font screenshots inspected; 11 page sources at 320, 390, 650, 768,
1024, 1440 and 1920 pixels; populated Outbound controls and CRM at those widths.
This covers known layouts and fixture states, not every device or every live-data
combination. No claim of zero bugs throughout the entire historical codebase.

Functional checks include 10,000 contacts, membership/draft context, account
isolation, encrypted OAuth with Hosting-compatible callback cookie, history cursor
pagination, partial provider failures, human confirmation, uncertain-send retry
protection, scheduler identity, unchanged-contact AI avoidance, three-provider
cost accounting and concurrent $1 reservations.

Remaining: live mailbox permissions/provider access, Scheduler deployment and
heartbeat, real Twilio receipt, native Safari/touch review, actual billed cost
reconciliation and the scope decision for capping AI outside Outbound.
