# Historical evidence only

**None of these files is an active specification. Use ../../design.md.**

- Aesthetics-V3.pdf and MAYA-V4-CANON.md: retired design specifications.
- design-149314e.md: prior master, superseded by the current root design.md.
- tap-to-listen-computed.json: frozen Chromium computed baseline, with provenance.
- css-audit.json: per-file inline/dynamic-style counts and repeated declaration groups.
- legacy-material-rules.json: retained legacy material declarations for migration comparison.

The audit is a heuristic source inventory, not proof that all repeated rules are
bugs. Dynamic JS styles often serve positioning, progress or semantic state.
No blanket deletion of inline styles is safe.
