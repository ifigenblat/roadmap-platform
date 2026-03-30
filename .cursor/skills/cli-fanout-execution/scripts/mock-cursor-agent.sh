#!/usr/bin/env bash
# mock-cursor-agent.sh — test mock for cursor-agent / agent CLI.
#
# Accepts the same flags as the real CLI and simulates agent behavior:
#   - Parses doneSignal path from the prompt (line matching ^doneSignal:)
#   - Creates the doneSignal file on success
#   - Respects env vars for controlled failure modes:
#       MOCK_FAIL_TASKS   — comma-separated task names to fail (no doneSignal, exit 1)
#       MOCK_DELAY_MS     — sleep duration in milliseconds before completing (default: 500)
#       MOCK_RATE_LIMIT_AFTER — fail with 429 after this many invocations (shared via file counter)
#       MOCK_COUNTER_FILE — path to invocation counter file (required for MOCK_RATE_LIMIT_AFTER)
#
# Usage mirrors real CLI:
#   mock-cursor-agent.sh -p --force --output-format text -- "<prompt>"

set -uo pipefail

# ---------------------------------------------------------------------------
# Parse flags — consume known flags, extract prompt after --
# ---------------------------------------------------------------------------
PROMPT=""
SKIP_NEXT=false

while [ $# -gt 0 ]; do
    if $SKIP_NEXT; then
        SKIP_NEXT=false
        shift
        continue
    fi
    case "$1" in
        --)
            shift
            PROMPT="$*"
            break
            ;;
        --output-format|--model|--resume)
            SKIP_NEXT=true
            shift
            ;;
        -p|--force|--print|--plan|--ask|--cloud|-c)
            shift
            ;;
        *)
            shift
            ;;
    esac
done

# ---------------------------------------------------------------------------
# Extract doneSignal from prompt (line starting with "doneSignal:")
# ---------------------------------------------------------------------------
DONE_SIGNAL=""
while IFS= read -r line; do
    case "$line" in
        doneSignal:*)
            DONE_SIGNAL="${line#doneSignal:}"
            DONE_SIGNAL="${DONE_SIGNAL# }"  # trim leading space
            break
            ;;
    esac
done << PROMPTEOF
$PROMPT
PROMPTEOF

# ---------------------------------------------------------------------------
# Rate limit check
# ---------------------------------------------------------------------------
MOCK_RATE_LIMIT_AFTER="${MOCK_RATE_LIMIT_AFTER:-}"
MOCK_COUNTER_FILE="${MOCK_COUNTER_FILE:-}"

if [ -n "$MOCK_RATE_LIMIT_AFTER" ] && [ -n "$MOCK_COUNTER_FILE" ]; then
    # Atomically increment counter
    current=0
    if [ -f "$MOCK_COUNTER_FILE" ]; then
        current="$(cat "$MOCK_COUNTER_FILE" 2>/dev/null || echo 0)"
    fi
    next=$((current + 1))
    printf '%d' "$next" > "$MOCK_COUNTER_FILE"

    if [ "$next" -gt "$MOCK_RATE_LIMIT_AFTER" ]; then
        echo "429 rate limit exceeded — too many requests" >&2
        exit 2
    fi
fi

# ---------------------------------------------------------------------------
# Delay
# ---------------------------------------------------------------------------
MOCK_DELAY_MS="${MOCK_DELAY_MS:-500}"
delay_sec="$(echo "$MOCK_DELAY_MS" | awk '{printf "%.3f", $1/1000}')"
sleep "$delay_sec"

# ---------------------------------------------------------------------------
# Failure check
# ---------------------------------------------------------------------------
MOCK_FAIL_TASKS="${MOCK_FAIL_TASKS:-}"
TASK_NAME=""
if [ -n "$DONE_SIGNAL" ]; then
    # Derive task name from doneSignal filename (basename without .txt)
    basename_sig="$(basename "$DONE_SIGNAL" .txt)"
    TASK_NAME="$basename_sig"
fi

if [ -n "$MOCK_FAIL_TASKS" ] && [ -n "$TASK_NAME" ]; then
    # Check comma-separated list (permanent failure)
    IFS=',' read -ra FAIL_LIST << FAILEOF
$MOCK_FAIL_TASKS
FAILEOF
    for fail_task in "${FAIL_LIST[@]:-}"; do
        fail_task="${fail_task# }"
        fail_task="${fail_task% }"
        if [ "$fail_task" = "$TASK_NAME" ]; then
            echo "MOCK: task ${TASK_NAME} configured to fail permanently" >&2
            exit 1
        fi
    done
fi

# Fail-once: if marker file exists, consume it and fail (next invocation will succeed)
MOCK_FAIL_ONCE_DIR="${MOCK_FAIL_ONCE_DIR:-}"
if [ -n "$MOCK_FAIL_ONCE_DIR" ] && [ -n "$TASK_NAME" ]; then
    marker="${MOCK_FAIL_ONCE_DIR}/${TASK_NAME}.fail-once"
    if [ -f "$marker" ]; then
        rm -f "$marker"
        echo "MOCK: task ${TASK_NAME} fail-once triggered (will succeed on retry)" >&2
        exit 1
    fi
fi

# ---------------------------------------------------------------------------
# Success — create doneSignal and output fake response
# ---------------------------------------------------------------------------
if [ -n "$DONE_SIGNAL" ]; then
    mkdir -p "$(dirname "$DONE_SIGNAL")"
    touch "$DONE_SIGNAL"
fi

echo "MOCK: task ${TASK_NAME:-unknown} completed successfully"
exit 0
