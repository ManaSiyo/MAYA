# MAYA AI architecture

MAYA means Most Advanced Yet Acceptable. It is the provider-neutral
intelligence layer that turns a client's creative intent into explainable,
pattern-ready and fabric-sourced production decisions. Mana Siyo is the
physical manufacturing workflow that carries approved decisions into CLO,
SVG, LightBurn, laser cutting and sewing.

This file is the canonical model and routing map. It describes what is live,
what is only a foundation, and what evidence is required before a model moves
into production.

## The production boundary

The real workflow is:

1. Consultation, Pinterest references and tape measurements.
2. MAYA structures the intent, garment language, construction, material needs
   and real sourcing options.
3. Mana Siyo selects the closest CLO base asset and modifies the pattern for
   the client and design.
4. A person verifies the pattern and exports SVG.
5. A person verifies scale, paths and layout in LightBurn.
6. The selected fabric is prepared and laser cut, then the pieces are sewn.

MAYA may explain, compare and prepare a CLO modification brief. It does not
silently claim that a generated pattern is sewable, mark an SVG cut-ready or
send work directly to a laser cutter. Generated images are visualization;
retailer records, approved CLO files and verified production artifacts are
evidence.

Every private result and cache key remains sealed by account and project.
Public retailer catalog records may be shared, but client images, faces,
transcripts, measurements and decisions may not cross those boundaries.

## Live model roles at v13.52

- Consultation, descriptors, garment/fabric vision and pattern critique:
  OpenAI `gpt-4.1` unless the individual call is explicitly pinned otherwise.
- Fast live extraction, one-term fallback and safety rewrite: OpenAI
  `gpt-4o-mini`.
- Garment generation, editing, Backend piece renders and pattern rasters:
  OpenAI `gpt-image-2`, medium quality at the existing sizes. GPT Image 1.5
  has no active path or picker.
- Uploaded-audio transcription: OpenAI `whisper-1`.
- Operations Room retrieval: OpenAI `text-embedding-3-small` with local
  cosine search and IndexedDB caching.
- Optional video and 3D: Runway `gen4_turbo` and fal Hyper3D Rodin, both
  dormant without their existing server-side keys.
- Fabric retailer retrieval: no LLM. Six retailer feeds answer in parallel;
  failures are optional and the static fabric wall paints first.
- Fabric visual ranking: the existing admin-only `/api/rank-fabric` contract
  is the first task exercised through the router. Its only v13.52 route is
  still OpenAI `gpt-4.1`, with the same 60 second ceiling, request body,
  validation, response and static fallback as v13.51.

No Gemini or Vertex route, credential, API enablement, IAM change or cloud
configuration is part of v13.52.

## Task router contract

`docs/server/ai-router.js` owns provider-neutral task policy. A task names a
stable product capability, not a vendor endpoint. Each task declares:

- a version and data class;
- an ordered list of provider, model, endpoint and timeout routes;
- the exact error categories that may use a later route;
- a task-specific validator that normalizes the provider response.

Only timeout, transport failure, provider overload/server failure and invalid
structured output may use a configured fallback. Authentication,
configuration, cancellation, client errors and safety refusals do not cross
providers. v13.52 configures no live fallback; the mechanism exists so a
future route can be tested before it is enabled.

The browser still uses the existing raw OpenAI proxy for the calls not yet
migrated. That proxy is not the finished architecture. A later stage moves one
covered task at a time behind a server contract, then removes browser control
of that task's provider and model.

## Telemetry and privacy

One structured event is written for each router attempt. Its allowlisted
fields are request id, task and task version, provider, model, attempt,
fallback flag, outcome, error category, duration and numeric token usage when
available.

Telemetry never receives or records the prompt, input, output, image,
transcript, measurement, retailer title, account email, user id or project id.
Telemetry failure is swallowed and can never change a user result.

## Promotion evidence

`runTaskEvaluation()` records only case ids, pass/score, timing and safe error
categories. A model is promoted by task, never because it is new or globally
described as stronger. A representative private eval must establish:

- schema and factual correctness;
- fashion and manufacturing usefulness;
- p50 and p95 latency;
- cost and cache behavior;
- safe failure and fallback;
- no regression in the user-visible contract.

Foreground calls use one provider. Comparisons run offline or after the
primary result and only on inputs approved for that evaluation. This protects
perceived speed and avoids silently sending sensitive material to two vendors.

## Staged route map

1. **Foundation, v13.52:** exercised router, safe telemetry, eval harness,
   Cloud Build unit gate and the unchanged fabric-rank pilot. Retire GPT Image
   1.5 in favor of GPT Image 2.
2. **OpenAI task tiers:** after eval, consider Luna for frequent lightweight
   extraction, Terra for normal synthesis and Sol only for the streamed,
   book-grounded senior pattern critique. Preserve current routes as rollback
   until each task passes its bar.
3. **Fabric and garment vision:** after separate owner-run Google Cloud API
   and IAM setup, canary Gemini on structured fabric analysis, garment
   dissection, fabric thumbnail ranking and garment classification. Keep the
   exact current DTOs and a sequential OpenAI fallback. The static fabric wall
   remains immediate.
4. **Catalog retrieval:** normalize, deduplicate and refresh public retailer
   products before adding multimodal embeddings. At scale, embed product
   thumbnails once, shortlist by vector similarity, then visually rerank.
5. **Production memory:** version the chosen CLO base asset, modification
   brief, approved fabric, pattern revision, verified SVG/LightBurn handoff,
   fit corrections and cut/sew outcome so real Mana Siyo corrections become
   MAYA's durable advantage.

## Regression rules

- Never move retailer retrieval into an LLM.
- Never call a retailer product an exact match.
- Never remove the static-first fabric fallback.
- Never log private task inputs or outputs.
- Never add a fallback for a safety refusal.
- Never change image quality, size or anchor behavior as part of a model-name
  migration.
- Every routed task, model promotion and completed request updates focused
  tests, `tests/app-regression.mjs`, `docs/AI-HANDOFF.md` and
  `docs/requests.txt` in the same commit.
