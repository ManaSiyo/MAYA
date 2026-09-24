"""Waistband module — the first concrete component in the Phase 4 rules engine.

Fromsa's chosen starting point (2026-05-25):
    "The waistband should be the same measurement as the hip measurement
     per client."

This is the canonical patternmaking rule for a PULL-ON garment: the waistband
must be at least as long as the wearer's hip circumference, because the hip is
the widest cross-section the waistband has to clear when pulling the garment
on. For a FITTED garment with a closure (zipper, hook & eye), the waistband
sizes to the waist circumference plus ease — but Fromsa specifically named
the hip rule, so that's the default here.

References:
    - "Pattern Making for Fashion Design" (in Back End/self study/Pattern Book.pdf),
      Skirts chapter, waistband construction section.
    - GarmentCode JSON schema (see GARMENTCODE_SYSTEM_PROMPT in
      Back End/op-room.html) — this module produces the `panels[]` entries
      for waistband-type panels.
    - Backend measurement schema: BACKEND_MEAS_SCHEMA in backend.html.
      We read the `hip` field (X-axis section).
"""

from __future__ import annotations

from typing import Optional

try:                              # imported as part of the manufacturing package
    from .panel import Panel
except ImportError:               # run directly: `python waistband.py` for the self-test
    from panel import Panel       # type: ignore


# ─── Defaults ────────────────────────────────────────────────────────────────
# Heights and ease values come from the Pattern Book; tweak per-style by
# passing overrides into build_waistband(). Defaults match a contemporary
# straight waistband on a fitted skirt or trouser.

DEFAULT_HEIGHT_CM = 4.0          # Finished waistband height (4 cm = standard
                                 # straight waistband; curved/contour waistbands
                                 # have their own module — collar/yoke style).

DEFAULT_PULL_ON_EASE_CM = 2.0    # Tiny ease over the hip so the band slides
                                 # on without sticking. Stretch fabrics: 0.
                                 # Non-stretch wovens: 2–3 cm.

DEFAULT_FITTED_EASE_CM = 1.5     # Ease over the waist for a fitted band with
                                 # a back closure. Pattern Book recommends
                                 # 1–2 cm of "wearing ease" at the waist.

DEFAULT_SEAM_ALLOWANCE_CM = 1.0


# ─── Public builder ──────────────────────────────────────────────────────────

def build_waistband(
    client_measurements: dict,
    *,
    closure: Optional[str] = "none",
    height_cm: float = DEFAULT_HEIGHT_CM,
    ease_cm: Optional[float] = None,
    seam_allowance_cm: float = DEFAULT_SEAM_ALLOWANCE_CM,
    fabric_note: Optional[str] = None,
) -> Panel:
    """Return a Panel for the waistband, sized to the client.

    Rule (Pattern Book, Skirts ch., waistband section):
        - For pull-on garments (closure="none" or "elastic"):
            waistband length = HIP circumference + pull-on ease.
            The hip is the largest cross-section the waistband must clear.
        - For closure-bearing garments (zipper, buttons, hook & eye):
            waistband length = WAIST (narrowest) + wearing ease.
            The closure absorbs the difference between hip-pull-on and waist-fit.

    Args:
        client_measurements: dict using the keys from BACKEND_MEAS_SCHEMA
            in backend.html. Required keys depend on closure:
                - closure "none"/"elastic": needs 'hip' (cm)
                - closure "zipper"/"buttons"/"snaps"/"hook-eye":
                  needs 'waist_narrowest' (cm). Falls back to hip if
                  waist is missing — better to make it pull-on-safe than
                  to crash.
        closure: GarmentCode JSON `closure.type` value. Determines which
            measurement anchors the waistband length.
        height_cm: Finished waistband height (top to bottom on the body).
        ease_cm: Override the default ease for this closure. Use 0 for
            stretch fabrics, larger values for stiff non-stretch wovens.
        seam_allowance_cm: Standard 1.0 cm. Pattern Book recommends 1.25 cm
            for wool suiting (iteration-log-v1.md iter 6).
        fabric_note: Free-text propagated to the Panel for the cutter.

    Returns:
        Panel with width = anchor measurement + ease, height = height_cm.

    Raises:
        KeyError: if the required measurement is missing and no fallback fires.
        ValueError: if measurements are non-positive.

    Example:
        >>> meas = {'hip': 96, 'waist_narrowest': 76}  # cm, from a client folder
        >>> wb = build_waistband(meas, closure="zipper")
        >>> wb.width_cm   # waist + 1.5 cm ease
        77.5
        >>> wb2 = build_waistband(meas, closure="none")
        >>> wb2.width_cm  # hip + 2.0 cm ease (the rule Fromsa stated)
        98.0
    """
    pull_on_closures = {None, "none", "elastic"}

    if closure in pull_on_closures:
        anchor_cm = _read_positive(client_measurements, "hip", fallback=None)
        if anchor_cm is None:
            raise KeyError(
                "Pull-on waistband needs 'hip' in client_measurements "
                "(matches the 'hip' key in BACKEND_MEAS_SCHEMA in backend.html)."
            )
        applied_ease = ease_cm if ease_cm is not None else DEFAULT_PULL_ON_EASE_CM
        anchor_label = "hip"
    else:
        # Closure-bearing — anchor to waist with a hip fallback so the
        # builder never raises on the most common case where a designer
        # forgot to enter waist.
        anchor_cm = _read_positive(
            client_measurements, "waist_narrowest",
            fallback=_read_positive(client_measurements, "hip", fallback=None),
        )
        if anchor_cm is None:
            raise KeyError(
                "Closure-bearing waistband needs 'waist_narrowest' or 'hip' "
                "in client_measurements."
            )
        applied_ease = ease_cm if ease_cm is not None else DEFAULT_FITTED_EASE_CM
        anchor_label = "waist_narrowest"

    length_cm = anchor_cm + applied_ease

    return Panel(
        name="WAISTBAND",
        role="waistband",
        width_cm=length_cm,
        height_cm=height_cm,
        grainline="horizontal",     # Waistband is cut on the cross-grain so
                                    # it stretches across the body, not down it.
        seam_allowance_cm=seam_allowance_cm,
        mirror_pair=False,          # Cut as ONE long strip; no mirror needed.
        notches=_waistband_notches(length_cm),
        shape_notes=(
            f"Straight waistband. Length = {anchor_label} "
            f"({anchor_cm:.1f} cm) + {applied_ease:.1f} cm ease = "
            f"{length_cm:.1f} cm. Cut on cross-grain so the length runs "
            f"along the weft. Closure type: {closure or 'none'}."
        ),
        fabric_note=fabric_note,
    )


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _read_positive(measurements: dict, key: str, *, fallback=None):
    """Read a measurement, validate it's positive, otherwise return fallback.

    Catches the common bugs: missing key, string instead of number,
    accidental zero from an unfilled consultation form.
    """
    val = measurements.get(key)
    if val is None or val == "":
        return fallback
    try:
        val = float(val)
    except (TypeError, ValueError):
        return fallback
    if val <= 0:
        return fallback
    return val


def _waistband_notches(length_cm: float) -> list:
    """Standard waistband notches: centre-front, centre-back, both side seams.

    The cutter uses these to align the waistband to the skirt/trouser body
    when stitching the two together. Returned as labels — the SVG/DXF
    exporter converts them to triangular cuts at the listed positions.

    For very long waistbands (e.g. circle skirts) future versions may add
    intermediate notches every 20 cm; the Pattern Book doesn't require
    them for standard waistbands, so we don't add them here.
    """
    return ["CF", "CB", "SS-L", "SS-R"]


# ─── Self-test (run `python waistband.py` to sanity-check) ───────────────────

if __name__ == "__main__":
    # Naveed's measurements would land in client_measurements when the
    # backend loads his folder. Stub one out so we can eyeball the math.
    sample = {"hip": 96.0, "waist_narrowest": 76.0}

    print("Pull-on (Fromsa's rule — waistband = hip + ease):")
    print(" ", build_waistband(sample, closure="none"))
    print()
    print("Fitted with zipper (waist-anchored):")
    print(" ", build_waistband(sample, closure="zipper"))
    print()
    print("Stretch fabric, no ease:")
    print(" ", build_waistband(sample, closure="elastic", ease_cm=0,
                               fabric_note="rib knit, 30% stretch"))
