# Phase 21 开发文档：Weather 示例插件开发者资产

> 阶段目标：补齐一个覆盖 `network` 权限和 HTTPS allowlist 的可运行示例插件，让插件开发者能从真实包结构理解网络能力边界。
> 范围约束：不改变插件运行时权限模型，不接入真实天气服务，不引入 API key，不改变 macOS / Windows release-ready 口径。

## 1. 背景

Phase 20 已经新增 Focus Timer 示例插件，覆盖 `pet:say`、`storage`、配置 schema、安装审查和本地插件 runner 路径。但插件 SDK 里风险更高的 `network` 权限仍只有 service 层测试和文档说明，缺少一个完整示例包展示 manifest allowlist、请求写法、storage 与 pet speech 如何组合。

为了继续完善项目文档设计和生态冷启动，本阶段新增 Weather Status 示例插件。它使用示例域名 `api.weather.example.com`，测试中通过注入 `fetchImpl` 返回固定 JSON，因此不会依赖真实外网，也不会把任何 API key 暴露给插件。

## 2. 目标

- 新增 `examples/plugins/weather-status/` 示例插件包。
- manifest 声明 `network`、`pet:say`、`storage` 权限和 `api.weather.example.com` allowlist。
- 插件实现 `refresh` 与 `last` 命令，覆盖网络请求、结果归一化、私有存储和宠物发言。
- 新增真实 `PluginInstallService` + `PluginService` 测试，使用 fake fetch 验证 allowlisted HTTPS 请求路径。
- 更新插件开发指南和 live docs 中的测试数量、最新阶段和生态示例说明。

## 3. 非目标

- 不加入真实天气 API provider。
- 不加入 API key 配置或 secret 流程。
- 不扩大网络权限模型；敏感 header、非 HTTPS、非 allowlist host 等仍由现有 service 拒绝。
- 不改变 Control Center UI。
- 不改变 Windows 发布支持声明。

## 4. 实现记录

新增文件：

- `examples/plugins/weather-status/plugin.json`：声明插件 id、命令、权限和 allowlist。
- `examples/plugins/weather-status/config.schema.json`：声明 location、units、announce 三个配置项。
- `examples/plugins/weather-status/index.js`：实现 `refresh` / `last` 命令。
- `examples/plugins/weather-status/README.md`：说明示例覆盖的网络权限和包结构。
- `tests/examples/weather-status-plugin.test.js`：覆盖 inspect/install disabled-by-default，以及本地插件服务 SDK 的 network/storage/pet speech 路径。

更新文件：

- `docs/plugin-development.md`：新增 Network Example，指向 Weather Status。
- `README.md` / `README.zh-CN.md`：更新测试数、Phase 21 链接、示例插件入口和 v1.1 剩余示例描述。
- `AGENTS.md`：更新 Node 测试数量。
- `docs/HANDOFF.md`：更新当前状态、最新阶段指针、文件地图、测试数量和后续插件 TODO。
- `docs/jishuwendang.md`：更新测试数量和 examples 结构。
- `docs/productization-roadmap.md`：更新当前基线、阶段列表和 v1.1 示例插件剩余项。
- `docs/project-documentation-design.md`：追加 Phase 21 阶段治理记录。
- `docs/project-status-review.md`：更新项目状态、测试数量、文档数量和生态冷启动说明。

## 5. 设计说明

Weather Status 使用 `ctx.network.fetch()` 请求：

```text
https://api.weather.example.com/v1/current?location=<location>&units=<units>
```

manifest allowlist 只包含 `api.weather.example.com`。请求 header 只包含 `accept: application/json`，避免 authorization/cookie 等敏感 header。测试通过注入的 fake fetch 断言最终请求会被 `PluginService` 归一化为 `GET`、小写 header、`redirect: manual`。

插件把返回 JSON 归一化为：

```json
{
  "location": "Berlin",
  "units": "imperial",
  "condition": "Sunny",
  "temperature": 22,
  "humidity": 40
}
```

并保存到 `lastWeather`，同时递增 `refreshCount`。`last` 命令只读 storage，不再次发起网络请求。

## 6. 验证

阶段验证命令：

```bash
node --check examples/plugins/weather-status/index.js
node --test tests/examples/weather-status-plugin.test.js
npm test
npm run test:control-center
npm run check:syntax
git diff --check
```

预期结果：

- Weather 示例插件语法检查通过。
- Weather 示例插件单测 2/2 通过。
- 全量 Node 测试 264/264 通过。
- Control Center Playwright UI 测试 9/9 通过。
- 语法检查与 Control Center 构建通过。
- diff whitespace 检查通过。

## 7. 残留风险

- Weather Status 是开发者示例，不证明任何真实天气服务可用性。
- 网络能力仍只在 service 测试和示例 fake fetch 中验证；真实第三方插件生态仍需社区提交与审核流程验证。
- Windows release-ready 状态不变，仍需要签名产物证据和真实 Windows smoke validation。
