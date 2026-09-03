"""Shared Panel dataclass — the output type every manufacturing module returns.

A Panel is the unit a laser cutter or a downstream nester (SVGnest in op-room.html)
consumes. It carries real cm geometry plus the patternmaking metadata a cutter
needs (grainline, seam allowance, notches).

This is intentionally minimal. As the rules engine grows, Panel may pick up
fields for darts, pleats, ease distribution, lining flags. Add them here so
every component module sees them at the same time.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Literal, Optional

GrainAxis = Literal["vertical", "horizontal", "bias"]
Role = Literal[
    "front", "back", "side", "sleeve", "collar", "facing",
    "lining", "pocket", "waistband", "yoke", "cuff", "other",
]


@dataclass
class Panel:
    """A single cuttable pattern piece, expressed in centimetres.

    Mirrors the per-panel schema inside GarmentCode JSON (see
    GARMENTCODE_SYSTEM_PROMPT in Back End/op-room.html), with the
    additional manufacturing fields the nester and laser cutter need.

    Conventions:
      - All measurements in cm. No imperial values reach this class.
      - `name` is UPPERCASE (matches the JSON schema convention).
      - `mirror_pair=True` means cut TWO of this panel from a folded
        layer; the nest engine handles the mirror automatically.
      - `seam_allowance_cm` is added OUTSIDE the cut line by the
        nester / DXF exporter — not baked into width/height here.
    """

    name: str
    role: Role
    width_cm: float
    height_cm: float
    grainline: GrainAxis = "vertical"
    seam_allowance_cm: float = 1.0
    mirror_pair: bool = False
    notches: List[str] = field(default_factory=list)
    shape_notes: str = ""

    # Optional fields populated by future modules:
    darts: List[dict] = field(default_factory=list)
    pleats: List[dict] = field(default_factory=list)
    fabric_note: Optional[str] = None

    def to_garmentcode_panel(self) -> dict:
        """Serialise to the same shape used in GarmentCode JSON panels[].

        Lets a Phase 3 step round-trip a JSON → Python panels → JSON without
        information loss, so the JSON tab in op-room.html can keep being the
        source of truth.
        """
        return {
            "name":         self.name,
            "role":         self.role,
            "mirror_pair":  self.mirror_pair,
            "approx_w_cm":  round(self.width_cm, 2),
            "approx_h_cm":  round(self.height_cm, 2),
            "grain_axis":   self.grainline,
            "shape_notes":  self.shape_notes,
            # Manufacturing-only extras (ignored by the GPT-4.1 system prompt,
            # but read by the ezdxf exporter in Phase 5):
            "_seam_allowance_cm": self.seam_allowance_cm,
            "_notches":           self.notches,
        }

    def area_cm2(self) -> float:
        """Bounding-box area. Used by the nester for sort order."""
        return self.width_cm * self.height_cm

    def __repr__(self) -> str:
        m = " ×2(mirror)" if self.mirror_pair else ""
        return (
            f"Panel({self.name}, {self.role}, "
            f"{self.width_cm:.1f}×{self.height_cm:.1f} cm, "
            f"grain={self.grainline}{m})"
        )
