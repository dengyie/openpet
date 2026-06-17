# Plugin Authoring Bridge Action Preset Phase 68 Design

> Date: 2026-06-17
> Phase target: Phase 68

## Goal

Phase 68 extends the explicit declaration-only plugin bridge from read-only action discovery into narrow action preset control.

Third-party authors should be able to build useful plugin experiences such as:

- a weather companion that applies a rain-specific idle action;
- a personality plugin that changes click feedback per persona;
- an action recommendation tool that previews or applies a safer default/click pairing;
- a pet dialogue tool that chooses an already-installed action set before speaking.

The host should support that authoring workflow without exposing sprite files, arbitrary config writes, arbitrary filesystem access, pet-pack mutation, or a broad host SDK.

## Current State

OpenPet already has:

- explicit declaration-only command execution with JSON stdin context;
- explicit declaration-only service start/stop controls;
- a loopback-only bridge with `OPENPET_BRIDGE_URL` and `OPENPET_BRIDGE_TOKEN`;
- bridge routes for:
  - `GET /context`
  - `GET /pet/actions`
  - `POST /pet/say`
  - `POST /pet/action`
  - `POST /pet/event`
- `PetService` as the single source of truth for pet-facing runtime state;
- `ActionService` as the current source of normalized action config;
- `ActionImportService` plus existing action/config save flows used by the host UI.

Phase 67 solved action discovery, but third-party authors still cannot safely apply a new default/click action pairing through the bridge. That keeps authors stuck in a half-manual workflow: they can discover action ids, but they still need the host UI or direct file editing to apply the choice.

## Scope

In scope:

- add a narrow bridge route for applying action preset changes;
- allow explicit command and service bridge runs to update:
  - `defaultAction`
  - `clickAction`
- validate that requested action ids already exist in the current action catalog;
- source all writes through existing host services rather than direct file edits;
- return a bounded post-update action summary to the caller;
- update docs and phase records so plugin authors understand the new capability and limits.

Out of scope:

- no creation of new actions;
- no deletion of existing actions;
- no label, kind, timing, atlas, or frame-data editing;
- no sprite generation, image import, or frame-folder mutation;
- no arbitrary config file write access;
- no setup bridge access, service auto-start, background polling, or broader sandbox claims.

## Proposed Route

Add:

- `POST /pet/actions/preset`

Request shape:

```json
{
  "defaultAction": "rain-idle",
  "clickAction": "umbrella-wave"
}
```

Response shape:

```json
{
  "ok": true,
  "actions": {
    "selectedPetId": "legacy-cat",
    "defaultAction": "rain-idle",
    "clickAction": "umbrella-wave",
    "currentActionId": "rain-idle",
    "items": [
      {
        "id": "rain-idle",
        "label": "Rain Idle",
        "kind": "custom",
        "loop": true,
        "frameCount": 16,
        "frameMs": 95
      },
      {
        "id": "umbrella-wave",
        "label": "Umbrella Wave",
        "kind": "custom",
        "loop": false,
        "frameCount": 8,
        "frameMs": 85
      }
    ]
  }
}
```

The response should reuse the bounded action-catalog shape from Phase 67 rather than inventing a second response contract.

## Design

### Source of truth and write path

Phase 68 should preserve existing ownership:

- `PetService` remains the single source of truth for pet-facing state;
- `PluginService` remains the owner of bridge routing, token validation, and runtime scoping;
- existing action-save services remain the only place where action config is mutated.

The bridge must not write config files directly inside `PluginService`.

Instead, `PluginService` should delegate preset changes through an injected host service boundary that already owns action config persistence. If current wiring does not yet expose a focused preset-update method, Phase 68 may add one, but it should still live in the existing pet/action service chain rather than become a bridge-only special case.

### Allowed mutations

The bridge should allow only these fields:

- `defaultAction`
- `clickAction`

Rules:

- each provided action id must already exist in the current action catalog;
- callers may update one field or both fields in one request;
- omitted fields should preserve current values;
- empty strings, unknown action ids, and non-string values should fail with a stable client error;
- the resulting config must stay valid under the same rules used by host-managed action settings.

### Returned fields

After a successful update, return the same bounded catalog summary used by `GET /pet/actions`:

- `selectedPetId`
- `defaultAction`
- `clickAction`
- `currentActionId`
- `items[]` with:
  - `id`
  - `label`
  - `kind`
  - `loop`
  - `frameCount`
  - `frameMs`

The route should continue to exclude:

- sprite file URLs;
- preview sprite URLs;
- root paths;
- atlas geometry;
- frame dimensions;
- writable config locations;
- import directories or asset-generation outputs.

### Bridge placement

This route should live beside the existing Phase 64, 66, and 67 bridge handlers in `PluginService`.

That keeps Phase 68 aligned with current guarantees:

- loopback-only transport;
- token-based authorization;
- per-entry-run scoping;
- shared logging and runtime cleanup;
- no renderer-facing privilege bypass.

### Logging

The host should log successful preset updates with the same `pluginId` and entry id pattern already used by the bridge.

Suggested messages:

- `Bridge pet.actions.preset requested`
- `Bridge pet.actions.preset applied: <defaultAction>/<clickAction>`

These logs must stay token-free and should avoid dumping broad payloads.

## Security Boundary

Phase 68 is intentionally a narrow capability-downshift, not a broad plugin-authoring API.

It remains:

- loopback-only;
- bearer-token gated;
- per-entry-run scoped;
- token-free in logs;
- limited to existing installed actions;
- routed through existing host save logic rather than file writes;
- narrower than exposing asset import, image generation, or arbitrary config editing.

This phase helps plugin authors apply safe action presets without turning the bridge into a filesystem surface or a generalized pet-pack editor.

## Error Model

Expected failures should stay explicit:

- `401` for invalid token, expired run, or missing runtime;
- `415` for non-JSON mutation requests;
- `400` for invalid payload shape, empty strings, or unknown action ids;
- `403` only if a future explicit permission gate is introduced.

Phase 68 should not add a new manifest permission unless implementation evidence shows preset mutation truly needs separate policy from the existing explicit-run bridge model.

Recommendation: keep this capability permissionless within explicit bridge runs for now, because it only selects among already-installed actions and does not widen process or filesystem authority.

## Testing Strategy

Required coverage:

- explicit command bridge runs can call `POST /pet/actions/preset`;
- explicit service bridge runs can call `POST /pet/actions/preset`;
- updating only `defaultAction` preserves `clickAction`;
- updating only `clickAction` preserves `defaultAction`;
- updating both fields returns the bounded updated catalog shape;
- unknown action ids are rejected without partial mutation;
- invalid token and expired bridge requests are rejected;
- `GET /pet/actions` continues to reflect the saved result after a successful preset update;
- existing `GET /context`, `GET /pet/actions`, `POST /pet/say`, `POST /pet/action`, and `POST /pet/event` behavior remains unchanged.

Useful fixture expectations:

- action preset writes flow through existing host save logic;
- response shape still omits `sprite`, `previewSprite`, root paths, and other internals;
- runtime and logs remain scoped to the active bridge run.

## Documentation Impact

Update:

- `README.md`
- `README.zh-CN.md`
- `docs/plugin-development.md`
- `docs/plugin-ecosystem-rules.md`
- `docs/HANDOFF.md`
- `docs/development-summary.md`
- `docs/project-status-review.md`
- `docs/productization-v1.1-todo-design.md`
- `docs/project-context.json`
- new Phase 68 phase/review docs

Docs should frame this as a practical ecosystem step:

- plugins can now discover installed actions and safely apply preset pairings;
- this supports richer pet personality and weather/action orchestration workflows;
- this still does not grant resource generation, sprite editing, or arbitrary config/file access.

## Acceptance

Phase 68 is complete when:

- explicit bridge runs can safely update `defaultAction` and `clickAction` through `POST /pet/actions/preset`;
- updates are validated against the current installed action catalog;
- responses stay bounded to safe action-summary fields;
- invalid token, expired bridge, and invalid action-id requests are rejected;
- docs describe the new preset-update capability without overclaiming broader authoring power.
