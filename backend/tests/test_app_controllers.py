import io
import os
import sys
import types
import pytest


def _ensure_lightweight_torch_stubs():
    """Install minimal torch/torchvision stubs so app.py can import in tests."""
    if "torch" not in sys.modules:
        fake_torch = types.ModuleType("torch")
        fake_torch.cuda = types.SimpleNamespace(is_available=lambda: False)
        fake_torch.load = lambda *args, **kwargs: {}
        sys.modules["torch"] = fake_torch

    if "torchvision" not in sys.modules:
        fake_tv = types.ModuleType("torchvision")
        fake_tv.transforms = types.SimpleNamespace(
            Compose=lambda x: x,
            ToTensor=lambda *a, **k: lambda y: y,
            Lambda=lambda f: f,
        )
        sys.modules["torchvision"] = fake_tv


# Ensure stubs installed and import the app module once for all tests
_ensure_lightweight_torch_stubs()
import app  # noqa: E402


@pytest.fixture()
def client():
    return app.app.test_client()


def test_health_endpoint(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["status"] == "healthy"


def test_spade_unavailable_returns_503(client, monkeypatch):
    monkeypatch.setattr(app, "SPADE_AVAILABLE", False)
    resp = client.post("/spade")
    assert resp.status_code == 503
    assert "not available" in resp.get_json()["error"].lower()


def test_stylize_missing_image_returns_400(client, monkeypatch):
    monkeypatch.setattr(app, "STYLE_AVAILABLE", True)
    resp = client.post("/stylize", data={"style": "mosaic"})
    assert resp.status_code == 400


def test_enhance_happy_path(client, monkeypatch):
    # Fake enhancer to avoid PIL work
    def fake_enhance(data):
        return b"jpegbytes"

    monkeypatch.setattr(app, "enhance_image_simple", fake_enhance)
    fake_file = (io.BytesIO(b"123"), "sample.jpg")
    resp = client.post("/enhance", data={"image": fake_file})
    assert resp.status_code == 200
    assert resp.data == b"jpegbytes"
    assert resp.mimetype == "image/jpeg"


def test_reset_password_missing_fields(client):
    resp = client.post("/reset-password", json={"email": ""})
    assert resp.status_code == 400
    assert "required" in resp.get_json()["error"].lower()

