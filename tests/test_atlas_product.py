from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from atlas.core.product import ProductManifestError, load_product_context
from coworker.providers import ModelCapabilities, ProviderClient
from coworker.server import SessionManager, create_app


class NoopProvider(ProviderClient):
    def complete(self, **kwargs):  # pragma: no cover - no model calls in contract tests
        raise AssertionError("unexpected model call")

    def capabilities(self, model):
        return ModelCapabilities()


@pytest.mark.parametrize(
    ("selected", "product_id", "app_id", "organization"),
    [
        ("creator", "atlas-creator", "com.atlas.creator", False),
        ("enterprise", "atlas-enterprise", "com.atlas.enterprise", True),
    ],
)
def test_builtin_product_contexts_are_isolated(
    selected, product_id, app_id, organization
):
    context = load_product_context(selected)
    assert context.product_id == product_id
    assert context.application_identifier == app_id
    assert context.data_directory == app_id
    assert context.feature_flags["organization"] is organization
    assert context.locale == "zh-CN"
    assert context.cloud_base_url is None
    assert context.relay_ws_url is None
    assert context.telemetry_enabled is False
    assert context.updater_endpoints == ()


def test_unknown_product_fails_closed():
    with pytest.raises(ProductManifestError, match="unknown Atlas product"):
        load_product_context("not-a-product")


def test_manifest_rejects_unknown_fields(tmp_path: Path):
    path = tmp_path / "bad.yaml"
    path.write_text(
        "schema_version: 1\nid: atlas-creator\nunknown: unsafe\n",
        encoding="utf-8",
    )
    with pytest.raises(ProductManifestError, match="invalid product manifest"):
        load_product_context(manifest_path=path)


@pytest.mark.parametrize("selected", ["creator", "enterprise"])
def test_product_api_matches_manager_context(tmp_path: Path, selected: str):
    context = load_product_context(selected)
    manager = SessionManager(
        workspace=tmp_path,
        provider=NoopProvider(),
        product_context=context,
    )
    client = TestClient(create_app(manager))
    response = client.get("/v1/product")
    assert response.status_code == 200
    body = response.json()
    assert body["product_id"] == context.product_id
    assert body["application_identifier"] == context.application_identifier
    assert body["feature_flags"] == context.feature_flags


def test_atlas_environment_disables_upstream_cloud_defaults(monkeypatch):
    monkeypatch.setenv("ATLAS_PRODUCT", "creator")
    from coworker.config import load_config

    config = load_config(global_path=Path("does-not-exist"))
    assert config.cloud_base_url == ""
    assert config.cloud_relay_ws_url == ""


def test_only_global_deployment_config_can_enable_atlas_service(monkeypatch, tmp_path):
    monkeypatch.setenv("ATLAS_PRODUCT", "enterprise")
    global_config = tmp_path / "global.toml"
    global_config.write_text('cloud_base_url = "https://atlas.example"\n', encoding="utf-8")
    workspace = tmp_path / "workspace"
    (workspace / ".coworker").mkdir(parents=True)
    (workspace / ".coworker" / "config.toml").write_text(
        'cloud_base_url = "https://untrusted.example"\n', encoding="utf-8"
    )
    from coworker.config import load_config

    config = load_config(workspace, global_path=global_config, workspace_trusted=True)
    assert config.cloud_base_url == "https://atlas.example"
