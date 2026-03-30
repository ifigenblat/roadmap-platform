#!/usr/bin/env bash
# test-fanout.sh — integration test harness for check-cli.sh and cursor-agent-fanout.sh.
#
# Run from: packages/code-review/skills/cli-fanout-execution/scripts/
#
# Prints PASS/FAIL per scenario. Exits 0 if all pass, 1 if any fail.
# All temp files are created under TMP_DIR and removed on exit.

set -uo pipefail

SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT INT TERM

PASS_COUNT=0
FAIL_COUNT=0

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
pass() { echo "PASS: $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
fail() { echo "FAIL: $1 — $2"; FAIL_COUNT=$((FAIL_COUNT + 1)); }

# Run a command, capturing stdout and exit code safely (set -e compatible)
run_capture() {
    # Usage: run_capture <var_stdout> <var_exit> cmd [args...]
    local _var_out="$1"
    local _var_exit="$2"
    shift 2
    local _out _ec
    set +e
    _out="$("$@" 2>/dev/null)"
    _ec=$?
    set -e
    eval "${_var_out}='${_out}'"
    eval "${_var_exit}=${_ec}"
}

# Run fanout script with mock cursor-agent prepended to PATH.
# Env vars in the caller's environment are inherited by the subprocess.
run_fanout() {
    local scope_dir="$1"
    local output_dir="$2"
    local max_parallel="${3:-4}"
    local pkg_root="$4"
    local mock_bin_dir="$5"
    env PATH="${mock_bin_dir}:${PATH}" \
        bash "$SCRIPTS_DIR/cursor-agent-fanout.sh" \
        "$scope_dir" "$output_dir" "$max_parallel" "$pkg_root"
}

# Same but captures exit code without triggering set -e
run_fanout_capture() {
    local _var_exit="$1"
    shift
    local _ec
    set +e
    # Use 1s poll interval for test speed
    FANOUT_POLL_INTERVAL=1 run_fanout "$@" > /dev/null 2>&1
    _ec=$?
    set -e
    eval "${_var_exit}=${_ec}"
}

# ---------------------------------------------------------------------------
# Setup helpers
# ---------------------------------------------------------------------------
make_package_root() {
    local pkg_root="$1"
    mkdir -p "${pkg_root}/agents/logic-correctness-reviewer"
    cat > "${pkg_root}/agents/logic-correctness-reviewer/AGENT.md" << 'AGENTEOF'
---
name: logic-correctness-reviewer
---
You are a logic correctness reviewer.
AGENTEOF

    mkdir -p "${pkg_root}/agents/finding-verifier"
    cat > "${pkg_root}/agents/finding-verifier/AGENT.md" << 'AGENTEOF'
---
name: finding-verifier
---
You are a finding verifier.
AGENTEOF

    cat > "${pkg_root}/agents/requirements-verifier.md" << 'AGENTEOF'
---
name: requirements-verifier
---
You are a requirements verifier.
AGENTEOF
}

make_task_spec() {
    local spec_path="$1"
    local task_name="$2"
    local scope_dir="$3"
    mkdir -p "$(dirname "$spec_path")"
    cat > "$spec_path" << SPECEOF
doneSignal: ${scope_dir}/${task_name}.txt
outputPath: ${scope_dir}/${task_name}.md
domain: logic
Review the code.
SPECEOF
}

make_queue() {
    local scope_dir="$1"
    shift
    printf '' > "${scope_dir}/queue.txt"
    for entry; do
        echo "$entry" >> "${scope_dir}/queue.txt"
    done
}

make_mock_bin() {
    local mock_bin="$1"
    mkdir -p "$mock_bin"
    ln -sf "$SCRIPTS_DIR/mock-cursor-agent.sh" "${mock_bin}/cursor-agent"
    chmod +x "${mock_bin}/cursor-agent"
}

# ---------------------------------------------------------------------------
# SCENARIO 1: All 4 tasks complete successfully
# ---------------------------------------------------------------------------
scenario_01() {
    local dir="${TMP_DIR}/s01"
    local output_dir="${dir}/output"
    local scope_dir="${output_dir}/.working/orchestration"
    local pkg_root="${dir}/pkg"

    mkdir -p "$scope_dir"
    touch "${scope_dir}/done.txt"
    printf 'cursor-agent' > "${scope_dir}/cli-cmd.txt"
    make_package_root "$pkg_root"

    make_task_spec "${output_dir}/.working/domain-logic/task-specs/domain-logic-01.md" "domain-logic-01" "$scope_dir"
    make_task_spec "${output_dir}/.working/domain-logic/task-specs/domain-logic-02.md" "domain-logic-02" "$scope_dir"
    make_task_spec "${output_dir}/.working/verification/task-specs/verify-01.md" "verify-01" "$scope_dir"
    make_task_spec "${output_dir}/.working/verification/task-specs/verify-02.md" "verify-02" "$scope_dir"

    make_queue "$scope_dir" \
        "domain-logic-01::logic-correctness-reviewer:domain-logic-01.txt" \
        "domain-logic-02::logic-correctness-reviewer:domain-logic-02.txt" \
        "verify-01::finding-verifier:verify-01.txt" \
        "verify-02::finding-verifier:verify-02.txt"

    local mock_bin="${dir}/mock-bin"
    make_mock_bin "$mock_bin"

    local ec
    MOCK_DELAY_MS=50 run_fanout_capture ec "$scope_dir" "$output_dir" 4 "$pkg_root" "$mock_bin"

    if [ "$ec" -ne 0 ]; then
        fail "S01: all-tasks-success" "fanout exited ${ec}"; return
    fi
    for task in domain-logic-01 domain-logic-02 verify-01 verify-02; do
        if [ ! -f "${scope_dir}/${task}.txt" ]; then
            fail "S01: all-tasks-success" "doneSignal missing for ${task}"; return
        fi
    done
    if grep -q '[^[:space:]]' "${scope_dir}/queue.txt" 2>/dev/null; then
        fail "S01: all-tasks-success" "queue.txt not empty after completion"; return
    fi
    pass "S01: all-tasks-success"
}

# ---------------------------------------------------------------------------
# SCENARIO 2: check-cli.sh success — cursor-agent found
# ---------------------------------------------------------------------------
scenario_02() {
    local dir="${TMP_DIR}/s02"
    local output_dir="${dir}/output"
    mkdir -p "${output_dir}/.working/orchestration"

    local mock_bin="${dir}/mock-bin"
    mkdir -p "$mock_bin"
    printf '#!/usr/bin/env bash\necho mock-cursor-agent' > "${mock_bin}/cursor-agent"
    chmod +x "${mock_bin}/cursor-agent"

    local result ec
    set +e
    result="$(PATH="${mock_bin}:${PATH}" bash "$SCRIPTS_DIR/check-cli.sh" "$output_dir" 2>/dev/null)"
    ec=$?
    set -e

    if [ "$ec" -ne 0 ]; then
        fail "S02: check-cli-success" "exit code ${ec}, expected 0"; return
    fi
    if ! echo "$result" | grep -q "CLI_CMD=cursor-agent"; then
        fail "S02: check-cli-success" "CLI_CMD=cursor-agent not in stdout"; return
    fi
    local cli_cmd_file="${output_dir}/.working/orchestration/cli-cmd.txt"
    if [ ! -f "$cli_cmd_file" ]; then
        fail "S02: check-cli-success" "cli-cmd.txt not created"; return
    fi
    local cmd_content
    cmd_content="$(cat "$cli_cmd_file")"
    if [ "$cmd_content" != "cursor-agent" ]; then
        fail "S02: check-cli-success" "cli-cmd.txt='${cmd_content}', expected 'cursor-agent'"; return
    fi
    pass "S02: check-cli-success"
}

# ---------------------------------------------------------------------------
# SCENARIO 3: check-cli.sh — CLI not found
# ---------------------------------------------------------------------------
scenario_03() {
    local dir="${TMP_DIR}/s03"
    local output_dir="${dir}/output"
    mkdir -p "$output_dir"

    # Use a restricted PATH (/usr/bin:/bin only) — no cursor-agent or agent in those dirs
    # The user's local bin (/Users/bschmidt/.local/bin etc.) is excluded
    local safe_path="/usr/bin:/bin"
    local result ec
    set +e
    result="$(PATH="$safe_path" bash "$SCRIPTS_DIR/check-cli.sh" "$output_dir" 2>/dev/null)"
    ec=$?
    set -e

    if [ "$ec" -ne 1 ]; then
        fail "S03: check-cli-not-found" "exit code ${ec}, expected 1"; return
    fi
    if ! echo "$result" | grep -q "CLI_NOT_FOUND"; then
        fail "S03: check-cli-not-found" "CLI_NOT_FOUND not in stdout"; return
    fi
    pass "S03: check-cli-not-found"
}

# ---------------------------------------------------------------------------
# SCENARIO 4: 2 tasks fail-once then succeed on retry
# ---------------------------------------------------------------------------
scenario_04() {
    local dir="${TMP_DIR}/s04"
    local output_dir="${dir}/output"
    local scope_dir="${output_dir}/.working/orchestration"
    local pkg_root="${dir}/pkg"

    mkdir -p "$scope_dir"
    touch "${scope_dir}/done.txt"
    printf 'cursor-agent' > "${scope_dir}/cli-cmd.txt"
    make_package_root "$pkg_root"

    make_task_spec "${output_dir}/.working/domain-logic/task-specs/domain-logic-01.md" "domain-logic-01" "$scope_dir"
    make_task_spec "${output_dir}/.working/domain-logic/task-specs/domain-logic-02.md" "domain-logic-02" "$scope_dir"

    make_queue "$scope_dir" \
        "domain-logic-01::logic-correctness-reviewer:domain-logic-01.txt" \
        "domain-logic-02::logic-correctness-reviewer:domain-logic-02.txt"

    local fail_once_dir="${dir}/fail-once"
    mkdir -p "$fail_once_dir"
    touch "${fail_once_dir}/domain-logic-01.fail-once"
    touch "${fail_once_dir}/domain-logic-02.fail-once"

    local mock_bin="${dir}/mock-bin"
    make_mock_bin "$mock_bin"

    local ec
    MOCK_DELAY_MS=50 MOCK_FAIL_ONCE_DIR="$fail_once_dir" \
        run_fanout_capture ec "$scope_dir" "$output_dir" 4 "$pkg_root" "$mock_bin"

    if [ "$ec" -ne 0 ]; then
        fail "S04: fail-once-retry" "fanout exited ${ec}, expected 0"; return
    fi
    for task in domain-logic-01 domain-logic-02; do
        if [ ! -f "${scope_dir}/${task}.txt" ]; then
            fail "S04: fail-once-retry" "doneSignal missing for ${task}"; return
        fi
    done
    pass "S04: fail-once-retry"
}

# ---------------------------------------------------------------------------
# SCENARIO 5: retry exhaustion — task always fails, never creates doneSignal
# ---------------------------------------------------------------------------
scenario_05() {
    local dir="${TMP_DIR}/s05"
    local output_dir="${dir}/output"
    local scope_dir="${output_dir}/.working/orchestration"
    local pkg_root="${dir}/pkg"

    mkdir -p "$scope_dir"
    touch "${scope_dir}/done.txt"
    printf 'cursor-agent' > "${scope_dir}/cli-cmd.txt"
    make_package_root "$pkg_root"

    make_task_spec "${output_dir}/.working/domain-logic/task-specs/domain-logic-01.md" "domain-logic-01" "$scope_dir"

    make_queue "$scope_dir" \
        "domain-logic-01::logic-correctness-reviewer:domain-logic-01.txt"

    local mock_bin="${dir}/mock-bin"
    make_mock_bin "$mock_bin"

    # domain-logic-01 always fails permanently
    local ec
    MOCK_DELAY_MS=50 MOCK_FAIL_TASKS="domain-logic-01" \
        run_fanout_capture ec "$scope_dir" "$output_dir" 4 "$pkg_root" "$mock_bin"

    # Key assertion: doneSignal file should NOT exist (task never succeeded)
    if [ -f "${scope_dir}/domain-logic-01.txt" ]; then
        fail "S05: retry-exhaustion" "doneSignal was created for a permanently failing task"; return
    fi
    # done.txt should record the exhausted task (fanout adds it as exhausted)
    if ! grep -q "domain-logic-01" "${scope_dir}/done.txt" 2>/dev/null; then
        fail "S05: retry-exhaustion" "done.txt does not record exhausted task"; return
    fi
    pass "S05: retry-exhaustion"
}

# ---------------------------------------------------------------------------
# SCENARIO 6: rate-limit backoff fires
# ---------------------------------------------------------------------------
scenario_06() {
    local dir="${TMP_DIR}/s06"
    local output_dir="${dir}/output"
    local scope_dir="${output_dir}/.working/orchestration"
    local pkg_root="${dir}/pkg"

    mkdir -p "$scope_dir"
    touch "${scope_dir}/done.txt"
    printf 'cursor-agent' > "${scope_dir}/cli-cmd.txt"
    make_package_root "$pkg_root"

    make_task_spec "${output_dir}/.working/domain-logic/task-specs/domain-logic-01.md" "domain-logic-01" "$scope_dir"
    make_task_spec "${output_dir}/.working/domain-logic/task-specs/domain-logic-02.md" "domain-logic-02" "$scope_dir"
    make_task_spec "${output_dir}/.working/domain-logic/task-specs/domain-logic-03.md" "domain-logic-03" "$scope_dir"

    make_queue "$scope_dir" \
        "domain-logic-01::logic-correctness-reviewer:domain-logic-01.txt" \
        "domain-logic-02::logic-correctness-reviewer:domain-logic-02.txt" \
        "domain-logic-03::logic-correctness-reviewer:domain-logic-03.txt"

    local counter_file="${dir}/mock-counter.txt"
    local mock_bin="${dir}/mock-bin"
    make_mock_bin "$mock_bin"

    # Rate limit after 2 invocations — mock outputs 429 on 3rd+ call
    # Use short backoffs so the test doesn't take minutes
    local ec
    MOCK_DELAY_MS=50 MOCK_RATE_LIMIT_AFTER=2 MOCK_COUNTER_FILE="$counter_file" \
        FANOUT_BACKOFF_INITIAL=1 FANOUT_BACKOFF_RATE_LIMIT=1 \
        run_fanout_capture ec "$scope_dir" "$output_dir" 3 "$pkg_root" "$mock_bin"

    # Key assertion: mock was invoked (counter file exists)
    if [ ! -f "$counter_file" ]; then
        fail "S06: rate-limit-backoff" "counter file not created — mock was not invoked"; return
    fi
    pass "S06: rate-limit-backoff"
}

# ---------------------------------------------------------------------------
# SCENARIO 7: dependency ordering — synth waits for reviewer
# ---------------------------------------------------------------------------
scenario_07() {
    local dir="${TMP_DIR}/s07"
    local output_dir="${dir}/output"
    local scope_dir="${output_dir}/.working/orchestration"
    local pkg_root="${dir}/pkg"

    mkdir -p "$scope_dir"
    touch "${scope_dir}/done.txt"
    printf 'cursor-agent' > "${scope_dir}/cli-cmd.txt"
    make_package_root "$pkg_root"

    make_task_spec "${output_dir}/.working/domain-logic/task-specs/domain-logic-01.md" "domain-logic-01" "$scope_dir"
    make_task_spec "${output_dir}/.working/domain-logic/task-specs/domain-logic-synth.md" "domain-logic-synth" "$scope_dir"

    # domain-logic-synth depends on domain-logic-01
    make_queue "$scope_dir" \
        "domain-logic-01::logic-correctness-reviewer:domain-logic-01.txt" \
        "domain-logic-synth:domain-logic-01:logic-correctness-reviewer:domain-logic-synth.txt"

    local mock_bin="${dir}/mock-bin"
    make_mock_bin "$mock_bin"

    local ec
    MOCK_DELAY_MS=100 run_fanout_capture ec "$scope_dir" "$output_dir" 2 "$pkg_root" "$mock_bin"

    if [ "$ec" -ne 0 ]; then
        fail "S07: dependency-ordering" "fanout exited ${ec}"; return
    fi
    for task in domain-logic-01 domain-logic-synth; do
        if [ ! -f "${scope_dir}/${task}.txt" ]; then
            fail "S07: dependency-ordering" "doneSignal missing for ${task}"; return
        fi
    done
    pass "S07: dependency-ordering"
}

# ---------------------------------------------------------------------------
# SCENARIO 8: MAX_PARALLEL=2 with 6 tasks — all complete
# ---------------------------------------------------------------------------
scenario_08() {
    local dir="${TMP_DIR}/s08"
    local output_dir="${dir}/output"
    local scope_dir="${output_dir}/.working/orchestration"
    local pkg_root="${dir}/pkg"

    mkdir -p "$scope_dir"
    touch "${scope_dir}/done.txt"
    printf 'cursor-agent' > "${scope_dir}/cli-cmd.txt"
    make_package_root "$pkg_root"

    local queue_entries=""
    for i in 01 02 03 04 05 06; do
        make_task_spec "${output_dir}/.working/domain-logic/task-specs/domain-logic-${i}.md" "domain-logic-${i}" "$scope_dir"
        queue_entries="${queue_entries} domain-logic-${i}::logic-correctness-reviewer:domain-logic-${i}.txt"
    done

    make_queue "$scope_dir" \
        "domain-logic-01::logic-correctness-reviewer:domain-logic-01.txt" \
        "domain-logic-02::logic-correctness-reviewer:domain-logic-02.txt" \
        "domain-logic-03::logic-correctness-reviewer:domain-logic-03.txt" \
        "domain-logic-04::logic-correctness-reviewer:domain-logic-04.txt" \
        "domain-logic-05::logic-correctness-reviewer:domain-logic-05.txt" \
        "domain-logic-06::logic-correctness-reviewer:domain-logic-06.txt"

    local mock_bin="${dir}/mock-bin"
    make_mock_bin "$mock_bin"

    local ec
    MOCK_DELAY_MS=100 run_fanout_capture ec "$scope_dir" "$output_dir" 2 "$pkg_root" "$mock_bin"

    if [ "$ec" -ne 0 ]; then
        fail "S08: max-parallel" "fanout exited ${ec}"; return
    fi
    for i in 01 02 03 04 05 06; do
        if [ ! -f "${scope_dir}/domain-logic-${i}.txt" ]; then
            fail "S08: max-parallel" "doneSignal missing for domain-logic-${i}"; return
        fi
    done
    pass "S08: max-parallel"
}

# ---------------------------------------------------------------------------
# SCENARIO 9: empty queue.txt — fanout exits 0 immediately
# ---------------------------------------------------------------------------
scenario_09() {
    local dir="${TMP_DIR}/s09"
    local output_dir="${dir}/output"
    local scope_dir="${output_dir}/.working/orchestration"
    local pkg_root="${dir}/pkg"

    mkdir -p "$scope_dir"
    touch "${scope_dir}/done.txt"
    printf 'cursor-agent' > "${scope_dir}/cli-cmd.txt"
    make_package_root "$pkg_root"
    printf '' > "${scope_dir}/queue.txt"

    local mock_bin="${dir}/mock-bin"
    make_mock_bin "$mock_bin"

    local ec
    MOCK_DELAY_MS=50 run_fanout_capture ec "$scope_dir" "$output_dir" 4 "$pkg_root" "$mock_bin"

    if [ "$ec" -ne 0 ]; then
        fail "S09: empty-queue" "fanout exited ${ec}, expected 0"; return
    fi
    pass "S09: empty-queue"
}

# ---------------------------------------------------------------------------
# SCENARIO 10: concurrent completion — done.txt no duplicates
# ---------------------------------------------------------------------------
scenario_10() {
    local dir="${TMP_DIR}/s10"
    local output_dir="${dir}/output"
    local scope_dir="${output_dir}/.working/orchestration"
    local pkg_root="${dir}/pkg"

    mkdir -p "$scope_dir"
    touch "${scope_dir}/done.txt"
    printf 'cursor-agent' > "${scope_dir}/cli-cmd.txt"
    make_package_root "$pkg_root"

    for i in 01 02 03 04; do
        make_task_spec "${output_dir}/.working/domain-logic/task-specs/domain-logic-${i}.md" "domain-logic-${i}" "$scope_dir"
    done

    make_queue "$scope_dir" \
        "domain-logic-01::logic-correctness-reviewer:domain-logic-01.txt" \
        "domain-logic-02::logic-correctness-reviewer:domain-logic-02.txt" \
        "domain-logic-03::logic-correctness-reviewer:domain-logic-03.txt" \
        "domain-logic-04::logic-correctness-reviewer:domain-logic-04.txt"

    local mock_bin="${dir}/mock-bin"
    make_mock_bin "$mock_bin"

    local ec
    MOCK_DELAY_MS=20 run_fanout_capture ec "$scope_dir" "$output_dir" 4 "$pkg_root" "$mock_bin"

    if [ "$ec" -ne 0 ]; then
        fail "S10: concurrent-completion" "fanout exited ${ec}"; return
    fi

    local done_count dup_count
    done_count="$(sort -u "${scope_dir}/done.txt" | wc -l | tr -d ' ')"
    if [ "$done_count" -ne 4 ]; then
        fail "S10: concurrent-completion" "done.txt has ${done_count} unique entries, expected 4"; return
    fi
    dup_count="$(sort "${scope_dir}/done.txt" | uniq -d | wc -l | tr -d ' ')"
    if [ "$dup_count" -gt 0 ]; then
        fail "S10: concurrent-completion" "done.txt has ${dup_count} duplicate entries"; return
    fi
    pass "S10: concurrent-completion"
}

# ---------------------------------------------------------------------------
# Run all scenarios
# ---------------------------------------------------------------------------
echo "Running test-fanout.sh scenarios..."
echo ""

scenario_01
scenario_02
scenario_03
scenario_04
scenario_05
scenario_06
scenario_07
scenario_08
scenario_09
scenario_10

echo ""
echo "Results: ${PASS_COUNT} passed, ${FAIL_COUNT} failed"

if [ "$FAIL_COUNT" -gt 0 ]; then
    exit 1
fi
exit 0
