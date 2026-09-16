"""Maya · manufacturing rules engine (Phase 4).

Public API:
    Panel             — the cuttable-piece dataclass every module returns
    build_waistband   — first concrete component builder
"""

from .panel import Panel
from .waistband import build_waistband

__all__ = ["Panel", "build_waistband"]
