# Maya's feature log — the Maya → Claude relay

Fromsa wants Maya to log any feature request or frustration (his own or a
customer's) so it reaches Claude and gets built. This is the first piece of that
relay.

## How it works now (v13.80)

- Maya has a voice tool `log_feature({ text, who })`. When anyone wishes MAYA
  did something it does not yet do, she records it. Logging has no external side
  effect, so it does not need a confirm click; she logs it and says "Logged for
  Claude" in the drawer chat.
- The server stores entries in GCS at `maya/features.json` (append-only, last
  500 kept), via `POST /api/admin/maya-log-feature` (admin only).
- The log is readable at `GET /api/admin/maya-features` (admin only), newest
  200. Each item: `{ ts, who, text, done }`.

## How Claude reads it (the relay)

Until there is a live automation, the relay is manual and reliable:

1. Signed in to Admin, open `https://maya.manasiyo.com/api/admin/maya-features`
   (or ask Maya to read the list), and paste the entries to Claude.
2. Claude builds them, and marks each handled item's `done` in a future pass.

## Next steps (owner decision)

- Surface the log in the Admin drawer as a small "Feature requests" fold so
  Fromsa sees the queue without hitting the endpoint.
- A true Maya → Claude automation (Maya files an issue / message that starts a
  Claude session) is a larger integration; it needs an owner decision on the
  channel (GitHub issue, email, or a webhook) before wiring.
