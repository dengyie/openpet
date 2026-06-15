# RSS Reader Example Plugin

This directory is a third-party plugin package for OpenPet. It is meant to be installed through Control Center -> Plugins -> Install plugin package, or inspected by `PluginInstallService` in tests.

## What It Demonstrates

- `network` permission with a narrow HTTPS feed host allowlist.
- `ctx.network.fetch()` for public XML/RSS content without API keys or sensitive headers.
- Lightweight RSS/Atom parsing inside the plugin package without external dependencies.
- Private per-plugin storage for the latest fetched feed and refresh count.
- Pet speech through `ctx.pet.say()` for the newest feed item.

The example uses `feeds.example.com` as a deterministic documentation host. Tests inject a fake `fetchImpl`, so the package does not depend on live network access.

## Manifest

The example asks for three permissions:

- `network` lets the plugin call `ctx.network.fetch()` for allowlisted HTTPS hosts only.
- `pet:say` lets the plugin ask `PetService` to show pet speech.
- `storage` lets the plugin persist its own private JSON values.

The allowlist contains only `feeds.example.com`; requests to other hosts, HTTP URLs, unsupported methods, oversized bodies, or sensitive headers are rejected by the main process service.

## Commands

- `refresh`: fetches RSS/Atom XML, stores normalized feed items, increments `refreshCount`, and optionally announces the newest item.
- `latest`: reads the last stored feed and asks the pet to repeat the newest item.

## Package Shape

```text
rss-reader/
├── plugin.json
├── config.schema.json
├── index.js
└── README.md
```

To distribute it as a local package, zip the contents of this directory so `plugin.json` is at the archive root, then name the archive with `.openpet-plugin.zip`.
