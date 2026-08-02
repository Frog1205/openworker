# ADR-002: Upstream synchronization

Status: accepted

Keep `origin` pointing to `Frog1205/openworker` and `upstream` to `andrewyng/openworker`. Atlas additions should use extension modules and narrow hooks. Each upstream sync branch records the source commit, runs upstream tests before and after merge, runs Atlas regressions for both products, and writes `docs/upstream-sync/<date>.md` before merging to `main`.

No automated sync may resolve security-sensitive conflicts in permissions, the primary FastAPI app, global schemas, or packaging without review.

Decision confidence: **95%**. The remaining uncertainty is upstream churn in GUI and packaging files.

