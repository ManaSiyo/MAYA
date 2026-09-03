"""Tests for the waistband builder.

Run with:
    cd "Back End"
    python -m unittest manufacturing.tests.test_waistband -v

Pure stdlib — no pytest dependency yet. If the test surface grows we can
swap to pytest, but this keeps Phase 4 zero-deps.
"""

import unittest

from manufacturing import Panel, build_waistband
from manufacturing.waistband import (
    DEFAULT_FITTED_EASE_CM,
    DEFAULT_HEIGHT_CM,
    DEFAULT_PULL_ON_EASE_CM,
)


class TestWaistbandLengthRule(unittest.TestCase):
    """The headline rule: pull-on waistband length = hip + ease."""

    def test_pull_on_uses_hip_plus_default_ease(self):
        wb = build_waistband({"hip": 96.0}, closure="none")
        self.assertAlmostEqual(wb.width_cm, 96.0 + DEFAULT_PULL_ON_EASE_CM)

    def test_elastic_uses_hip_plus_default_ease(self):
        # Elastic counts as pull-on — the band has to clear the hip.
        wb = build_waistband({"hip": 90.0}, closure="elastic")
        self.assertAlmostEqual(wb.width_cm, 90.0 + DEFAULT_PULL_ON_EASE_CM)

    def test_pull_on_zero_ease_for_stretch_fabric(self):
        wb = build_waistband({"hip": 96.0}, closure="none", ease_cm=0)
        self.assertAlmostEqual(wb.width_cm, 96.0)

    def test_pull_on_explicit_ease_override(self):
        wb = build_waistband({"hip": 96.0}, closure="none", ease_cm=5)
        self.assertAlmostEqual(wb.width_cm, 101.0)


class TestWaistbandClosureBranch(unittest.TestCase):
    """Closure-bearing waistbands anchor to the waist, not the hip."""

    def test_zipper_uses_waist_plus_default_ease(self):
        wb = build_waistband(
            {"hip": 96.0, "waist_narrowest": 76.0},
            closure="zipper",
        )
        self.assertAlmostEqual(wb.width_cm, 76.0 + DEFAULT_FITTED_EASE_CM)

    def test_zipper_falls_back_to_hip_when_waist_missing(self):
        # Designers regularly forget to enter waist. The builder should
        # produce a usable (if oversized) panel instead of crashing.
        wb = build_waistband({"hip": 96.0}, closure="zipper")
        self.assertAlmostEqual(wb.width_cm, 96.0 + DEFAULT_FITTED_EASE_CM)


class TestWaistbandGeometry(unittest.TestCase):
    """Defaults match Pattern Book recommendations."""

    def test_default_height_is_4cm(self):
        wb = build_waistband({"hip": 96.0}, closure="none")
        self.assertAlmostEqual(wb.height_cm, DEFAULT_HEIGHT_CM)
        self.assertAlmostEqual(wb.height_cm, 4.0)

    def test_grainline_is_horizontal(self):
        # Waistband is cut on the cross-grain — length along the weft.
        wb = build_waistband({"hip": 96.0}, closure="none")
        self.assertEqual(wb.grainline, "horizontal")

    def test_role_and_name(self):
        wb = build_waistband({"hip": 96.0}, closure="none")
        self.assertEqual(wb.role, "waistband")
        self.assertEqual(wb.name, "WAISTBAND")

    def test_notches_are_cf_cb_and_side_seams(self):
        wb = build_waistband({"hip": 96.0}, closure="none")
        self.assertEqual(wb.notches, ["CF", "CB", "SS-L", "SS-R"])

    def test_not_mirror_paired(self):
        # Cut as a single long strip — no fold mirroring.
        wb = build_waistband({"hip": 96.0}, closure="none")
        self.assertFalse(wb.mirror_pair)


class TestWaistbandFailureModes(unittest.TestCase):
    def test_missing_hip_pull_on_raises(self):
        with self.assertRaises(KeyError):
            build_waistband({}, closure="none")

    def test_missing_everything_closure_raises(self):
        with self.assertRaises(KeyError):
            build_waistband({}, closure="zipper")

    def test_zero_hip_ignored_with_fallback(self):
        # Zero is a sentinel for "designer forgot to enter this". The
        # builder treats it as missing and falls back where possible.
        with self.assertRaises(KeyError):
            build_waistband({"hip": 0}, closure="none")

    def test_string_measurement_coerced(self):
        # backend.html stores measurements from text inputs — they
        # often arrive as strings. The builder must coerce them.
        wb = build_waistband({"hip": "96"}, closure="none")
        self.assertAlmostEqual(wb.width_cm, 96.0 + DEFAULT_PULL_ON_EASE_CM)


class TestPanelSerialisation(unittest.TestCase):
    def test_to_garmentcode_panel_round_trips_dimensions(self):
        wb = build_waistband({"hip": 96.0}, closure="none")
        gc = wb.to_garmentcode_panel()
        self.assertEqual(gc["role"], "waistband")
        self.assertEqual(gc["grain_axis"], "horizontal")
        self.assertAlmostEqual(gc["approx_w_cm"], 98.0)
        self.assertAlmostEqual(gc["approx_h_cm"], 4.0)


if __name__ == "__main__":
    unittest.main()
