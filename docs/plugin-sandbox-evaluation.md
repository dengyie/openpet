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

## Next Actions

- Generate and commit docs/plugin-sandbox-evaluation.md from this evaluation.
- Keep the current runner for v1.1 unless a new plugin capability changes the threat model.
- Add packaged-app smoke coverage if the runner implementation moves to utilityProcess.
- Review sandbox wording whenever README, plugin docs, or submission tooling changes.
