# Atlas implementation boundary

This repository builds Atlas Creator and Atlas Enterprise from one OpenWorker-compatible runtime. Read `AGENTS.md`, the Atlas PRD, the ADRs, and `docs/implementation-status.md` before editing.

Do not globally rename the `coworker` package, remove the MIT license, enable upstream cloud services by default, or mix Creator and Enterprise domain state. Prefer additions under `atlas/` and small integration points in upstream files.

