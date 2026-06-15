# Phase 27 插件提交工作流包验证 Review

## Findings

- No blocking issues found.

## Notes

- `validate-plugin-submission-bundle` 只读取 Phase 26 生成的本地 bundle 文件，不调用 install、enable、update、uninstall 或 plugin runner。
- `--require-ready` 明确只是本地 preflight 门禁，失败时阻止“ready-for-human-review”声明，不代表签名信任或人工 approval。
- Validator 会检查 summary 中的 plugin id 与 package hash 是否出现在 report / PR Markdown 中，能防止常见的产物错配或手工替换。
- 对 `summary.outputDir` 和 `summary.files.*` 的绝对路径漂移使用 warning，允许归档目录移动，同时提醒 reviewer 注意路径上下文。
- 本阶段没有改动插件权限模型、renderer 暴露面、API key 管理、runtime sandbox 或 Windows release-ready 支持声明。

## Verification

Review 后需通过：

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

结果：

- 待验证。

## Residual Risk

- 本阶段只验证本地 submission bundle 的结构和一致性，不代表真实第三方提交流程、社区审核 SLA、远端 catalog 工作流或社区运营流程已经产品化。
- `--require-ready` 仍依赖本地 package review 状态；它不是公钥根信任、证书链、发布者身份验证或运行时 smoke evidence。
- 人工 reviewer 仍需要阅读源码、权限、网络 allowlist、签名材料和提交背景后记录 approval。
