# Atlas development instructions

- Treat `Atlas_OpenWorker_改造PRD_V1.0.md` in the parent directory as the product source of truth.
- Keep upstream-compatible runtime code under `coworker/`; place product-specific behavior under `atlas/` and integrate through narrow hooks.
- Never weaken security settings from workspace or session configuration.
- Every requirement/design assessment must include an explicit confidence score and known uncertainties.
- New product-facing copy must support `zh-CN` and `en-US` before it is considered complete.
- Run targeted tests for the changed product mode and the relevant upstream regression suite.

