# Codex Executive Officer

OpenClaw-style management console for local Codex environments.

Short name: `CCEO`

## What it does

- Unified web UI with a "chief executive" chat surface
- Persona registry for Codex roles, prompts, skills, MCP references, and channel identity
- Session and memory index over `~/.codex/sessions` and archived sessions
- Qdrant knowledge-base registry against local `http://127.0.0.1:6333`
- Project registry for manager role, participant roles, knowledge-base access, and project metadata
- `cron-loop`-compatible job scanner and action bridge using the canonical `manage_cron.py`
- Slack / Telegram channel registry with editable status, identity, and notes

## Scripts

```bash
npm install
npm run dev
```

This starts:

- Vite on `http://127.0.0.1:5173`
- API server on `http://127.0.0.1:3187`

Production build:

```bash
npm run build
npm start
```

The production server serves the built client from `dist/client`.

## Data layout

Runtime data lives under `.codex-manager/`:

- `registry/` for personas, projects, knowledge bases, channels, manager threads, and session links
- `generated/personas/<id>/instructions.md` for role materialization

## Notes

- The manager chat uses real `codex exec` / `codex exec resume` runs.
- Persona `systemPrompt` and `developerInstructions` are materialized into actual Codex runtime overrides; `replaceBuiltInInstructions` switches to a generated `model_instructions_file`.
- Session indexing reads only the head of `.jsonl` transcript files to avoid loading large histories into memory.
- `cron-loop` actions call the skill-provided `manage_cron.py` instead of inventing a new task format.
