#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
RUNTIME_ENV_SH="$CODEX_HOME/skills/cron-loop/scripts/runtime_env.sh"

if [[ ! -r "$RUNTIME_ENV_SH" ]]; then
  echo "runtime env helper missing: $RUNTIME_ENV_SH" >&2
  exit 127
fi

# shellcheck source=/dev/null
source "$RUNTIME_ENV_SH" node curl

COMMAND="${1:-}"
shift || true
PORT="${CCEO_REVIEW_PORT:-3197}"

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --port)
      PORT="$2"
      shift 2
      ;;
    *)
      echo "unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

URL="http://127.0.0.1:${PORT}"
RUNTIME_DIR="$ROOT_DIR/output/runtime"
PID_FILE="$RUNTIME_DIR/review-server.${PORT}.pid"
LOG_FILE="$RUNTIME_DIR/review-server.${PORT}.log"

mkdir -p "$RUNTIME_DIR"

server_pid() {
  if [[ ! -f "$PID_FILE" ]]; then
    return 1
  fi
  local pid
  pid="$(cat "$PID_FILE")"
  if [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1; then
    printf '%s\n' "$pid"
    return 0
  fi
  return 1
}

wait_for_health() {
  local attempt
  for attempt in $(seq 1 30); do
    if curl -fsS "$URL/api/health" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

case "$COMMAND" in
  start)
    if pid="$(server_pid)"; then
      printf 'status=already-running\npid=%s\nurl=%s\nlog=%s\n' "$pid" "$URL" "$LOG_FILE"
      exit 0
    fi
    (
      cd "$ROOT_DIR"
      setsid env CCEO_REVIEW_MODE=1 PORT="$PORT" node dist/server/server/index.js </dev/null >>"$LOG_FILE" 2>&1 &
      echo $! > "$PID_FILE"
    )
    if ! wait_for_health; then
      if pid="$(server_pid)"; then
        kill "$pid" >/dev/null 2>&1 || true
      fi
      rm -f "$PID_FILE"
      echo "status=failed" >&2
      echo "url=$URL" >&2
      echo "log=$LOG_FILE" >&2
      exit 1
    fi
    pid="$(server_pid)"
    printf 'status=started\npid=%s\nurl=%s\nlog=%s\n' "$pid" "$URL" "$LOG_FILE"
    ;;
  stop)
    if pid="$(server_pid)"; then
      kill "$pid" >/dev/null 2>&1 || true
      rm -f "$PID_FILE"
      printf 'status=stopped\npid=%s\n' "$pid"
    else
      printf 'status=not-running\n'
    fi
    ;;
  status)
    if pid="$(server_pid)"; then
      printf 'status=running\npid=%s\nurl=%s\nlog=%s\n' "$pid" "$URL" "$LOG_FILE"
    else
      printf 'status=not-running\nurl=%s\nlog=%s\n' "$URL" "$LOG_FILE"
      exit 1
    fi
    ;;
  *)
    echo "usage: $0 <start|stop|status> [--port PORT]" >&2
    exit 2
    ;;
esac
