# Plugin Service Process Tree Hardening Design

> Date: 2026-06-17
> Phase target: Phase 72

## Goal

Phase 72 strengthens the truthfulness of service stop completion for declaration-only plugin `entries.services`.

OpenPet already:

- starts services as detached process-group roots where supported;
- keeps stop state at `stopping` until exit confirmation arrives;
- escalates stubborn services from `SIGTERM` to one bounded `SIGKILL` attempt.

The remaining gap is after root exit: the host could still report a clean `stopped` result even when known descendants remain alive. Phase 72 closes that gap by adding host-owned descendant inspection and fail-closed stop classification for services only.

## Current State

Before this phase, `PluginService` used a stronger signal path than earlier phases, but it still treated requested root-child exit as sufficient proof of a clean stop.

That left one important operator-trust problem:

- the host could know the root service process exited,
- but still have no check for surviving descendants before claiming `stopped`.

## Scope

In scope:

- add a small host-owned descendant inspection helper for service cleanup verification;
- run that helper after requested service stop exits that were not force-stopped;
- support deterministic unit tests for the helper and the `PluginService` stop-completion path;
- keep setup and declaration-command cleanup out of scope;
- keep runtime state and logs conservative;
- update phase/review/live docs to describe the stronger but still non-absolute cleanup truth.

Out of scope:

- no new renderer UI or new runtime status enum;
- no plugin manifest changes;
- no generic shell/process management API;
- no stronger cleanup signal ladder beyond the existing bounded force-stop path;
- no claim that OpenPet can prove every descendant died on every OS.

## Design

### Decision 1: keep descendant inspection behind a host helper

- Problem: descendant-aware process inspection does not belong inline inside `PluginService`.
- Choice: move OS-specific process-table reading into a focused service helper module.
- Reason: `PluginService` should remain the owner of lifecycle state, not process-table parsing details.

### Decision 2: verify descendants after requested stop exit, not before

- Problem: OpenPet needs authoritative exit confirmation from the root child before it can decide whether a requested stop completed cleanly.
- Choice: keep the existing stop and force-stop signal ordering, then inspect descendants only after root exit for non-force-stop requested stops.
- Reason: this preserves the Phase 68 and Phase 69 semantics and narrows Phase 72 to stop-truth hardening.

### Decision 3: keep the stronger path honest, not absolute

- Problem: descendant inspection could tempt the docs to overclaim universal cleanup.
- Choice: describe the new behavior as service-only descendant verification with fail-closed classification when the host can still observe survivors.
- Reason: OS process-table snapshots are still best-effort and unsupported hosts can only report that stronger verification was unavailable.

## Helper Contract

The helper exposes one narrow function:

```js
listServiceDescendantPids(pid)
```

Expected behavior:

- return `[]` for invalid or missing PIDs;
- on Windows, inspect the process table through PowerShell/CIM output;
- on POSIX-like systems, inspect `ps` output;
- gather descendants recursively from parent/child rows;
- throw if the OS-specific inspection path cannot run so `PluginService` can keep the current bounded result and log that verification was unavailable.

The helper stays internal to the main process service layer.

## PluginService Integration

`PluginService` keeps the current requested-stop flow:

1. process-group `SIGTERM` first, with child fallback;
2. bounded force-stop escalation to `SIGKILL` if needed;
3. exit-confirmed runtime finalization.

Phase 72 only changes step 3 for non-force-stop requested exits:

- if no visible descendants remain, the runtime can still become `stopped`;
- if visible descendants remain, the runtime becomes `failed`;
- if descendant verification is unavailable, the runtime keeps the bounded result but logs that stronger verification was unavailable.

No renderer contract changes are required. Existing logs such as `Service stop requested`, `Service stop grace period expired; force stop requested`, `Service stopped`, and `Service exited after force stop` stay valid, with two new truthful outcomes:

- `Service descendants still running after stop`
- `Service stop verification unavailable`

## Testing Strategy

Required coverage:

1. helper lists POSIX descendants recursively;
2. helper lists Windows descendants recursively;
3. `PluginService` reports `stopped` when root exit leaves no visible descendants;
4. `PluginService` reports `failed` when known descendants survive requested stop;
5. `PluginService` keeps the bounded result and logs verification-unavailable when host inspection cannot run.

This phase does not need a real OS smoke run. Deterministic helper tests are enough for the in-repo contract, as long as the docs stay conservative.

## Acceptance

Phase 72 is complete when:

- service stop still uses the Phase 68 plus Phase 69 bounded cleanup path;
- requested-stop completion no longer treats root exit alone as a clean stop proof;
- helper and service tests cover descendant verification and unavailable-verification fallback;
- docs describe the stronger cleanup truth without upgrading support claims to universal hard guarantees.
