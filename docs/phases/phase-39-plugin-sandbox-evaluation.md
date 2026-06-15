# Phase 39 开发文档：Plugin Sandbox Evaluation

> 阶段目标：在继续扩展第三方插件生态前，把当前插件 runner 的隔离边界、替代方案和 v1.1 推荐结论固化为可生成、可 review 的工程产物。
> 范围约束：本阶段不替换 runner，不引入 SES 依赖，不扩大插件权限，不声明第三方插件“绝对安全”。

## 1. 背景

Phase 38 已明确插件 config 不是 secret store，并提供 `create-openpet-plugin` 脚手架。插件作者路径变清晰后，下一个风险点是 sandbox 口径：当前 runner 已有 child process、Node permission model、VM context 和主进程 SDK 权限检查，但这些能力需要被准确描述，不能被文档或产品话术扩张成绝对安全承诺。

Phase 39 的目标是把这个判断变成可重复生成的评估产物：列出当前 runner 的真实保证和限制，对比 SES 与 Electron `utilityProcess`，并给出 v1.1 是否迁移的结论。

## 2. 实现记录

- 新增 `scripts/create-plugin-sandbox-evaluation.js`：
  - 生成结构化 JSON 或 Markdown 评估。
  - 默认输出到 `docs/plugin-sandbox-evaluation.md`。
  - 不安装依赖、不运行第三方插件、不执行网络访问。
- 新增 `docs/plugin-sandbox-evaluation.md`：
  - 记录当前 runner 的保证和限制。
  - 对比当前 runner、SES、Electron `utilityProcess`。
  - 给出 `keep-current-runner-for-v1.1` 推荐结论。
  - 固化安全话术边界：permission-limited isolated runner, not absolute sandbox。
- 新增 `tests/scripts/create-plugin-sandbox-evaluation.test.js`：
  - 覆盖参数解析。
  - 覆盖评估结构、推荐结论、关键保证、关键限制和候选方案。
  - 覆盖 Markdown / JSON 写出路径。
- 新增 npm script：
  - `create-plugin-sandbox-evaluation`

## 3. 结论

v1.1 继续保留当前 child process + Node permission model + VM runner。

原因：

- 当前方案已经接入 packaged app 路径，迁移风险低。
- SDK 调用仍由主进程权限检查和 allowlist 控制。
- 对当前短生命周期插件命令模型足够清晰。
- SES 不是进程或 OS 文件系统边界，仍需要 OpenPet SDK 策略配合。
- Electron `utilityProcess` 是中期候选，但需要额外 packaged app 验证和生命周期集成。

## 4. 安全话术边界

后续 README、插件文档、提交工具和 release notes 应使用以下口径：

- 可以说：插件是 permission-limited、isolated、reviewed before install。
- 不应说：第三方插件绝对安全、完全沙箱、无法逃逸。
- API keys 和 secrets 仍不得进入 renderer、ordinary plugin storage 或 plugin config。
- 新增高风险权限前必须重新评估 sandbox 策略。

## 5. 重新评估触发条件

- 插件变成长生命周期 background worker。
- 插件申请更宽 filesystem 访问。
- 插件需要 shell、desktop、Electron 或直接 OS 能力。
- 插件崩溃会影响宿主稳定性或用户信任。
- 远程 marketplace 分发超出本地 curated review。
- `utilityProcess` 可以在 macOS / Windows packaged builds 中完成验证。

## 6. 验证

```bash
node --test tests/scripts/create-plugin-sandbox-evaluation.test.js
npm run create-plugin-sandbox-evaluation
npm test
npm run check:syntax
npm run pack
```

## 7. 后续工作

1. Phase 40 进入 Pet Pack Export and Provenance。
2. 如果插件后续新增高风险能力，先更新 `docs/plugin-sandbox-evaluation.md` 或新增 runner POC。
3. 如果迁移到 `utilityProcess`，必须补 packaged app runner smoke。
