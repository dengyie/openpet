# OpenPet Plugin Sandbox Evaluation

Generated at: 2026-06-15T23:43:37.217Z
Phase: 39
Decision: keep-current-runner-for-v1.1
Claim boundary: permission-limited-isolated-runner-not-absolute-sandbox

Compare the current local plugin runner with SES and Electron utilityProcess before expanding third-party plugin trust.

## Current Runner

Label: Current local plugin runner

Files:
- `src/main/services/plugin-service.js`
- `src/main/plugins/local-plugin-runner.js`

### Guarantees

- Local third-party plugins execute in a child process created with child_process.fork.
- The runner starts with Node permission model flags and only allows filesystem reads for the runner file and the plugin main file.
- Plugin source runs inside a VM context with string and WebAssembly code generation disabled.
- The VM bootstrap exposes module exports and a no-op console, but does not expose require, process, Electron APIs, or Node globals as plugin SDK surfaces.
- Plugin SDK operations are bridged to the parent process through JSON-serialized IPC messages.
- Pet, AI, storage, and network operations are permission-checked in the main process before execution.
- Network calls are restricted to HTTPS, manifest allowlisted hosts, GET/POST methods, size limits, and non-sensitive request headers.
- Plugin command execution has a parent-side timeout of 5000ms and runner script execution has a VM timeout of 1000ms.

### Limits

- The current runner should not be described as providing absolute sandbox safety.
- Node permission model behavior depends on the bundled Electron/Node runtime and should stay covered by local smoke and package verification.
- Crash isolation exists at child-process level, but there is no separate Electron utility process lifecycle or Chromium service sandbox boundary.
- The VM context restricts exposed globals but is still in the same child process as the runner bridge code.
- Long-lived background plugins are not part of the current trust model.
- The current design does not grant arbitrary filesystem, shell, Electron, or unrestricted network access.

## Candidate Matrix

| Candidate | Isolation | API restriction | Filesystem | Network | Crash isolation | Packaging cost | Debug cost | Migration risk | Recommendation |
|-----------|-----------|-----------------|------------|---------|-----------------|----------------|------------|----------------|----------------|
| Current child process + Node permission model + VM runner | separate Node child process plus VM context | explicit OpenPet SDK bridge only | Node permission model allows runner and plugin main reads only | main-process HTTPS allowlist and header/body/response limits | child process can be killed and command timeout enforced | already integrated in packaged app path | low; errors already flow through plugin logs and command failures | low | keep for v1.1 while documenting limits |
| SES | hardened JavaScript compartments inside a JavaScript realm | strong object-capability discipline if all endowments are audited | not a process or OS filesystem boundary by itself | must still be mediated by OpenPet SDK policy | no separate process crash boundary by itself | requires adding and validating a new runtime dependency | medium; hardened globals and lockdown can change plugin authoring behavior | medium | research candidate only until dependency, lockdown order, and plugin compatibility are validated |
| Electron utilityProcess | Electron-managed utility process | can host a narrow bridge but still needs SDK mediation | must be combined with explicit runtime restrictions and app policy | must still be mediated by OpenPet SDK policy | stronger app-managed process isolation and lifecycle hooks than a generic child process | requires Electron-specific runner integration and packaged-app validation | medium; process lifecycle and logging become more Electron-specific | medium-high | re-evaluate when plugins need long-lived background execution or stronger crash/process lifecycle isolation |

## Recommendation

Keep the current runner for v1.1, document its guarantees and limits, and avoid adding higher-risk plugin permissions until a utilityProcess or equivalent migration is justified by product requirements.

Required language:
- Describe plugins as permission-limited and isolated.
- Do not describe third-party plugins as absolutely safe.
- Keep API keys and secrets outside renderer code, ordinary plugin storage, and plugin config.
- Treat sandbox strategy as a reviewable product boundary before adding new plugin capabilities.

## Re-Evaluation Triggers

- Plugins become long-lived background workers.
- Plugins request broader filesystem access.
- Plugins need direct desktop, shell, or Electron capabilities.
- A plugin crash can affect host app stability or user trust.
- Remote marketplace distribution expands beyond curated local review.
- Electron utilityProcess integration can be validated in packaged macOS and Windows builds.

## Open Gaps (Milestone M1 backlog, documented 2026-07-01)

### entries OS-level process sandbox

**Severity:** P1 (Manual-required for production)

**Problem:** Plugin `entries.commands`, `entries.services`, and `entries.setup` spawn host OS processes with the full user UID. The current deny-by-default native execution gate (`assertNativeExecutionAllowed` in `plugin-service.js`) requires explicit approval via `setNativeExecutionApproved` before any spawn, and the Control Center now exposes a toggle so users can grant or revoke approval per-plugin. However, once approved, the spawned process runs without OS-level sandboxing (no macOS seatbelt `sandbox-exec`, no Linux `bwrap`/`namespace` isolation). A compromised or malicious entries plugin that has been approved can execute arbitrary code as the user.

**Current mitigation:** Deny-by-default gate + explicit per-plugin approval + revoke stops running processes. The VM sandbox for `main.js` plugins does not apply to entries processes.

**Remaining gap:** OS-level process isolation wrapping `child_process.spawn` calls so approved entries processes inherit a restrictive sandbox profile rather than the full user session. This is Manual-required because macOS seatbelt profiles and Linux bwrap/Namespace setup depend on platform-specific testing, notarization compatibility, and packaged-app validation that cannot be verified without real devices and signing environments.

**Target files (for future implementation):**
- `src/main/services/plugin-service.js` (spawn call sites: `runCommand`, `runSetup`, `startService`)
- New: `src/main/services/plugin-process-sandbox.js` (platform-specific sandbox profile builder)

**Notes:** The `sandbox-exec` deny-by-default profile and `bwrap` namespace isolation are well-documented patterns. The implementation path is narrow (wrap spawn options), but validation requires packaged macOS + Linux runs against real seatbelt/Gatekeeper and bwrap environments. Ed25519 signature verification (see below) complements this by giving users a trust signal before granting native execution approval.

### Plugin package cryptographic signature verification

**Severity:** P1 (Manual-required for production)

**Problem:** The current integrity check computes a SHA-256 hash of the installed plugin directory and stores it. The Control Center displays "File integrity checked (not a trusted source)" to honestly communicate that hash consistency does not prove authorship. Without a cryptographic signature bound to a known public key, hash integrity alone cannot distinguish a legitimate update from a replacement by a different author.

**Current mitigation:** Integrity hash stored on install, compared on load. UI label is intentionally non-trusting. Native execution gate remains deny-by-default regardless of integrity check result.

**Remaining gap:** Ed25519 signature verification of plugin packages. The implementation path requires: (1) a `plugin-signature` manifest field carrying an Ed25519 signature and the signer's public key identifier, (2) a built-in trusted-public-key registry (maintainer keys), (3) signature verification during `inspectPluginPackage`, and (4) a trust-level label upgrade in the Control Center (from "not a trusted source" to "verified author: <key-id>"). This is Manual-required because building a trusted key registry, handling key rotation, and testing against real signed packages require external account/key infrastructure that cannot be simulated in unit tests.

**Target files (for future implementation):**
- `src/main/services/plugin-service.js` (inspectPluginPackage, loadPlugin)
- `src/main/services/plugin-install-service.js` (install paths)
- `src/main/plugins/manifest.js` (signature manifest field)
- New: `src/main/services/plugin-signature-service.js` (Ed25519 verify)

## Next Actions

- Keep the current runner for v1.1 unless a new plugin capability changes the threat model.
- Add packaged-app smoke coverage if the runner implementation moves to utilityProcess.
- Review sandbox wording whenever README, plugin docs, or submission tooling changes.
- Before any production release with third-party entries plugins, resolve the two Open Gaps above: OS-level process sandboxing and Ed25519 signature verification. Both are Manual-required because real signing keys, notarization, and device-level sandbox validation are external to this codebase.

