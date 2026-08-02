"""Strict Product Manifest loading and the immutable runtime product contract.

Product-specific behavior is selected here instead of being scattered through the
upstream runtime. Manifests are data only and fail closed on unknown or malformed fields.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from pathlib import Path
from types import MappingProxyType
from typing import Any, Literal, Mapping

import yaml
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

_MANIFEST_DIR = Path(__file__).with_name("manifests")
_PRODUCT_ALIASES = {
    "creator": "creator.yaml",
    "atlas-creator": "creator.yaml",
    "enterprise": "enterprise.yaml",
    "atlas-enterprise": "enterprise.yaml",
}
_SAFE_ID = re.compile(r"^[a-z][a-z0-9]*(?:[-.][a-z0-9]+)*$")


class ProductManifestError(ValueError):
    """A product selection or manifest is missing, invalid, or unsafe."""


class Branding(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    display_name_zh: str = Field(min_length=1)
    tagline_zh: str = Field(min_length=1)
    tagline_en: str = Field(min_length=1)


class ExternalServices(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    cloud_base_url: str | None = None
    relay_ws_url: str | None = None
    oauth_mode: Literal["manual", "atlas", "self-hosted"] = "manual"
    telemetry_enabled: bool = False
    updater_endpoints: tuple[str, ...] = ()


class ProductManifest(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    schema_version: Literal[1]
    id: str
    name: str = Field(min_length=1)
    product_type: Literal["creator", "enterprise"]
    application_identifier: str
    data_directory: str
    theme: Literal["creator", "enterprise"]
    default_locale: Literal["zh-CN", "en-US"]
    supported_locales: tuple[Literal["zh-CN", "en-US"], ...]
    policy_profile: str
    agent_bundles: tuple[str, ...]
    skill_bundles: tuple[str, ...]
    connectors: tuple[str, ...]
    features: dict[str, bool]
    branding: Branding
    external_services: ExternalServices = ExternalServices()

    @field_validator(
        "id", "application_identifier", "data_directory", "policy_profile"
    )
    @classmethod
    def validate_identifier(cls, value: str) -> str:
        if not _SAFE_ID.fullmatch(value):
            raise ValueError("must be a lowercase, path-safe identifier")
        return value

    @field_validator("supported_locales")
    @classmethod
    def validate_locales(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        if not value or len(set(value)) != len(value):
            raise ValueError("supported_locales must be non-empty and unique")
        return value


@dataclass(frozen=True, slots=True)
class ProductRuntimeContext:
    product_id: str
    product_type: str
    name: str
    display_name_zh: str
    locale: str
    supported_locales: tuple[str, ...]
    theme: str
    policy_profile: str
    feature_flags: Mapping[str, bool]
    agent_bundles: tuple[str, ...]
    skill_bundles: tuple[str, ...]
    connector_defaults: tuple[str, ...]
    application_identifier: str
    data_directory: str
    tagline_zh: str
    tagline_en: str
    cloud_base_url: str | None
    relay_ws_url: str | None
    oauth_mode: str
    telemetry_enabled: bool
    updater_endpoints: tuple[str, ...]

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-safe copy; callers cannot mutate the context through it."""
        return {
            "product_id": self.product_id,
            "product_type": self.product_type,
            "name": self.name,
            "display_name_zh": self.display_name_zh,
            "locale": self.locale,
            "supported_locales": list(self.supported_locales),
            "theme": self.theme,
            "policy_profile": self.policy_profile,
            "feature_flags": dict(self.feature_flags),
            "agent_bundles": list(self.agent_bundles),
            "skill_bundles": list(self.skill_bundles),
            "connector_defaults": list(self.connector_defaults),
            "application_identifier": self.application_identifier,
            "data_directory": self.data_directory,
            "tagline_zh": self.tagline_zh,
            "tagline_en": self.tagline_en,
            "cloud_base_url": self.cloud_base_url,
            "relay_ws_url": self.relay_ws_url,
            "oauth_mode": self.oauth_mode,
            "telemetry_enabled": self.telemetry_enabled,
            "updater_endpoints": list(self.updater_endpoints),
        }


def _manifest_path(product: str | None, manifest_path: str | Path | None) -> Path:
    if manifest_path is not None:
        return Path(manifest_path).expanduser().resolve()
    selected = (product or os.environ.get("ATLAS_PRODUCT") or "creator").strip().lower()
    filename = _PRODUCT_ALIASES.get(selected)
    if filename is None:
        choices = ", ".join(sorted(_PRODUCT_ALIASES))
        raise ProductManifestError(
            f"unknown Atlas product {selected!r}; expected one of: {choices}"
        )
    return _MANIFEST_DIR / filename


def load_product_context(
    product: str | None = None, *, manifest_path: str | Path | None = None
) -> ProductRuntimeContext:
    """Load and validate one built-in (or explicitly supplied test/deployment) manifest."""
    path = _manifest_path(product, manifest_path)
    try:
        raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise ProductManifestError(f"cannot read product manifest {path}: {exc}") from exc
    except yaml.YAMLError as exc:
        raise ProductManifestError(f"invalid YAML in product manifest {path}: {exc}") from exc
    if not isinstance(raw, dict):
        raise ProductManifestError(f"product manifest {path} must contain a mapping")
    try:
        manifest = ProductManifest.model_validate(raw)
    except ValidationError as exc:
        raise ProductManifestError(f"invalid product manifest {path}: {exc}") from exc
    if manifest.default_locale not in manifest.supported_locales:
        raise ProductManifestError(
            f"default locale {manifest.default_locale!r} is not supported by {manifest.id}"
        )
    expected_id = f"atlas-{manifest.product_type}"
    if manifest.id != expected_id or manifest.theme != manifest.product_type:
        raise ProductManifestError(
            "manifest id, product_type, and theme must describe the same Atlas product"
        )
    services = manifest.external_services
    return ProductRuntimeContext(
        product_id=manifest.id,
        product_type=manifest.product_type,
        name=manifest.name,
        display_name_zh=manifest.branding.display_name_zh,
        locale=manifest.default_locale,
        supported_locales=manifest.supported_locales,
        theme=manifest.theme,
        policy_profile=manifest.policy_profile,
        feature_flags=MappingProxyType(dict(manifest.features)),
        agent_bundles=manifest.agent_bundles,
        skill_bundles=manifest.skill_bundles,
        connector_defaults=manifest.connectors,
        application_identifier=manifest.application_identifier,
        data_directory=manifest.data_directory,
        tagline_zh=manifest.branding.tagline_zh,
        tagline_en=manifest.branding.tagline_en,
        cloud_base_url=services.cloud_base_url,
        relay_ws_url=services.relay_ws_url,
        oauth_mode=services.oauth_mode,
        telemetry_enabled=services.telemetry_enabled,
        updater_endpoints=services.updater_endpoints,
    )
