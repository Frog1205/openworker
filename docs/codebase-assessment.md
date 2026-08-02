# Atlas codebase assessment

Baseline: `Frog1205/openworker@01b6f83b3927e02912dda84bb392942c13ca70d1` (2026-08-02).

## Current architecture

- `coworker/` is a local-first Python runtime. `coworker.server.app` exposes FastAPI REST and WebSocket APIs; `SessionManager` owns sessions, memory, audit, tools, connectors, skills, personas, approvals, and automation.
- `surfaces/gui/` is a React/Vite client packaged by Tauri. It talks only to the loopback runtime and uses a per-launch token for privileged endpoints.
- `packaging/` builds the Python sidecar and Windows/macOS desktop bundles.
- State is currently resolved globally by `coworker.secrets.state_dir`; product identity is hard-coded across Python, React, Rust/Tauri, packaging, and updater configuration.

## High-conflict files

- `coworker/server/app.py` and `coworker/server/manager.py`: central API and runtime composition.
- `coworker/config.py`, `coworker/secrets.py`, and `coworker/permissions.py`: configuration and security boundaries.
- `surfaces/gui/src/App.tsx`, `surfaces/gui/src/components/Sidebar.tsx`, and `surfaces/gui/src-tauri/src/lib.rs`: main product surface and desktop lifecycle.
- `surfaces/gui/src-tauri/tauri.conf.json` and `packaging/*`: identity, update, and binary assembly.

Changes to these files should remain narrow integration hooks. Atlas business logic belongs under `atlas/`.

## Reusable modules

- Approval, audit, workspace-root enforcement, shell risk analysis, SSRF guard, secret store, artifact discovery, sessions, automation, provider routing, MCP, persona registry, and skill loader are reusable by both products.
- FastAPI and the React API client provide a stable seam for a product-context contract.
- Tauri supports build-time configuration merging, enabling two products from one GUI source.

## Security risks

- Upstream cloud, relay, Auth0, and updater endpoints are enabled or embedded in defaults. Atlas builds must default them off or use Atlas-owned deployment values.
- Tauri CSP is currently `null`; this remains an explicit P0 security backlog item.
- Product state shares the historical `coworker` directory unless the launcher selects a product-specific state directory.
- Secrets are file-backed. OS keychain/DPAPI is deferred by the PRD but the interface boundary is suitable for replacement.
- Tenant isolation is not present in the local runtime and must not be represented as production-ready enterprise multi-tenancy.

## Upstream coupling

The repository closely follows OpenWorker. The safest strategy is an additive `atlas/` package, environment-driven startup hooks, API contracts, and generated build overlays. Global renames or moving runtime modules would make upstream security merges expensive.

## Assessment confidence

Confidence: **94%**. The principal unknowns are production connector behavior requiring real credentials, signed desktop packaging, and the future rate of upstream changes.

