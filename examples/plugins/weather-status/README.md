# Weather Status Example Plugin

This directory is a third-party plugin package for OpenPet. It is meant to be installed through Control Center -> Plugins -> Install plugin package, or inspected by `PluginInstallService` in tests.

## What It Demonstrates

- `network` permission with an explicit HTTPS allowlist.
- `ctx.network.fetch()` without exposing API keys or unrestricted Node access.
- Safe request headers that avoid sensitive values such as authorization or cookies.
- Private per-plugin storage for the latest weather snapshot and refresh count.
- Pet speech through `ctx.pet.say()` after a successful refresh.

The example uses `api.weather.example.com` as a deterministic documentation host. Tests inject a fake `fetchImpl`, so the package does not depend on live network access.

## Manifest

The example asks for three permissions:

- `network` lets the plugin call `ctx.network.fetch()` for allowlisted HTTPS hosts only.
- `pet:say` lets the plugin ask `PetService` to show pet speech.
- `storage` lets the plugin persist its own private JSON values.

The allowlist contains only `api.weather.example.com`; requests to other hosts, HTTP URLs, unsupported methods, oversized bodies, or sensitive headers are rejected by the main process service.

## Commands

- `refresh`: fetches weather JSON, stores a normalized snapshot, increments `refreshCount`, and optionally announces the result.
- `last`: reads the last stored weather snapshot and asks the pet to repeat it.

## Package Shape

```text
weather-status/
├── plugin.json
├── config.schema.json
├── index.js
└── README.md
```

To distribute it as a local package, zip the contents of this directory so `plugin.json` is at the archive root, then name the archive with `.openpet-plugin.zip`.
