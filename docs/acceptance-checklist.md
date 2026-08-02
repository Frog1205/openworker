# Atlas foundation acceptance checklist

- [x] Creator and Enterprise manifests load from the same codebase.
- [x] Missing, malformed, and unknown manifest values fail closed.
- [x] Backend `/v1/product` matches the selected runtime context.
- [x] GUI product name comes from backend context with a safe offline fallback.
- [x] Creator and Enterprise native identifiers and state directories differ.
- [x] Atlas defaults do not contact OpenWorker cloud, relay, telemetry, or updater services.
- [x] New Python unit/contract tests pass for both products.
- [x] Relevant Atlas GUI tests and the production web build pass.
- [x] Build configuration can be generated for both products.
- [x] License and upstream attribution remain intact.
- [ ] Native Windows/macOS bundles pass on complete platform toolchains.
- [ ] Inherited critical/high npm dependency findings are remediated or formally accepted.

Acceptance-design confidence: **92%**. Signed Windows/macOS installers require platform credentials and are outside this foundation gate.
