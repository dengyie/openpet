# Creator Studio Generation Timeout Design

Date: 2026-06-20
Status: Proposed
Scope: Provider timeout and failure convergence for Creator Studio image generation

## 1. Goal

Creator Studio image generation must never leave a run permanently stuck in
`generating` when a cloud or local image provider stops responding.

The immediate production problem was found during a real Creator Studio smoke
run:

- cloud model health check returned quickly with `provider_healthy`;
- Creator Studio created a cloud run and entered `generate`;
- the run remained in `generating`;
- no image output, provider failure, or request timeout was recorded;
- manual interruption was required to stop the smoke process.

This design adds a bounded timeout and clear failure convergence for image
generation provider calls. A run should either complete successfully or move to
`failed` with actionable diagnostics.

## 2. Current Context

The relevant path is:

```text
Creator Studio create-run
  -> run-step
  -> backend-runner
  -> host-model-bridge
  -> plugin bridge /creator/model-image-generate
  -> image-generation-model-service.generateImage
  -> cloud/local provider fetch
  -> output image metadata
  -> backend-runner writes ready_for_review or failed run state
```

Current ownership boundaries are healthy:

- Creator Studio owns run state, prompt construction, and generated artifact
  packaging.
- OpenPet host owns model settings, secrets, provider calls, output writing,
  and provider diagnostics.
- `backend-runner` already catches generation errors and stores failed run state.

The missing behavior is inside the provider call boundary. `fetch` has no
request-level timeout, so a slow or stuck provider can keep the entire
`run-step` command pending indefinitely.

## 3. Non-Goals

This phase does not:

- build a durable background job queue;
- add retry policy;
- add cancellation UI;
- add model settings UI;
- change API key ownership;
- move provider calls into the plugin;
- change prompt builder behavior;
- guarantee provider-side cancellation after the HTTP request is aborted;
- solve visual quality or sprite-sheet generation.

Those are separate milestones.

## 4. Recommended Approach

Use service-layer timeout enforcement in
`src/main/services/image-generation-model-service.js`.

This is preferred over adding only a Creator Studio runner timeout because the
provider call is the source of the hang. Service-level enforcement gives every
caller the same safety behavior, including Control Center checks, plugin bridge
calls, and future host-side generation entrypoints.

The existing `backend-runner` should continue to be responsible for converting
thrown generation errors into persisted Creator Studio run state:

```text
provider timeout
  -> image-generation-model-service throws clear timeout error
  -> host bridge returns error
  -> backend-runner catch block writes status=failed
  -> run log records generate.failed
```

## 5. Timeout Policy

### Cloud

Cloud image generation should use a default timeout of `120000ms`.

The first implementation may define this as a service constant. A future
Control Center phase can expose cloud timeout configuration if real usage shows
the default needs tuning.

### Local

Local image generation should use the existing
`config.local.timeoutMs` setting. This keeps local provider behavior aligned
with current model settings and avoids adding another configuration field.

### Health Checks

Health checks are shorter and operationally different from image generation.
They may receive a separate timeout later, but this milestone focuses on
generation calls because that is where the smoke run got stuck.

## 6. Service Design

Add a small timeout wrapper around provider `fetch` calls.

Expected helper shape:

```js
const fetchWithTimeout = async ({
  fetchImpl,
  url,
  options,
  timeoutMs,
  timeoutMessage
}) => {
  // uses AbortController
}
```

Behavior:

- create an `AbortController`;
- attach `signal` to the request options;
- start a timer for `timeoutMs`;
- abort the request when the timer fires;
- clear the timer in `finally`;
- throw `timeoutMessage` for abort-triggered timeout errors;
- preserve non-timeout provider/network errors.

The helper should not log prompt text, API keys, or absolute output paths.

## 7. Logging Design

Existing logging events should remain the main observability contract:

- `imageGeneration.request.started`
- `imageGeneration.provider.request.started`
- `imageGeneration.provider.request.completed`
- `imageGeneration.provider.request.failed`
- `imageGeneration.request.completed`
- `imageGeneration.request.failed`

Timeouts should be recorded as provider failures and request failures.

Recommended provider failure details:

```js
{
  requestId,
  backend: 'cloud' | 'local',
  provider,
  model,
  baseUrlHost,
  durationMs,
  timeoutMs,
  errorCode: 'provider_timeout' | 'endpoint_timeout',
  errorMessage
}
```

Security constraints:

- do not log API keys;
- do not log prompt text;
- do not log full provider URL paths when the host name is enough;
- do not log absolute output paths;
- keep local endpoint logging to host only, consistent with existing behavior.

## 8. Error And State Convergence

The service should throw clear timeout errors:

```text
Cloud image generation timed out after 120000ms
Local image generation timed out after 120000ms
```

`backend-runner` should not need large changes. Its current catch path should
store:

- `status: "failed"`;
- `currentStep: "generate"`;
- `backendStatus.state: "failed"`;
- `backendStatus.message`: the timeout message;
- `error`: the timeout message;
- run event `generate.failed`.

This preserves the existing run-state ownership model.

## 9. Prompt Builder Interaction

No prompt builder behavior changes are required.

The timeout feature must continue to work with the structured OpenPet prompt
built by `openpet-prompt-builder.js`. The final prompt may be long, but timeout
behavior must depend only on request duration, not prompt content.

The smoke test should verify that prompt builder metadata remains present on
successful generation. Timeout tests should verify that failed runs do not
persist full prompt text into logs.

## 10. Testing Plan

### Unit Tests

Add focused tests in `tests/services/image-generation-model-service.test.js`:

- cloud generation aborts when provider fetch exceeds the cloud timeout;
- local generation aborts when provider fetch exceeds `local.timeoutMs`;
- timeout logs include request id, backend, model, duration, timeout, and error
  code;
- timeout logs do not include API key, prompt text, or data directory;
- existing success tests continue to pass.

Use fake `fetchImpl` functions that observe `options.signal` and reject or
remain pending until aborted.

### Creator Studio Integration Test

Add or extend a test in `tests/examples/creator-studio-plugin.test.js`:

- create a cloud or local run;
- use a bridge endpoint whose image generation never resolves until aborted;
- run `run-step`;
- assert command exits with failure;
- assert persisted run status is `failed`;
- assert `backendStatus.message` contains the timeout text;
- assert run logs contain `generate.failed`.

This verifies the full convergence from provider timeout to Creator Studio run
state.

### Smoke Test

Manual smoke command:

```text
Creator Studio create-run
  -> run-step with cloud backend
  -> if provider responds: ready_for_review with generated image
  -> if provider hangs: failed after timeout with readable diagnostics
```

The smoke should never require manual interruption.

## 11. Acceptance Criteria

The milestone is complete when:

- cloud image generation has a bounded timeout;
- local image generation has a bounded timeout using `local.timeoutMs`;
- timed-out provider calls produce structured failure logs;
- Creator Studio run state converges to `failed` instead of staying
  `generating`;
- tests cover cloud timeout, local timeout, and Creator Studio run failure
  convergence;
- logs and errors do not expose API keys or prompt text;
- existing image generation success behavior still passes.

## 12. Backlog

Future phases may add:

- Control Center cloud timeout configuration;
- user-visible retry button;
- explicit cancel button for active Creator Studio runs;
- bounded retry with backoff for transient provider failures;
- durable job records for long-running generation;
- provider-specific timeout recommendations;
- progress events when providers support them.

These are intentionally outside this milestone.

## 13. Implementation Notes

Keep the first implementation small:

- prefer one fetch timeout helper over duplicating timer code;
- avoid changing public plugin contracts;
- avoid introducing a queue or job system;
- keep logging fields scalar so `app-log-service` preserves them;
- ensure tests do not rely on wall-clock waits longer than a few milliseconds.

The feature is a reliability closure, not a platform rewrite.
