# AI Provider Smoke Evidence

Generated: 2026-06-28T11:08:10.554Z

This evidence records a sanitized OpenAI-compatible provider smoke run against the OpenPet development gateway.

## Scope

- Base URL: `http://127.0.0.1:8317/v1`
- Chat model: `gpt-5.5`
- Image model name checked through `/models`: `gpt-image-2`
- Image generation execution: skipped
- Raw API key: not recorded

## Result

| Check | Status | Evidence |
| --- | --- | --- |
| `/models` | pass | Gateway returned 45 discovered models; `gpt-5.5` and `gpt-image-2` were both present. |
| `/chat/completions` | pass | `gpt-5.5` returned text for the smoke prompt. |
| `/images/generations` | skipped | Image generation remains opt-in because it can spend provider credits. |

## Claim Boundary

This evidence confirms that the user's current OpenPet gateway exposed the selected chat and image model names and that the chat model completed a smoke request.

It does not prove image generation output quality, transparent-background quality, production asset readiness, or compatibility for other provider presets. Those still require opt-in image smoke runs and human review.

## Reproduction Command

```bash
npm run smoke:ai-provider -- --base-url http://127.0.0.1:8317/v1 --api-key-env OPENPET_AI_PROVIDER_API_KEY --chat-model gpt-5.5 --image-model gpt-image-2 --output <report.json>
```
