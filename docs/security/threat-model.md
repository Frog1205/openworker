# Atlas foundation threat model

## Assets and boundaries

Protected assets include workspace files, model and connector secrets, conversation history, audit records, artifacts, and enterprise/creator product state. Trust boundaries are the desktop webview to loopback runtime, runtime to model/connector services, workspace roots, shell execution, and future control-plane tenancy.

## Foundation controls

- Loopback privileged APIs retain launch-token authentication and browser-origin checks.
- Product manifests are bundled, strictly validated, and cannot execute code.
- Atlas cloud, relay, telemetry, and updater services are disabled unless explicitly configured.
- Creator and Enterprise use distinct native identifiers and state-directory names.
- Existing workspace-root, shell approval, SSRF, secret-redaction, and audit controls remain enabled.

## Open risks

- Tauri CSP is not yet enforced (SEC-001).
- The file-backed secret store is not yet backed by Keychain/DPAPI (SEC-002 phase two).
- Tenant-scoped authorization and row-level isolation do not yet exist (SEC-006).
- Signed Atlas update infrastructure and rollback verification do not yet exist (SEC-008).
- Prompt-injection labels and untrusted-content boundaries require connector-level work (SEC-005).
- The inherited GUI toolchain currently has critical/high `npm audit` findings in Vitest/Vite,
  PostCSS, and `xlsx`; development servers must remain loopback-only and untrusted spreadsheet
  ingestion should not be promoted to production until the dependency epic is resolved.

Security assessment confidence: **90%**. Static controls are well understood; signed packaging and real connector deployments require environment-specific validation.
