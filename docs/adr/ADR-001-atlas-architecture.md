# ADR-001: One runtime, two Atlas products

Status: accepted

Atlas Creator and Atlas Enterprise share the OpenWorker-derived execution plane. Product differences are selected through a validated Product Manifest and exposed as an immutable runtime context. Product and domain code is additive under `atlas/`; the `coworker/` package remains upstream-compatible.

The local runtime is the execution plane. Organization, tenant, fleet, and delivery administration will live in a separate control-plane service in later epics. The first foundation does not claim production multi-tenancy.

Consequences: fixes to tools, models, approvals, and connectors benefit both products; product data directories, identifiers, policies, bundles, and feature flags remain isolated; upstream synchronization stays tractable.

Decision confidence: **96%**. This directly follows PRD sections 4-6 and has low implementation ambiguity.

