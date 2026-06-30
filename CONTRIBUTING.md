# Contributing to usmart-cli

感谢你对 usmart-cli 的贡献兴趣！

## 开发流程

1. Fork 仓库并克隆到本地。
2. 创建功能分支：`git checkout -b feat/your-feature` 或 `fix/your-bug`。
3. 提交改动：`git commit -m "feat: add xxx"`。
4. 推送到你的 Fork 并创建 Pull Request。

## 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/)：

- `feat:` 新功能
- `fix:` 修复
- `docs:` 文档
- `test:` 测试
- `refactor:` 重构
- `chore:` 其他

## 代码要求

- 所有改动需通过 `npm test`。
- 新增命令需补充对应 `skills/` 下的 SKILL.md。
- 不要提交敏感信息（密码、私钥、token）。

## 添加新 API 命令

参考 `src/commands/usmart.js`，使用 `registerCommand` 注册新命令，并在 `skills/usmart/SKILL.md` 中补充使用示例。
