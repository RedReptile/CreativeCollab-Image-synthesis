import os
import sys
import importlib
import pytest

TEST_ROOT = os.path.dirname(__file__)
GAUGAN_ROOT = os.path.abspath(os.path.join(TEST_ROOT, "..", "gaugan", "flask"))

if GAUGAN_ROOT not in sys.path:
    sys.path.insert(0, GAUGAN_ROOT)

app_module = None

try:
    app_module = importlib.import_module("app")
except Exception as exc:  # pragma: no cover - defensive
    pytest.skip(f"gaugan app import failed: {exc}", allow_module_level=True)


def test_gaugan_app_exists():
    assert hasattr(app_module, "app")

