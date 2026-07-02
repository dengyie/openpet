# OpenPet Agent Awareness Bundled Plugin Design

This document defines the concrete development plan for an official bundled
`openpet.agent-awareness` plugin. The goal is to make OpenPet react to local AI
coding-agent activity without hardcoding Codex, Claude, Gemini, or other
agent-specific behavior into OpenPet core.

Current implementation status:

- service-scoped bridge foundation is implemented in OpenPet core;
- bundled `openpet.agent-awareness` plugin package is not implemented yet;
- Codex hook setup, ingestion, state mapping, and dashboard remain future
  milestones.

## 1. Product Goal

OpenPet should be able to reflect local agent work as pet state:

- the pet shows that an agent session is thinking, working, waiting, blocked, or
  completed;
- the pet can speak short, sanitized status messages;
- the user can inspect a small local dashboard showing recent agent events;
- setup is explicit and reversible;
- no prompt, transcript, tool input, secret, or full local path is exposed.

The first target is Codex awareness. The design must leave room for Claude,
Gemini, or other adapters without changing core runtime boundaries again.

## 2. Non-Goals

This milestone must not introduce these capabilities:

- no `AgentRuntimeService` or agent-specific watcher in OpenPet core;
- no permission approval bubble for agent tool calls;
- no automatic writes to `~/.codex`, `~/.claude`, or other agent config during
  install, sync, enable, or app startup;
- no raw prompt, tool input, terminal transcript, full cwd, stdout/stderr, or
  credential capture;
- no direct Electron, Node, settings, pet-pack, or filesystem access from the
  renderer;
- no AGPL code or asset copying from Clawd on Desk or similar projects.

External projects may inform product ideas, but implementation must be original
and must respect license boundaries.

## 3. Architecture

```text
Local agent hook/log source
  -> adapter-specific event normalizer
  -> openpet.agent-awareness long-running service
  -> session store and state mapper
  -> service-scoped OpenPet bridge
  -> PetService.say / PetService.playAction / PetService.setEvent
  -> Control Center plugin service state and plugin dashboard
```

The OpenPet host remains a platform:

- it syncs bundled official plugins;
- it validates manifests;
- it starts/stops services;
- it provides a small permission-gated bridge;
- it routes pet mutations through `PetService`.

The plugin owns agent-specific behavior:

- Codex hook setup and uninstall;
- adapter parsing;
- status mapping;
- rate limiting;
- dashboard data;
- sanitized local persistence.

## 4. Repository Boundary

### Core Changes Allowed

Only generic plugin-platform changes are allowed in OpenPet core:

- add `examples/plugins/agent-awareness` to bundled plugin sync;
- provide service-scoped bridge credentials to declared plugin services;
- enforce service bridge permission checks and token lifetime;
- document service bridge behavior in extension docs;
- test service bridge creation, route access, and cleanup.

### Plugin Changes Allowed

All agent-specific behavior must live in the bundled plugin:

- agent adapters;
- Codex hook installer and uninstaller commands;
- doctor command;
- service HTTP ingestion endpoint;
- state mapper;
- session store;
- dashboard UI;
- plugin README and config schema.

### Core Changes Not Allowed

Do not add these to core:

- Codex-specific paths or config formats;
- Claude/Gemini-specific paths or config formats;
- agent session models;
- agent status mapping;
- agent hook installation;
- agent event parsing;
- agent dashboard UI.

## 5. Required Core Enhancement: Service-Scoped Bridge

The current declaration-only command bridge is short-lived and already supports
pet routes. Long-running services do not currently receive bridge credentials.
Agent awareness needs a long-running service, so the host needs a generic
service bridge.

### Environment Contract

When a declared service is started, OpenPet should inject:

| Variable | Purpose |
| --- | --- |
| `OPENPET_SERVICE_BRIDGE_URL` | Loopback bridge base URL for the active service runtime. |
| `OPENPET_SERVICE_BRIDGE_TOKEN` | Bearer token scoped to this service runtime. |
| `OPENPET_DATA_DIR` | Plugin-owned persistent data directory. |
| `OPENPET_CACHE_DIR` | Plugin-owned cache directory. |
| `OPENPET_LOG_DIR` | Plugin-owned log directory. |

Do not reuse `OPENPET_BRIDGE_URL` / `OPENPET_BRIDGE_TOKEN` for services. Keeping
separate names makes command and service lifetimes explicit.

### Runtime Scope

The service bridge token must be scoped by:

- `pluginId`;
- `serviceId`;
- `runId`;
- current runtime status.

The token is valid only while the service runtime is `running`. It must be
removed when the service exits, is stopped, fails to spawn, or is force-stopped.

### Service Bridge Routes

V1 service bridge routes:

```text
GET  /context
POST /pet/say
POST /pet/action
POST /pet/event
```

Do not expose creator routes to services in v1. Creator routes are broader
write surfaces and are unnecessary for agent awareness.

### Permission Checks

Routes must be gated by existing manifest permissions:

| Route | Required permission |
| --- | --- |
| `POST /pet/say` | `pet:say` |
| `POST /pet/action` | `pet:action` |
| `POST /pet/event` | `pet:event` |

`GET /context` should return only bounded context already safe for command
bridge use. It must not expose API keys, renderer state, raw settings, or full
user paths.

### Implementation Direction

Prefer extracting the existing command bridge server into a shared runtime
bridge module instead of duplicating HTTP parsing and auth logic:

```text
src/main/services/plugin-runtime-bridge-server.js
src/main/services/plugin-command-bridge-server.js
src/main/services/plugin-service.js
src/main/services/plugin-command-runner.js
```

Expected shape:

- `plugin-runtime-bridge-server.js` owns HTTP server, token validation, route
  dispatch, JSON parsing, and base URL creation;
- command runner registers command-scoped runtimes with command and creator
  handlers;
- service lifecycle registers service-scoped runtimes with pet/context handlers
  only;
- the existing command bridge public behavior remains backward-compatible.

## 6. Bundled Plugin Package Layout

Create the official bundled plugin under:

```text
examples/plugins/agent-awareness/
  plugin.json
  config.schema.json
  README.md
  commands/
    install-codex-hooks.js
    uninstall-codex-hooks.js
    doctor.js
  service/
    agent-awareness-service.js
    bridge-client.js
    session-store.js
    state-mapper.js
    adapters/
      codex.js
  web/
    dashboard/
      index.html
      dashboard.js
      styles.css
```

Keep the first version dependency-free unless a dependency is already used by
the repo and materially reduces risk. The service can use Node's built-in
`http`, `fs`, `path`, and `crypto` modules.

## 7. Manifest Draft

```json
{
  "id": "openpet.agent-awareness",
  "name": "Agent Awareness",
  "version": "0.1.0",
  "profile": "runtime",
  "description": "Reflect local AI coding-agent activity through OpenPet pet status, speech, and dashboard updates.",
  "permissions": ["pet:say", "pet:action", "pet:event"],
  "config": "config.schema.json",
  "entries": {
    "commands": [
      {
        "id": "install-codex-hooks",
        "title": "Install Codex Hooks",
        "command": "node ./commands/install-codex-hooks.js",
        "cwd": "."
      },
      {
        "id": "uninstall-codex-hooks",
        "title": "Uninstall Codex Hooks",
        "command": "node ./commands/uninstall-codex-hooks.js",
        "cwd": "."
      },
      {
        "id": "doctor",
        "title": "Check Agent Awareness Setup",
        "command": "node ./commands/doctor.js",
        "cwd": "."
      }
    ],
    "services": [
      {
        "id": "agent-awareness",
        "title": "Agent Awareness Service",
        "command": "node ./service/agent-awareness-service.js",
        "cwd": ".",
        "health": {
          "type": "http",
          "url": "http://127.0.0.1:8796/health"
        }
      }
    ],
    "dashboards": [
      {
        "id": "main",
        "title": "Agent Awareness",
        "url": "http://127.0.0.1:8796"
      }
    ]
  },
  "manifest": {
    "agentAdapters": ["codex"],
    "dataLocations": [
      {
        "path": "OPENPET_DATA_DIR/sessions.json",
        "description": "Sanitized recent agent session status only."
      }
    ]
  },
  "assets": ["web/dashboard/index.html"]
}
```

Port `8796` is a default. The implementation should allow override through
config if there is a local port collision.

## 8. Config Schema

Initial configuration:

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "enabledAdapters": {
      "type": "array",
      "items": { "type": "string", "enum": ["codex"] },
      "default": ["codex"]
    },
    "port": {
      "type": "integer",
      "minimum": 1024,
      "maximum": 65535,
      "default": 8796
    },
    "announceLevel": {
      "type": "string",
      "enum": ["quiet", "important", "all"],
      "default": "important"
    },
    "retentionHours": {
      "type": "integer",
      "minimum": 1,
      "maximum": 168,
      "default": 24
    }
  }
}
```

`quiet` still updates state and dashboard but does not call `pet.say` except for
explicit test events.

## 9. Event Contract

The service should expose a local loopback ingestion endpoint:

```text
POST http://127.0.0.1:8796/events/codex
```

Accepted body:

```json
{
  "schema": "openpet.agent-awareness.v1",
  "agent": "codex",
  "event": "task.started",
  "sessionId": "optional-agent-session-id",
  "cwd": "/path/to/project",
  "timestamp": "2026-07-02T00:00:00.000Z",
  "summary": "optional short status"
}
```

The service must sanitize before persistence:

| Input | Stored value |
| --- | --- |
| `agent` | allowlisted adapter id |
| `event` | allowlisted event id |
| `sessionId` | short opaque id or hash |
| `cwd` | basename only |
| `timestamp` | ISO timestamp |
| `summary` | short redacted text, max 160 chars |

Rejected or dropped fields:

- prompt text;
- tool input;
- raw stdout/stderr;
- transcript paths;
- full cwd;
- environment variables;
- credentials;
- arbitrary nested payloads.

## 10. State Mapping

V1 canonical states:

| Agent event | Pet event | Optional action | Speech policy |
| --- | --- | --- | --- |
| `task.started` | `agent:working` | `walk` or configured default | important |
| `thinking.started` | `agent:thinking` | idle/focus action | quiet by default |
| `tool.started` | `agent:working` | working action | quiet by default |
| `permission.waiting` | `agent:attention` | attention action | important |
| `task.completed` | `agent:completed` | happy action | important |
| `task.failed` | `agent:error` | alert action | important |
| `service.ready` | `agent:ready` | none | quiet |

The mapper should be data-driven:

```text
event -> canonical state -> bridge calls
```

Do not encode adapter-specific event strings in the bridge client.

## 11. Codex Hook Strategy

The first version should use explicit install and uninstall commands.

### Install Command

`commands/install-codex-hooks.js` should:

- detect whether the expected Codex config directory exists;
- read the existing user config if present;
- add only an OpenPet-managed marked block or file;
- create a backup before mutation;
- never overwrite unrecognized user content;
- output a JSON result explaining installed, already-installed, or blocked.

If the exact Codex hook format is not available or changes, the command must
fail safely and tell the user to run `doctor`.

### Uninstall Command

`commands/uninstall-codex-hooks.js` should:

- remove only OpenPet-owned marked content;
- leave unrelated user config intact;
- report whether anything was removed;
- preserve backup metadata when available.

### Doctor Command

`commands/doctor.js` should report:

- service health URL reachable or not;
- bridge environment available to service or not, when visible from service
  status;
- Codex hook installed or missing;
- port collision;
- data directory writable;
- last accepted event timestamp.

Doctor must not mutate user config.

## 12. Dashboard

The plugin dashboard should be served by the service at:

```text
http://127.0.0.1:8796
```

V1 dashboard content:

- current service status;
- active adapter list;
- recent sanitized session rows;
- last event timestamp;
- last pet bridge call status;
- setup hints for Codex hooks;
- warning that prompts, tool inputs, and transcripts are not stored.

Do not implement a complex SPA. A static HTML/CSS/JS page with a small JSON
endpoint is enough:

```text
GET /api/status
GET /api/sessions
```

## 13. Persistence

Plugin-owned data should live under `OPENPET_DATA_DIR`.

Suggested files:

```text
OPENPET_DATA_DIR/
  sessions.json
  setup.json
```

Retention rules:

- keep only recent sessions within `retentionHours`;
- cap stored sessions at 100;
- cap stored event history per session at 20 events;
- rewrite atomically through a temp file and rename;
- tolerate corrupted JSON by renaming it to a `.corrupt.<timestamp>` file and
  starting fresh.

## 14. Security And Privacy Requirements

The implementation must satisfy these checks:

- service listens only on `127.0.0.1`;
- ingestion endpoint rejects non-JSON requests;
- request body size is bounded;
- adapter ids and event names are allowlisted;
- path fields are reduced to basename before storage;
- summaries are length-limited and redacted for token-looking strings;
- bridge token is never logged;
- dashboard never shows full local paths;
- install/uninstall commands mutate only explicitly marked OpenPet-owned hook
  content;
- plugin service never receives creator bridge routes.

## 15. Implementation Milestones

### Milestone 1: Generic Service Bridge

Goal: enable long-running services to call bounded pet bridge routes.

Expected changes:

- add shared runtime bridge server module;
- keep command bridge compatibility;
- register service bridge runtime on service start;
- inject service bridge env and plugin data/cache/log dirs;
- cleanup bridge runtime on service exit and stop;
- document service bridge contract.

Validation:

- service gets bridge env on start;
- service can call permitted pet route;
- route fails without manifest permission;
- token fails after service stop;
- command bridge tests still pass;
- `npm run test:core`.

### Milestone 2: Bundled Plugin Skeleton

Goal: ship an official plugin package that syncs with the app and runs a
healthy service/dashboard without agent hooks.

Expected changes:

- add `examples/plugins/agent-awareness`;
- add manifest, config schema, README, service, dashboard shell, doctor;
- include plugin in bundled sync list;
- expose health endpoint and dashboard status endpoint;
- persist sanitized service metadata.

Validation:

- bundled sync installs/enables official plugin as expected;
- service starts/stops from Control Center;
- health endpoint returns ok;
- dashboard opens;
- `npm run test:core`.

### Milestone 3: Codex Event Ingestion And Pet Mapping

Goal: accept synthetic Codex events and drive pet state through the service
bridge.

Expected changes:

- implement Codex adapter normalizer;
- implement state mapper;
- implement bridge client;
- add rate limiting and dedupe;
- update dashboard with recent sessions and bridge status.

Validation:

- synthetic `task.started` updates session state;
- synthetic `task.completed` emits expected pet event/speech policy;
- invalid payload is rejected;
- prompts/full paths are not stored;
- service bridge token is not logged;
- `npm run test:core`.

### Milestone 4: Explicit Codex Hook Setup

Goal: let users install, verify, and uninstall Codex hook integration safely.

Expected changes:

- implement install command;
- implement uninstall command;
- expand doctor checks;
- document manual setup and rollback;
- add fixture-based hook mutation tests.

Validation:

- install is idempotent;
- uninstall removes only OpenPet-owned content;
- existing unrelated config survives;
- backup is created before mutation;
- doctor reports actionable status;
- `npm run test:core:all`.

## 16. Test Plan

Add tests close to the relevant modules:

```text
tests/services/plugin-service.test.js
tests/services/plugin-runtime-bridge-server.test.js
tests/plugins/agent-awareness-service.test.js
tests/plugins/agent-awareness-hooks.test.js
```

Minimum assertions:

- service bridge env variables are injected only for service runtime;
- service bridge accepts only valid bearer token;
- service bridge routes enforce plugin permissions;
- service bridge token expires after service stop/exit;
- command bridge behavior remains unchanged;
- bundled sync includes `openpet.agent-awareness`;
- service ingestion rejects unsafe payloads;
- session store redacts and truncates sensitive fields;
- hook installer is idempotent and reversible.

## 17. Rollout Rules

Initial rollout should be conservative:

- bundled official plugin is visible by default;
- service does not auto-start;
- Codex hook is not installed automatically;
- user must explicitly run setup command;
- user can uninstall hook from the plugin command list;
- feature can be removed by disabling/uninstalling the plugin.

If later telemetry-free user feedback shows this is too hidden, consider an
onboarding prompt, but do not add auto-mutation.

## 18. Open Questions

These must be decided before implementation:

1. Should the bundled plugin be enabled by default after sync, matching Creator
   Studio, or installed but disabled until the user enables it?
2. Should the service port stay fixed at `8796` for v1 or be assigned
   dynamically and written to setup metadata for hooks?
3. What is the exact supported Codex hook schema for the current Codex version?
4. Should `permission.waiting` be represented as pet speech only, or also as a
   stronger visual attention state?

## 19. Acceptance Criteria

The feature is acceptable when:

- no agent-specific code exists in OpenPet core;
- service bridge is generic, permission-gated, and cleaned up on stop;
- bundled plugin can start, report health, and open dashboard;
- synthetic Codex events produce sanitized state updates;
- pet updates flow through `PetService` via bridge routes;
- hook install/uninstall is explicit, idempotent, and fixture-tested;
- docs clearly state privacy boundaries and manual setup behavior;
- core tests and plugin-specific tests pass.
