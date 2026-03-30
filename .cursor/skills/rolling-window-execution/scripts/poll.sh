#!/usr/bin/env bash
# poll.sh {scopeDir}
#
# Detects completed tasks, updates running.txt and done.txt, reports freed slot count.
# Completion signal: {scopeDir}/{task-name}.txt exists and task not yet in done.txt.
# All file operations are scoped exclusively to {scopeDir}.

SCOPE_DIR="$1"

if [ -z "$SCOPE_DIR" ]; then
  echo "Usage: poll.sh {scopeDir}" >&2
  exit 1
fi

LOG="${SCOPE_DIR}/timing.log"
RUNNING_FILE="${SCOPE_DIR}/running.txt"
DONE="${SCOPE_DIR}/done.txt"

touch "$DONE"

if [ ! -f "$RUNNING_FILE" ]; then
  QUEUE_COUNT=$(wc -l < "${SCOPE_DIR}/queue.txt" 2>/dev/null | tr -d ' ')
  echo "RUNNING: 0 QUEUE: ${QUEUE_COUNT:-0} FREED: 0"
  exit 0
fi

FREED=0

# Slurp running file into array before the loop — prevents file-handle conflicts on NTFS
# Uses portable while-read loop (bash 3.2 compatible; mapfile requires bash 4+)
TASKS=()
while IFS= read -r line; do
  [[ -n "$line" ]] && TASKS+=("$line")
done < "$RUNNING_FILE"

for task in "${TASKS[@]}"; do
  [[ -z "$task" ]] && continue
  if [ -f "${SCOPE_DIR}/${task}.txt" ] && ! grep -q "^${task}$" "$DONE" 2>/dev/null; then
    echo "[DONE] ${task} $(date '+%H:%M:%S')" >> "$LOG"
    echo "$task" >> "$DONE"
    grep -v "^${task}$" "$RUNNING_FILE" > "${RUNNING_FILE}.tmp" && mv "${RUNNING_FILE}.tmp" "$RUNNING_FILE"
    echo "FREED: ${task}"
    FREED=$((FREED+1))
  fi
done

RUNNING_COUNT=$(grep -c . "$RUNNING_FILE" 2>/dev/null || echo 0)
QUEUE_COUNT=$(grep -c . "${SCOPE_DIR}/queue.txt" 2>/dev/null || echo 0)
echo "RUNNING: ${RUNNING_COUNT} QUEUE: ${QUEUE_COUNT} FREED: ${FREED}"
