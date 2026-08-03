# Atlas

面向创造者与企业的本地优先 AI 工作执行基础设施。

Atlas 将用户意图转化为可追踪的任务和可打开、可审核、可复用的真实交付物，而不只是提供一个聊天窗口。项目基于 OpenWorker 的本地 Agent Runtime 改造，并从同一套代码构建两种产品模式：

- **Atlas Creator**：面向 AI 创客、学员、导师和项目创造流程。
- **Atlas Enterprise**：面向团队的企业 AI 员工底座与标准化 Agent 交付平台。
- **Atlas Agent Core**：两套产品共享的 Agent、模型、工具、权限、记忆、任务、交付物与审计内核。

> **Alpha 基础阶段**：当前仓库已经完成双产品 Manifest、运行时产品上下文、独立应用/数据标识、最小中英国际化和双产品构建入口。Control Plane、Creator 完整项目流程、Enterprise RBAC、签名安装包与生产部署仍在持续开发。

## 核心设计

### 一个内核，两套产品

Creator 和 Enterprise 不是两个长期分叉的 Fork。产品差异由以下机制声明：

- Product Manifest
- Feature Flags
- Theme 与品牌信息
- Policy Profile
- Agent、Skill 与 Connector Bundles
- 独立应用 Identifier 和数据目录

内置产品清单位于：

- `atlas/core/manifests/creator.yaml`
- `atlas/core/manifests/enterprise.yaml`

### 本地优先与安全默认值

- Agent Runtime、会话、密钥和主要工作数据默认保留在本地。
- Atlas 构建默认不连接 OpenWorker Cloud、Relay、Telemetry 或更新服务。
- 高风险操作沿用审批、工作区 Root、Shell 风险和 SSRF 防护机制。
- Creator 与 Enterprise 使用不同数据目录：`com.atlas.creator` 和 `com.atlas.enterprise`。
- 部署级服务配置只能从用户拥有的全局配置启用，工作区配置不能覆盖这些安全边界。

## 架构

```text
Atlas Creator / Atlas Enterprise
              │
              ▼
       Atlas Product Context
 Manifest · Policy · Features · Bundles
              │
              ▼
        Atlas Agent Core
 Session · Model · Tool · Skill · Memory
 Approval · Artifact · Audit · Automation
              │
              ▼
 OpenWorker-compatible local runtime
 Files · Browser · Terminal · MCP · Connectors
```

后续企业交付将在执行平面之外增加 Atlas Control Plane，负责组织、租户、权限、任务调度、审计、用量与 Runtime Registry。本仓库当前不宣称已经达到生产级多租户标准。

## 当前能力

- Python FastAPI Agent Runtime
- React + Vite + Tauri 桌面端
- 多模型 Provider 路由和本地模型支持
- MCP、Skills、Persona 与 Connector
- Memory、Automation、Inbox 与 Approval
- 本地文件、终端、浏览器与交付物生成
- Creator/Enterprise 严格 Product Manifest 校验
- 后端 `/v1/product` 产品上下文契约
- `zh-CN` / `en-US` 新增文案目录
- Windows PowerShell 与 Make 双产品开发入口

## 从源码运行

环境要求：Python 3.10+、Node.js 20+；桌面构建还需要 Rust 工具链和对应平台的原生构建工具。

```bash
git clone https://github.com/Frog1205/openworker.git
cd openworker

python -m venv .venv

# Windows PowerShell
.\.venv\Scripts\pip install -e ".[dev]"
cd surfaces/gui
npm ci
```

启动后端：

```powershell
# Atlas Creator
.\scripts\atlas.ps1 dev -Product creator

# Atlas Enterprise
.\scripts\atlas.ps1 dev -Product enterprise
```

在另一个终端启动 GUI：

```powershell
cd surfaces\gui
$env:ATLAS_PRODUCT = "creator" # 或 enterprise
npm run dev
```

也可以在类 Unix 环境使用：

```bash
make dev PRODUCT=creator
make test PRODUCT=creator
make build-desktop PRODUCT=creator
```

将 `creator` 替换为 `enterprise` 即可切换产品模式。

## 测试

```powershell
# Atlas 产品契约与隔离测试
.\.venv\Scripts\python -m pytest tests/test_atlas_product.py tests/test_atlas_state.py -q

# GUI 测试与生产构建
cd surfaces\gui
npm test
npm run build
```

当前已知的验证状态记录在 [`docs/implementation-status.md`](docs/implementation-status.md)，验收项记录在 [`docs/acceptance-checklist.md`](docs/acceptance-checklist.md)。

## 仓库结构

| 目录 | 说明 |
|---|---|
| `atlas/` | Atlas 产品清单、运行时上下文与后续领域扩展 |
| `coworker/` | OpenWorker-compatible Python Agent Runtime，尽量保持上游兼容 |
| `surfaces/gui/` | React/Vite GUI 与 Tauri 桌面壳 |
| `packaging/` | Windows/macOS 打包工具 |
| `scripts/` | Atlas 开发和测试入口 |
| `tests/` | 后端单元、契约、集成与安全测试 |
| `docs/adr/` | 架构决策记录 |
| `docs/security/` | 威胁模型与安全状态 |

## 开发原则

- 优先在 `atlas/` 中增加扩展，通过窄接口接入上游 Runtime。
- 不全局重命名 `coworker` Python 包，不创建两个长期独立 Fork。
- 不允许工作区或会话配置降低产品安全策略。
- 新增产品文案必须同时维护 `zh-CN` 和 `en-US`。
- 功能必须包含测试、文档、权限检查、错误处理与已知风险说明。

详细设计请阅读：

- [`docs/codebase-assessment.md`](docs/codebase-assessment.md)
- [`docs/adr/ADR-001-atlas-architecture.md`](docs/adr/ADR-001-atlas-architecture.md)
- [`docs/adr/ADR-002-upstream-sync.md`](docs/adr/ADR-002-upstream-sync.md)
- [`docs/adr/ADR-003-product-manifest.md`](docs/adr/ADR-003-product-manifest.md)
- [`docs/security/threat-model.md`](docs/security/threat-model.md)

## Contributors

- [Frog1205](https://github.com/Frog1205) — Atlas 产品方向、架构改造、体验设计与项目维护。
- Codex — 协助完成 Atlas 的工程实现、界面本地化、测试与发布协作。

## Upstream 与许可证

Atlas 基于 [andrewyng/openworker](https://github.com/andrewyng/openworker) 改造，并继续使用其基于 [aisuite](https://github.com/andrewyng/aisuite) 的 Agent Runtime 能力。感谢 OpenWorker、aisuite 及其贡献者。

本项目保留原始 MIT 许可证和版权声明，详见 [`LICENSE`](LICENSE)。Atlas 品牌和新增产品设计不改变上游代码的许可证义务。

---

**English summary:** Atlas is a local-first AI work execution platform built on an OpenWorker-compatible runtime. One shared Atlas Agent Core powers Atlas Creator and Atlas Enterprise through validated product manifests, isolated identities, policies, feature flags, and bundles. The repository is currently in its Alpha foundation stage.
