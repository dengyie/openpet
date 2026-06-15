# Phase 22 开发文档：RSS 示例插件开发者资产

> 阶段目标：补齐一个覆盖公开 feed 内容源的可运行示例插件，让插件开发者能从真实包结构理解 `network` allowlist、XML/RSS 内容解析、storage 缓存与宠物播报如何组合。
> 范围约束：不改变插件权限模型，不接入真实 RSS 服务，不引入 npm 依赖，不改变 macOS / Windows release-ready 口径。

## 1. 背景

Phase 20 新增 Focus Timer 示例插件，覆盖 `storage` 与 `pet:say`。Phase 21 新增 Weather Status 示例插件，覆盖 `network` 权限、HTTPS allowlist、JSON 响应处理与 fake fetch 测试路径。

插件开发者仍缺少一个更贴近常见第三方内容源的示例：从公开 RSS/Atom feed 拉取 XML、归一化条目、缓存最近内容，再让宠物播报。这类插件常见于新闻、博客、release feed、社区动态等场景，能帮助生态冷启动继续从“能跑”走向“能参考”。

## 2. 目标

- 新增 `examples/plugins/rss-reader/` 示例插件包。
- manifest 声明 `network`、`pet:say`、`storage` 权限和 `feeds.example.com` allowlist。
- 插件实现 `refresh` 与 `latest` 命令，覆盖 feed 请求、RSS/Atom 轻量解析、私有存储和宠物发言。
- 新增真实 `PluginInstallService` + `PluginService` 测试，使用 fake fetch 验证 allowlisted HTTPS feed 请求路径。
- 更新插件开发指南和 live docs 中的测试数量、最新阶段和生态示例说明。

## 3. 非目标

- 不支持任意用户输入 host；示例 host 固定在 manifest allowlist 中。
- 不接入真实 RSS provider，不依赖外网。
- 不引入 RSS parser npm 依赖；示例只演示轻量、可审查的文本解析。
- 不扩大网络权限模型；敏感 header、非 HTTPS、非 allowlist host 等仍由现有 service 拒绝。
- 不改变 Control Center UI。
- 不改变 Windows 发布支持声明。

## 4. 实现记录

新增文件：

- `examples/plugins/rss-reader/plugin.json`：声明插件 id、命令、权限和 allowlist。
- `examples/plugins/rss-reader/config.schema.json`：声明 feedPath、maxItems、announce 三个配置项。
- `examples/plugins/rss-reader/index.js`：实现 `refresh` / `latest` 命令和最小 RSS/Atom 字段解析。
- `examples/plugins/rss-reader/README.md`：说明示例覆盖的 feed 网络权限和包结构。
- `tests/examples/rss-reader-plugin.test.js`：覆盖 inspect/install disabled-by-default，以及本地插件服务 SDK 的 network/storage/pet speech 路径。

更新文件：

- `docs/plugin-development.md`：新增 RSS/Feed Example，指向 RSS Reader。
- `README.md` / `README.zh-CN.md`：更新测试数、Phase 22 链接、示例插件入口和 v1.1 剩余示例描述。
- `AGENTS.md`：更新 Node 测试数量。
- `docs/HANDOFF.md`：更新当前状态、最新阶段指针、文件地图、测试数量和后续插件 TODO。
- `docs/jishuwendang.md`：更新测试数量、测试文件数和 examples 结构。
- `docs/productization-roadmap.md`：更新当前基线、阶段列表和生态冷启动状态。
- `docs/project-documentation-design.md`：追加 Phase 22 阶段治理记录。
- `docs/project-status-review.md`：更新项目状态、测试数量、文档数量和生态冷启动说明。

## 5. 设计说明

RSS Reader 使用 `ctx.network.fetch()` 请求：

```text
https://feeds.example.com/<feedPath>
```

manifest allowlist 只包含 `feeds.example.com`。请求 header 只包含：

```json
{
  "accept": "application/rss+xml, application/xml, text/xml"
}
```

测试通过注入 fake fetch 断言最终请求会被 `PluginService` 归一化为 `GET`、小写 header、`redirect: manual`。

插件把 RSS fixture 归一化为：

```json
{
  "title": "OpenPet Updates",
  "sourceUrl": "https://feeds.example.com/release.xml",
  "items": [
    {
      "title": "Phase 22 lands",
      "link": "https://openpet.example.com/releases/phase-22",
      "publishedAt": "Mon, 15 Jun 2026 10:00:00 GMT",
      "summary": "RSS example plugin ready."
    }
  ]
}
```

并保存到 `lastFeed`，同时递增 `refreshCount`。`latest` 命令只读 storage，不再次发起网络请求。

## 6. 验证

阶段验证命令：

```bash
node --check examples/plugins/rss-reader/index.js
node --check tests/examples/rss-reader-plugin.test.js
node --test tests/examples/rss-reader-plugin.test.js
npm test
npm run test:control-center
npm run check:syntax
git diff --check
```

预期结果：

- RSS 示例插件语法检查通过。
- RSS 示例插件测试 2/2 通过。
- 全量 Node 测试 266/266 通过。
- Control Center Playwright UI 测试 9/9 通过。
- 语法检查与 Control Center 构建通过。
- diff whitespace 检查通过。

## 7. 残留风险

- RSS Reader 是开发者示例，不证明任意真实 feed 的兼容性、认证、限流或编码处理已经产品化。
- XML 解析 intentionally lightweight，只覆盖示例所需的 RSS/Atom 常见字段，不替代通用 XML parser。
- 真实第三方插件提交、签名根信任和社区审核流程仍未形成。
- Windows release-ready 状态不变，仍需要签名产物证据和真实 Windows smoke validation。
