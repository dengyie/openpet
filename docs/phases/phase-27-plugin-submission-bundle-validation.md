# Phase 27 开发文档：插件提交工作流包验证

> 阶段目标：把插件提交工作流包从“可生成”推进到“可本地验收”，让第三方提交材料在进入人工 review 前能被结构化验证。
> 范围约束：不改变插件权限模型，不安装或启用插件，不运行插件代码，不接入远端 marketplace，不把本地 bundle 验证视为人工批准或签名信任。

## 1. 背景

Phase 26 已经提供 `create-plugin-submission-bundle`，一次生成 `plugin-submission-report.md`、`plugin-submission-pr.md` 和 `plugin-submission-summary.json`。但 reviewer 或 contributor 仍需要手动确认 bundle 文件齐全、summary 与 Markdown 产物一致、ready 状态是否可被严格门禁使用。

Phase 27 新增本地 bundle validator，用同一套 CLI 风格检查提交材料完整性。它只读取本地产物，不重新安装插件、不启用插件、不运行插件代码，也不替代人工 review。

## 2. 目标

- 新增 `npm run validate-plugin-submission-bundle -- <bundle-dir>`。
- 验证 bundle 是否包含 report、PR body 和 summary 三个标准文件。
- 验证 `plugin-submission-summary.json` 的关键字段、decision、ready 状态、package hash 和文件路径。
- 检查 summary 中的 plugin id / package hash 是否能在 Markdown report 与 PR body 中找到。
- 提供 `--require-ready`，用于要求 bundle 已达到 `ready-for-human-review`。
- 提供 `--json`，用于 CI 或本地自动化读取验证结果。
- 新增 Node 测试覆盖参数解析、成功 bundle、严格 ready 失败、缺失文件和 summary/Markdown 不一致。

## 3. 非目标

- 不新增真实社区提交流程、远端 catalog 发布、PR bot 或审核 SLA。
- 不建立签名根信任、公钥证书链或发布者身份验证。
- 不改变 `validate:plugin`、submission report、PR packet 或 workflow bundle 的 package review 规则。
- 不安装、启用、更新、卸载或运行第三方插件。
- 不改变 renderer / API key / ordinary plugin 安全边界。
- 不改变 Windows release-ready 支持声明。

## 4. 实现记录

- 新增 `scripts/validate-plugin-submission-bundle.js`：
  - 导出 `parseArgs()`、`expectedFilePaths()`、`loadBundle()` 和 `validateBundle()`。
  - 检查标准文件名、summary JSON、ready/decision 关系、plugin/package/signature/validation 关键字段。
  - 对 bundle 移动后的绝对路径不一致给 warning，不阻止结构验证。
  - `--require-ready` 在 summary 未 ready 时失败。
  - CLI 默认输出人类可读结果，`--json` 输出结构化结果。
- 新增 `tests/scripts/validate-plugin-submission-bundle.test.js`：
  - 使用 Phase 26 bundle generator 创建真实 Focus Timer bundle fixture。
  - 覆盖 ready bundle、strict ready failure、缺失 PR 文件和 summary 与 Markdown 不一致。
- 新增 `package.json` script：`validate-plugin-submission-bundle`。

## 5. 验证计划

```bash
node --check scripts/validate-plugin-submission-bundle.js
node --test tests/scripts/validate-plugin-submission-bundle.test.js
npm run create-plugin-submission-bundle -- examples/plugins/focus-timer --output-dir /tmp/openpet-phase27-submission-bundle
npm run validate-plugin-submission-bundle -- /tmp/openpet-phase27-submission-bundle --require-ready
npm test
npm run test:control-center
npm run check:syntax
git diff --check
```

## 6. 残留风险

- Bundle validator 只证明提交材料结构完整且相互一致，不代表人工审核通过。
- `--require-ready` 只消费 summary 中由本地 package review 得出的状态，不证明 signer identity、远端 catalog 信任或真实运行烟测。
- Bundle 可被移动，validator 会对 summary 中的绝对路径漂移给 warning；这不影响文件内容验证，但仍需 reviewer 关注归档路径。
