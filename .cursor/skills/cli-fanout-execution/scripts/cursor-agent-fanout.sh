#!/usr/bin/env bash
# cursor-agent-fanout.sh — fan out leaf agent tasks via the Cursor CLI.
#
# Usage:
#   cursor-agent-fanout.sh <scopeDir> <outputDir> <maxParallel> <packageRoot>
#
# Arguments:
#   scopeDir     coordinator scope directory (e.g. {outputDir}/.working/orchestration/)
#   outputDir    review output root (for task-spec path resolution)
#   maxParallel  maximum concurrent CLI sessions (default: 8)
#   packageRoot  root of the code-review package (for agent definition lookup)
#
# Exits:
#   0  all tasks completed (or queued tasks exhausted)
#   1  deadlock (queue non-empty, no running tasks, no progress)
#
# Environment (all optional):
#   FANOUT_POLL_INTERVAL  seconds between control loop polls (default: 5)
#   MOCK_DELAY_MS         passed through to the CLI process (for testing)

set -uo pipefail

# ---------------------------------------------------------------------------
# Arguments
# ---------------------------------------------------------------------------
SCOPE_DIR="${1:-}"
OUTPUT_DIR="${2:-}"
MAX_PARALLEL="${3:-12}"
PACKAGE_ROOT="${4:-}"

if [ -z "$SCOPE_DIR" ] || [ -z "$OUTPUT_DIR" ] || [ -z "$PACKAGE_ROOT" ]; then
    echo "[ERROR] Usage: cursor-agent-fanout.sh <scopeDir> <outputDir> <maxParallel> <packageRoot>" >&2
    exit 1
fi

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
MAX_RETRIES=3
BACKOFF_INITIAL="${FANOUT_BACKOFF_INITIAL:-5}"
BACKOFF_RATE_LIMIT="${FANOUT_BACKOFF_RATE_LIMIT:-60}"
SPAWN_STAGGER=0.5
POLL_INTERVAL="${FANOUT_POLL_INTERVAL:-5}"

SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"
TIMING_LOG="${OUTPUT_DIR}/.working/orchestration/timing.log"
CLI_CMD_FILE="${SCOPE_DIR}/cli-cmd.txt"
QUEUE_FILE="${SCOPE_DIR}/queue.txt"
DONE_FILE="${SCOPE_DIR}/done.txt"

# Temp directory for tracking running processes (one file per running task)
# File name: {pid}
# File content: task_name:agent_type:retry_count
RUN_TRACK_DIR="${SCOPE_DIR}/.fanout-running"
STDERR_DIR="${SCOPE_DIR}/.fanout-stderr"
mkdir -p "$RUN_TRACK_DIR" "$STDERR_DIR"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
log() {
    local ts
    ts="$(date '+%H:%M:%S')"
    echo "[${ts}] $*"
    printf '[%s] %s\n' "$ts" "$*" >> "$TIMING_LOG" 2>/dev/null || true
}

log_err() {
    log "[ERROR] $*" >&2
}

running_count() {
    local count=0
    local f
    for f in "${RUN_TRACK_DIR}"/*; do
        [ -f "$f" ] && count=$((count + 1))
    done
    echo "$count"
}

resolve_task_spec() {
    local task_name="$1"
    local spec_path=""

    case "$task_name" in
        domain-*-*|domain-*-synth)
            local domain_part="${task_name#domain-}"
            local domain_name="${domain_part%-*}"
            spec_path="${OUTPUT_DIR}/.working/domain-${domain_name}/task-specs/${task_name}.md"
            ;;
        verify-*)
            spec_path="${OUTPUT_DIR}/.working/verification/task-specs/${task_name}.md"
            ;;
        req-*)
            spec_path="${OUTPUT_DIR}/.working/requirements/task-specs/${task_name}.md"
            ;;
        *)
            log_err "Cannot determine task-spec path for task: ${task_name}"
            return 1
            ;;
    esac

    if [ ! -f "$spec_path" ]; then
        log_err "Task-spec file not found: ${spec_path}"
        return 1
    fi
    printf '%s' "$spec_path"
}

find_agent_def() {
    local agent_type="$1"
    # Probe subdirectory convention, then flat file convention
    if [ -f "${PACKAGE_ROOT}/agents/${agent_type}/AGENT.md" ]; then
        printf '%s' "${PACKAGE_ROOT}/agents/${agent_type}/AGENT.md"
    elif [ -f "${PACKAGE_ROOT}/agents/${agent_type}.md" ]; then
        printf '%s' "${PACKAGE_ROOT}/agents/${agent_type}.md"
    fi
}

assemble_prompt() {
    local agent_type="$1"
    local task_spec_path="$2"

    local agent_def
    agent_def="$(find_agent_def "$agent_type")"
    local task_spec_content
    task_spec_content="$(cat "$task_spec_path")"

    if [ -n "$agent_def" ]; then
        printf '%s\n\n---\n\n%s' "$(cat "$agent_def")" "$task_spec_content"
    else
        log "[WARN] No agent definition found for ${agent_type} — proceeding without agent identity"
        printf '%s' "$task_spec_content"
    fi
}

spawn_task() {
    local task_name="$1"
    local agent_type="$2"
    local retry_count="${3:-0}"

    local task_spec_path
    if ! task_spec_path="$(resolve_task_spec "$task_name")"; then
        log_err "Cannot spawn ${task_name}: task-spec not found"
        return 1
    fi

    local task_prompt
    if ! task_prompt="$(assemble_prompt "$agent_type" "$task_spec_path")"; then
        log_err "Cannot assemble prompt for ${task_name}"
        return 1
    fi

    local stderr_file="${STDERR_DIR}/${task_name}.stderr"

    "$CLI_CMD" -p --force --output-format text -- "$task_prompt" > /dev/null 2> "$stderr_file" &
    local pid=$!

    # Track this running task
    printf '%s:%s:%d' "$task_name" "$agent_type" "$retry_count" > "${RUN_TRACK_DIR}/${pid}"

    log "SPAWNED: ${task_name} (${agent_type}) pid=${pid} retry=${retry_count}"
    sleep "$SPAWN_STAGGER"
    return 0
}

mark_done() {
    local task_name="$1"
    printf '%s\n' "$task_name" >> "$DONE_FILE"
}

# ---------------------------------------------------------------------------
# Read CLI command
# ---------------------------------------------------------------------------
if [ ! -f "$CLI_CMD_FILE" ]; then
    log_err "cli-cmd.txt not found at ${CLI_CMD_FILE}. Run check-cli.sh first."
    exit 1
fi
CLI_CMD="$(cat "$CLI_CMD_FILE")"
if [ -z "$CLI_CMD" ]; then
    log_err "cli-cmd.txt is empty"
    exit 1
fi

log "Starting CLI fan-out: cmd=${CLI_CMD} maxParallel=${MAX_PARALLEL} scopeDir=${SCOPE_DIR}"

# ---------------------------------------------------------------------------
# Queue emptiness helper (handles blank-line-only files from pop.sh)
# ---------------------------------------------------------------------------
queue_has_entries() {
    [ -f "$QUEUE_FILE" ] && grep -q '[^[:space:]]' "$QUEUE_FILE" 2>/dev/null
}

# ---------------------------------------------------------------------------
# Check queue
# ---------------------------------------------------------------------------
if [ ! -f "$QUEUE_FILE" ]; then
    log "queue.txt not found — nothing to do"
    exit 0
fi
if ! queue_has_entries; then
    log "queue.txt is empty — nothing to do"
    exit 0
fi

# ---------------------------------------------------------------------------
# Initial fill
# ---------------------------------------------------------------------------
READY="$("$SCRIPTS_DIR/pop.sh" "$MAX_PARALLEL" "$SCOPE_DIR")"
while IFS= read -r line; do
    case "$line" in
        "SPAWN_NEXT: "*)
            t_name="$(echo "$line" | awk '{print $2}')"
            t_agent="$(echo "$line" | awk '{print $3}')"
            spawn_task "$t_name" "$t_agent" 0 || true
            ;;
    esac
done <<POPEOF
$READY
POPEOF

# ---------------------------------------------------------------------------
# Control loop
# ---------------------------------------------------------------------------
DEADLOCK_CONSECUTIVE=0
CONSECUTIVE_SPAWN_FAILURES=0

while true; do
    rc="$(running_count)"
    q_empty=true
    queue_has_entries && q_empty=false

    # Check completion
    if [ "$rc" -eq 0 ] && $q_empty; then
        log "All tasks completed"
        exit 0
    fi

    freed=0

    # Check each tracked process
    if [ -d "$RUN_TRACK_DIR" ]; then
        for track_file in "${RUN_TRACK_DIR}"/*; do
            [ -f "$track_file" ] || continue
            pid="$(basename "$track_file")"
            task_info="$(cat "$track_file")"
            t_name="$(echo "$task_info" | cut -d: -f1)"
            t_agent="$(echo "$task_info" | cut -d: -f2)"
            t_retry="$(echo "$task_info" | cut -d: -f3)"
            done_signal="${SCOPE_DIR}/${t_name}.txt"
            stderr_file="${STDERR_DIR}/${t_name}.stderr"

            if [ -f "$done_signal" ]; then
                # Completed via doneSignal
                log "DONE: ${t_name}"
                mark_done "$t_name"
                rm -f "$track_file" "$stderr_file"
                freed=$((freed + 1))
                DEADLOCK_CONSECUTIVE=0
                CONSECUTIVE_SPAWN_FAILURES=0

            elif ! kill -0 "$pid" 2>/dev/null; then
                # Process exited without doneSignal
                local_stderr=""
                [ -f "$stderr_file" ] && local_stderr="$(cat "$stderr_file" 2>/dev/null || true)"

                backoff=$BACKOFF_INITIAL
                if echo "$local_stderr" | grep -qi "429\|rate limit"; then
                    backoff=$BACKOFF_RATE_LIMIT
                    log "[RATE-LIMIT] ${t_name} — backing off ${backoff}s"
                fi

                rm -f "$track_file"

                if [ "$t_retry" -lt "$MAX_RETRIES" ]; then
                    log "[RETRY] ${t_name} attempt $((t_retry + 1))/${MAX_RETRIES} — waiting ${backoff}s"
                    sleep "$backoff"
                    rm -f "$stderr_file"
                    spawn_task "$t_name" "$t_agent" $((t_retry + 1)) || true
                else
                    log_err "EXHAUSTED: ${t_name} — ${MAX_RETRIES} retries failed, marking done"
                    rm -f "$stderr_file"
                    mark_done "$t_name"
                    freed=$((freed + 1))
                    DEADLOCK_CONSECUTIVE=0
                    CONSECUTIVE_SPAWN_FAILURES=$((CONSECUTIVE_SPAWN_FAILURES + 1))
                    if [ "$CONSECUTIVE_SPAWN_FAILURES" -ge 3 ]; then
                        OLD_MAX="$MAX_PARALLEL"
                        MAX_PARALLEL=$(( MAX_PARALLEL / 2 ))
                        [ "$MAX_PARALLEL" -lt 1 ] && MAX_PARALLEL=1
                        log "[CONCURRENCY-REDUCED] MAX_PARALLEL reduced from ${OLD_MAX} to ${MAX_PARALLEL} due to consecutive spawn failures"
                        CONSECUTIVE_SPAWN_FAILURES=0
                    fi
                fi
            fi
            # Still running: leave track_file in place
        done
    fi

    # Fill freed slots
    if [ "$freed" -gt 0 ] && queue_has_entries; then
        READY="$("$SCRIPTS_DIR/pop.sh" "$freed" "$SCOPE_DIR")"
        while IFS= read -r line; do
            case "$line" in
                "SPAWN_NEXT: "*)
                    t_name="$(echo "$line" | awk '{print $2}')"
                    t_agent="$(echo "$line" | awk '{print $3}')"
                    spawn_task "$t_name" "$t_agent" 0 || true
                    ;;
            esac
        done <<POPEOF
$READY
POPEOF
    fi

    # Deadlock detection: running=0, queue non-empty, nothing freed
    rc="$(running_count)"
    q_empty=true
    queue_has_entries && q_empty=false

    if [ "$rc" -eq 0 ] && ! $q_empty; then
        DEADLOCK_CONSECUTIVE=$((DEADLOCK_CONSECUTIVE + 1))
        if [ "$DEADLOCK_CONSECUTIVE" -ge 3 ]; then
            log_err "DEADLOCK: queue non-empty, no running tasks, no progress after ${DEADLOCK_CONSECUTIVE} polls"
            cat "$QUEUE_FILE" >&2 || true
            exit 1
        fi
    fi

    sleep "$POLL_INTERVAL"
done
