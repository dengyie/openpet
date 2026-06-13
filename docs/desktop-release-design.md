# OpenPet Desktop Release Design: macOS + Windows

> Scope: desktop release design for macOS and Windows only. Mobile is out of scope for the current release track, and Linux is deferred until there is an explicit support decision.

## 1. Current Baseline

OpenPet is already an Electron desktop pet runtime platform with a macOS release baseline:

- `npm start` builds the Control Center and launches Electron for development.
- `npm run pack` creates a local directory package with the current electron-builder config.
- `npm run dist` uses electron-builder and currently validates the macOS release path.
- `package.json` contains macOS build targets (`dmg`, `zip`) and macOS signing/notarization settings.
- `.github/workflows/release.yml` runs on `macos-latest` and uploads macOS release artifacts.
- `docs/release-checklist.md` documents macOS signing, notarization, update checks, and upgrade compatibility.

Windows is an Electron-compatible target, but it is not release-ready yet. The repository does not currently define Windows package targets, Windows signing inputs, Windows CI runners, or a Windows smoke-test matrix.

## 2. Platform Support Statement

| Platform | Current Status | Release Claim |
|----------|----------------|---------------|
| macOS | Implemented and locally validated | Release baseline exists; official release requires signed/notarized artifacts |
| Windows | Planned desktop target | Do not claim release-ready until build config, CI, signing notes, and smoke tests land |
| Linux | Deferred | Do not include in current support matrix |
| Mobile | Out of scope | Do not design or document for this release track |

Public docs should describe OpenPet as a desktop platform. When platform specifics are needed, say macOS is the current validated release baseline and Windows desktop support is planned.

## 3. Target Release Model

### macOS

- Artifact targets: `dmg` and `zip`.
- Local/dev builds may be unsigned.
- Official releases should use Developer ID signing, hardened runtime, and notarization.
- Validation commands:

```bash
codesign --verify --deep --strict --verbose=2 "release/mac/OpenPet.app"
spctl --assess --type execute --verbose=4 "release/mac/OpenPet.app"
```

### Windows

- Artifact targets: NSIS installer (`.exe`) and portable/archive `zip`.
- Initial architecture: `x64`.
- `arm64` can be added after a real device or CI validation path exists.
- Local/dev builds may be unsigned.
- Official releases should use Windows code signing. Without signing and reputation, SmartScreen warnings are expected.

## 4. Build Configuration Plan

Keep the existing macOS configuration unchanged, then add Windows-specific config in a follow-up implementation pass:

- Add `build/win` to `package.json` with `target: ["nsis", "zip"]`.
- Add `build/icon.ico` for Windows installers and taskbar identity.
- Add NSIS metadata such as one-click behavior, per-machine/per-user install decision, shortcut behavior, uninstall display name, and artifact naming.
- Keep `appId`, `productName`, `publish`, `files`, and `extraResources` shared where possible.
- Keep all platform-specific signing credentials outside source control and only read them from CI secrets or local environment variables.

Before this lands, README commands should not imply that `npm run dist` already produces validated Windows installers.

## 5. CI And Release Plan

The release workflow should become a two-job desktop matrix or two explicit jobs:

| Job | Runner | Purpose | Expected Artifacts |
|-----|--------|---------|--------------------|
| macOS | `macos-latest` | test, syntax, build, pack/dist, optional signing/notarization | `.dmg`, `.zip`, `.blockmap`, `latest-mac.yml` |
| Windows | `windows-latest` | test, syntax, build, dist, optional code signing | `.exe`, `.zip`, `.blockmap`, `latest.yml` |

Release uploads should keep artifact names platform-explicit, for example `OpenPet-${version}-mac.dmg` and `OpenPet-${version}-win-x64.exe`, so About/update checks and manual downloads are unambiguous.

PR workflows should remain unsigned and must not require signing secrets. Tag workflows can require official signing secrets for public release artifacts, or publish clearly labeled unsigned prerelease artifacts when the release owner chooses that policy.

## 6. Desktop Verification Matrix

Run this matrix before claiming Windows release readiness and before each official desktop release:

| Area | macOS | Windows |
|------|-------|---------|
| App launch | Packaged app starts and remains running | Installed app starts and remains running |
| Transparent pet window | Alpha background renders correctly | Alpha background renders correctly |
| Window behavior | `alwaysOnTop`, `skipTaskbar`, drag, bounds work | `alwaysOnTop`, taskbar behavior, drag, bounds work |
| Control Center | Opens all tabs | Opens all tabs |
| Pet actions | Built-in sprites and imported frame folders work | Built-in sprites and imported frame folders work |
| User data upgrade | Legacy `appData/ibot` path remains active | Legacy data compatibility strategy is verified on Windows paths |
| Settings | All new configuration is operable through UI | All new configuration is operable through UI |
| API keys | Renderer/plugins never receive plaintext secrets | Renderer/plugins never receive plaintext secrets |
| Plugins | Official plugins validate; local runner remains isolated | Permission-model runner works on Windows paths and shell semantics |
| Pet packs | Import/enable/delete works under `userData` | Import/enable/delete works under `%APPDATA%` path |
| Local HTTP/MCP | Default off, loopback only, token-gated | Default off, loopback only, token-gated |
| About/update | Version and update summary are correct | Version and update summary are correct |
| Install/uninstall | Install, relaunch, update, remove | Install, relaunch, update, uninstall |

## 7. Windows-Specific Risks

- Transparent click-through and shaped-window behavior may differ from macOS compositor behavior.
- `alwaysOnTop`, taskbar visibility, and focus activation need manual validation.
- SmartScreen reputation is a product trust issue even when the binary is technically signed.
- Path separators, spaces in `%APPDATA%`, and archive extraction can expose assumptions in plugin and pet-pack import code.
- The local third-party plugin runner relies on Node permission-model behavior; verify it on Windows before enabling public plugin claims.
- Native dependencies such as `sharp` must install and load correctly on Windows CI and clean user machines.
- Existing zip extraction flows that depend on platform tools should be replaced or validated before Windows support is declared.

## 8. Acceptance Gates

Windows desktop support can be called release-ready only after all of these are complete:

- Documentation states macOS and Windows support consistently.
- `package.json` defines Windows package targets and Windows icon assets.
- Release workflow has a Windows runner and uploads Windows artifacts.
- Windows signing policy is documented, even if early prereleases remain unsigned.
- The desktop verification matrix passes on a clean Windows machine or CI-backed manual test environment.
- About/update behavior distinguishes macOS and Windows release assets.
- `npm start`, `npm test`, `npm run check:syntax`, and macOS packaging remain functional after the Windows changes.

Until those gates pass, the correct project status is: macOS release baseline complete; Windows desktop release planned and documented.
