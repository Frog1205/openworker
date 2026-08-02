# ADR-003: Product Manifest and runtime context

Status: accepted

Product identity, locale, policy, bundles, connectors, feature flags, application identifier, data-directory name, and external service configuration are declared in versioned YAML manifests under `atlas/core/manifests/`.

The loader rejects unknown fields and unsafe identifiers, supports only registered built-in products by default, and returns a frozen `ProductRuntimeContext`. Selection order is CLI/environment (`ATLAS_PRODUCT`) over the default Creator product. Deployment overrides may be added later, but workspace and session configuration must never weaken product policy.

The backend is authoritative. The GUI reads `/v1/product`; build-time values exist only to establish native application identity before the runtime starts.

Decision confidence: **92%**. Future tenant-policy merge rules need a separate ADR when the control plane exists.

