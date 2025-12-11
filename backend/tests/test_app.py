import os
import sys
import types
import pytest

TEST_ROOT = os.path.dirname(__file__)
PROJECT_ROOT = os.path.abspath(os.path.join(TEST_ROOT, ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)


@pytest.fixture()
def client(monkeypatch):
    # Provide lightweight stubs so app.py can import without real torch/torchvision
    fake_torch = types.ModuleType("torch")
    fake_torch.cuda = types.SimpleNamespace(is_available=lambda: False)
    fake_torch.load = lambda *args, **kwargs: {}
    sys.modules["torch"] = fake_torch

    fake_tv = types.ModuleType("torchvision")
    fake_tv.transforms = types.SimpleNamespace(
        Compose=lambda x: x,
        ToTensor=lambda *a, **k: lambda y: y,
        Lambda=lambda f: f,
    )
    sys.modules["torchvision"] = fake_tv

    import app  # noqa: E402

    return app.app.test_client()


def test_home_healthcheck(client):
    resp = client.get("/")
    assert resp.status_code == 200
    assert resp.is_json
    body = resp.get_json()
    assert "status" in body

