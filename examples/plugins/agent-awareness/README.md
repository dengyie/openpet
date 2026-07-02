# Agent Awareness

Agent Awareness is an official bundled OpenPet extension that lets a local AI
coding agent report sanitized activity into OpenPet.

The extension is intentionally service-based. OpenPet core only starts/stops the
service and provides a small service bridge for pet speech/events. Codex-specific
hook guidance, event normalization, session storage, and dashboard state live in
this extension.

## Privacy Boundary

The service accepts only a small event shape:

```json
{
  "adapter": "codex",
  "sessionId": "local-session-id",
  "type": "turn.completed",
  "status": "completed",
  "message": "Tests passed",
  "cwd": "/path/to/project"
}
```

Stored and displayed data is sanitized. The extension does not store raw prompts,
tool input, terminal transcripts, stdout, stderr, API keys, or full local paths.

## Manual Codex Setup

Run the `Prepare Codex Hook Instructions` command from Control Center. It writes
manual setup notes into `OPENPET_DATA_DIR/codex-hooks.manual.md` and creates an
ingestion token at `OPENPET_DATA_DIR/ingest-token.txt`. The command does not
modify `~/.codex` or any external agent config.

Start the `Agent Awareness Service` entry before sending hook events. The service
listens on `http://127.0.0.1:8795` and exposes:

- `GET /health`
- `GET /api/sessions`
- `POST /api/events` with `Authorization: Bearer <ingest token>`
- dashboard at `/`
