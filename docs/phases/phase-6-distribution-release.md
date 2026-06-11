# Phase 6 开发文档：分发、更新与发布流水线

> 阶段目标：从“开发者能 pack”升级为“用户可安装、系统可信、版本可更新、发布可重复”。  
> 范围约束：不泄露签名/公证凭据；PR 只跑 test/build，tag release 才执行签名、公证与 artifact 发布。

## 1. 本阶段交付

- 补齐 macOS electron-builder 配置：icon、hardened runtime、entitlements、afterSign notarization hook。
- 新增 build assets：`build/icon.png`、`build/icon.icns`、`build/entitlements.mac.plist`、`build/notarize.js`。
- 新增更新检查能力：About 页显示版本、打包状态、更新检查状态。
- 新增 release workflow：PR/test-build 与 tag dist artifact 分离。
- 新增 `docs/release-checklist.md`。

## 2. 安全规则

- 公证凭据只从环境变量读取。
- 缺少 Apple env 时 notarize hook 必须跳过，而不是失败开发构建。
- renderer 不接触签名、公证、GitHub token 或本地证书。
- 更新检查只返回版本/URL 摘要，不执行静默安装。

## 3. 验收

- `npm run check:syntax` 通过。
- `npm test` 通过。
- `npm run pack` 可生成目录包。
- About 页可读取 app version / packaged 状态，并可触发更新检查。
- release workflow 存在 PR 和 tag 路径。

## 4. Production Code Quality Review 关注点

- afterSign 是否在无凭据开发环境安全跳过。
- About/update IPC 是否不暴露敏感环境变量。
- 打包配置是否包含必要 build assets。
- CI 是否不会在 PR 泄露或要求签名 secret。
