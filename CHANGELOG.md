# Changelog

## [1.1.0] - 2026-07-01

### Added

- `usmart install`：一键把 skills 分发到所有 AI Agent（自动 `npx skills add`）。
- `usmart skills list` / `usmart skills read`：读取与 CLI 同版本的内置 skill。
- `usmart update`：同步 skills 到最新。
- token 会话缓存（`~/.config/usmart-cli/session.json`，600 权限），跨命令复用，避免每次重新登录。
- `--dry-run` 真正生效：写操作仅打印将发起的请求（method/url/body），不发送、不需 `--yes`。
- 支持 `USMART_CONFIG_DIR` 环境变量隔离配置/会话目录。

### Fixed

- `config-init` 改用包内示例文件路径，修复全局安装下生成空配置的问题。
- `status` / `doctor` 改为读取真实会话缓存，不再恒为未登录。

### Changed

- 移除顶层 `config` / `auth` / `api` 桩命令与重复的 config/client 模块，命令面统一到 `usmart usmart …`。
- skill `cli-dev` → `usmart-cli-dev`（加前缀避免跨项目撞名），并重写 `usmart-auth` skill 对齐真实流程。
- 修正仓库 slug 为 `YangKGcsdms/usmart-cli`；`package.json` 增加 `files` 白名单精简发布包。

## [1.0.0] - 2026-06-30

### Added

- 初始版本发布。
- uSMART 自动登录与交易解锁（参考 Java `UsmartAspect` AOP 设计）。
- 完整 uSMART API 命令：持仓、资产、委托、成交、流水、行情、K 线、下单、撤单、碎股。
- RSA 签名与加密（对齐 Java `UsmartRsaUtil`）。
- 交易写操作 `--yes` 确认门禁。
- AI Agent Skills 支持（Claude Code / Cursor / Codex 等）。
- 单元测试覆盖 RSA、配置、会话管理、HTTP 客户端。
- npm 安装后引导提示。
