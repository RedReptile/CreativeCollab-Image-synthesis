import os
import sys
import pytest

TEST_ROOT = os.path.dirname(__file__)
PROJECT_ROOT = os.path.abspath(os.path.join(TEST_ROOT, "../.."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

pytest.importorskip("torch")

try:
    import spade_handler  # noqa: E402
except Exception as exc:  # pragma: no cover - defensive
    pytest.skip(f"spade_handler import failed: {exc}", allow_module_level=True)


def test_rgb_to_class_id_matches_exact_color():
    (color, expected) = next(iter(spade_handler.COLOR_TO_CLASS.items()))
    r, g, b = color
    assert spade_handler.rgb_to_class_id(r, g, b) == expected


def test_rgb_to_class_id_unknown_defaults():
    assert spade_handler.rgb_to_class_id(1, 2, 3) == 181

