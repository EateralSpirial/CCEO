#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
RUNTIME_ENV_SH="$CODEX_HOME/skills/cron-loop/scripts/runtime_env.sh"
STRICT_AUDITOR_ROOT="$CODEX_HOME/skills/strict-frontend-auditor"

if [[ ! -r "$RUNTIME_ENV_SH" ]]; then
  echo "runtime env helper missing: $RUNTIME_ENV_SH" >&2
  exit 127
fi
if [[ ! -x "$STRICT_AUDITOR_ROOT/scripts/run_audit.sh" ]]; then
  echo "strict-frontend-auditor runner missing: $STRICT_AUDITOR_ROOT/scripts/run_audit.sh" >&2
  exit 127
fi

# shellcheck source=/dev/null
source "$RUNTIME_ENV_SH" node npm npx

URL="${CCEO_REVIEW_URL:-http://127.0.0.1:3197}"
OUT_DIR=""
PASSTHROUGH=()

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --url)
      URL="$2"
      shift 2
      ;;
    --out)
      OUT_DIR="$2"
      shift 2
      ;;
    *)
      PASSTHROUGH+=("$1")
      shift
      ;;
  esac
done

if [[ -z "$OUT_DIR" ]]; then
  OUT_DIR="$ROOT_DIR/output/frontend-audit/frontend-audit-$(date -u +'%Y%m%d-%H%M%S')"
fi

mkdir -p "$(dirname "$OUT_DIR")"
set +e
"$STRICT_AUDITOR_ROOT/scripts/run_audit.sh" --url "$URL" --full-tribunal --out "$OUT_DIR" "${PASSTHROUGH[@]}"
exit_code=$?
set -e
printf 'report_dir=%s\n' "$OUT_DIR"
exit "$exit_code"
