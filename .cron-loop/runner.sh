#!/usr/bin/env bash
set -euo pipefail

export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
ROOT_DIR="/home/sal/OneDrive/CCEO"
CRON_DIR="$ROOT_DIR/.cron-loop"
PROMPT_FILE="$CRON_DIR/prompt.md"
NODE_BIN="/home/sal/.nvm/versions/node/v24.13.0/bin/node"
MANAGER="/home/sal/.codex/skills/cron-loop/scripts/manage_cron.mjs"
RUNTIME_ENV="/home/sal/.codex/skills/cron-loop/scripts/runtime_env.sh"
CAPTURE_EXEC="/home/sal/.codex/skills/cron-loop/scripts/capture_exec.mjs"
CODEX_MODEL="${CODEX_MODEL:-}"
CODEX_REASONING_EFFORT="${CODEX_REASONING_EFFORT:-}"
RUN_TS="$(date -u +'%Y%m%d_%H%M%S')"
RUN_LOG="$CRON_DIR/run.$RUN_TS.log"
MESSAGE_FILE="$CRON_DIR/message.$RUN_TS.md"
PROMPT_SNAPSHOT="$CRON_DIR/prompt.$RUN_TS.md"
run_exit_code=0
round_finished=0

finish_round() {
  local shell_exit="$?"
  if [[ "$round_finished" == "1" ]]; then
    return 0
  fi
  if (( run_exit_code == 0 && shell_exit != 0 )); then
    run_exit_code="$shell_exit"
  fi
  "$NODE_BIN" "$MANAGER" round-finish \
    --project-root "$ROOT_DIR" \
    --exit-code "$run_exit_code" \
    --run-log "$RUN_LOG" \
    --message-file "$MESSAGE_FILE" \
    --prompt-snapshot "$PROMPT_SNAPSHOT" >/dev/null 2>&1 || true
  round_finished=1
}

trap finish_round EXIT

mkdir -p "$CRON_DIR"
touch "$CRON_DIR/cron.log"
cd "$ROOT_DIR"

if [[ ! -f "$PROMPT_FILE" ]]; then
  printf 'prompt_missing=%s\n' "$PROMPT_FILE" >"$RUN_LOG"
  run_exit_code=66
  exit 0
fi

cp "$PROMPT_FILE" "$PROMPT_SNAPSHOT"
"$NODE_BIN" "$MANAGER" round-start --project-root "$ROOT_DIR" >/dev/null 2>&1 || true

if [[ ! -f "$RUNTIME_ENV" ]]; then
  printf 'runtime_env_missing=%s\n' "$RUNTIME_ENV" >"$RUN_LOG"
  run_exit_code=67
  exit 0
fi

uid="$(id -u)"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$uid}"
export DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-unix:path=$XDG_RUNTIME_DIR/bus}"

source "$RUNTIME_ENV" codex node npm npx

if [[ ! -f "$CAPTURE_EXEC" ]]; then
  printf 'capture_exec_missing=%s\n' "$CAPTURE_EXEC" >"$RUN_LOG"
  run_exit_code=68
  exit 0
fi

readarray -t RUN_LIMITS < <("$NODE_BIN" "$MANAGER" run-config --project-root "$ROOT_DIR")

TIMEOUT_SECONDS="${RUN_LIMITS[0]}"
RUN_LOG_HEAD_BYTES="${RUN_LIMITS[1]}"
RUN_LOG_TAIL_BYTES="${RUN_LIMITS[2]}"

CODEX_ARGS=(exec --skip-git-repo-check --output-last-message "$MESSAGE_FILE")
if [[ -n "$CODEX_MODEL" ]]; then
  CODEX_ARGS+=(--model "$CODEX_MODEL")
fi
if [[ -n "$CODEX_REASONING_EFFORT" ]]; then
  CODEX_ARGS+=(-c "model_reasoning_effort=\"$CODEX_REASONING_EFFORT\"")
fi
CODEX_ARGS+=(-)

/usr/bin/timeout "$TIMEOUT_SECONDS" "$NODE_BIN" "$CAPTURE_EXEC" \
  --cwd "$ROOT_DIR" \
  --stdin-file "$PROMPT_FILE" \
  --log-path "$RUN_LOG" \
  --head-bytes "$RUN_LOG_HEAD_BYTES" \
  --tail-bytes "$RUN_LOG_TAIL_BYTES" \
  -- \
  codex "${CODEX_ARGS[@]}" || run_exit_code=$?
exit 0
