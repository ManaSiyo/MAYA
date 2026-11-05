# Current handoff — November 5 image model upgrade

## Current owner request and implementation

Upgrade to the newest image models. Active OpenAI generation and edit requests
now use gpt-image-2.6-flare in frontend/index.html, backend/backend.html and
backend/operations.html. docs/server/model-config.mjs also exposes the new default
through existing authenticated Admin model metadata. Proxy policy/server inventory
and Firestore community create/update rules accept it; old 2.5 Flare and Image 2
clients/posts remain compatible. Existing historical model tags are preserved.

No prompts, rendering quality, dimensions, reference-image handling, output format,
retry behavior, account/project authorization or usage limits changed. Optional
Vertex, text, speech and Fabric web-search models are unchanged. No added UI or
aesthetic settings; existing provider metadata and the dormant model selector
only report the updated model name. Existing shared typography/materials apply.
No credentials, billing, environment settings, personal Chrome or paid calls used.

## Verified official research

Checked November 5: OpenAI's November 4 release introduced 2.6 Sunburst and Flare.
Flare is documented for fast iteration and supports the same Images generation
and editing endpoints. It replaces MAYA's previous Flare role directly.
- https://developers.openai.com/api/docs/changelog
- https://developers.openai.com/api/docs/models/gpt-image-2.6-flare
- https://developers.openai.com/api/docs/pricing
- https://developers.openai.com/api/reference/resources/images/methods/generate
- https://developers.openai.com/api/reference/resources/images/methods/edit

Standard token rates equal 2.5 Flare: image input/cached/output $8/$2/$30 per
million; text input/cached $5/$1.25. This is not a guaranteed identical per-image
bill or a measured speed comparison. No extra complexity/quality tuning is added.
Account entitlement and real output quality/latency are unverified until live use.

## Validation

New tests/image-models.mjs executes the actual frontend, Brief and Operations
request builders with fake transport. It checks the new model, cleared obsolete
preferences, auth, unchanged quality/sizes/options, original reference bytes and
response handling. It runs in Cloud Build and app-regression. Proxy tests cover
2.6 and 2.5 passthrough, endpoint rejection, image-count caps and Admin-only high
quality after large multipart images. Regression checks include current/legacy
community provenance and updated rules. Node20/Node24 image/proxy checks and
Node20 Brief/Operation races and project-lifecycle pass.

All 81 exact Cloud Build functional/syntax commands plus full app-regression and
smoke pass (83/83). Updated image-model details also pass default/saved shared
editor material and seven-width checks; phone/desktop screenshots were visually
inspected. No layout/material changes were needed. Final standalone Aesthetic
Control passed last (exit 0), after all functional checks and visual inspection. Evidence:
/private/tmp/maya-image26-release.log, /private/tmp/maya-image26-gates/,
/private/tmp/maya-image26-admin-systems.log, and model-default/model-saved PNGs.
Final authority log: /private/tmp/maya-image26-final-authority.log.

## Prior work and remaining Global incident

Local commit 42622c7 removes all unsolicited Admin insight/provider/notification
reporting and uses one bottom Fabrics line: Searching for Fabrics. It also repairs
explicit Refresh after private resets and patterned-textile qualification. In
House/Global layout parity and private source/exclusion/account guards remain.
That commit passed all required local checks and final standalone authority.

Last live evidence (November 5, 20:04 UTC): Hosting and /api/healthz both bb7c678.
An authorized internal-browser reload of the saved hooded-tailcoat reproduced a
completed empty Global gallery. No photographs reached the DOM. Interpretation
was dark forest green brocade/jacquard apparel yardage. Raw provider trace was
unavailable. Local fixes do not prove this live provider issue is resolved.

## Exact next step

All local verification is complete for the separate image-model commit.
Owner Push is the next step; no Push or deployment was performed.
Then verify release.json, page build stamps and /api/healthz commit. Accept one
actual image generation/edit and saved-image sharing, checking entitlement,
quality and timing. Separately run that same saved garment's Global search and
Refresh: require actual loaded sourced photographs and clean Admin screens.
If Global remains empty, use private count-only search diagnostics to distinguish
missing provider image results from rejected/unmatched candidates. Generated
images are never a substitute for sourced Fabric photographs.
