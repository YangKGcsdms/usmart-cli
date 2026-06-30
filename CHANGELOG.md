# Changelog

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
