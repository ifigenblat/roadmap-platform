#!/usr/bin/env bash
# spawn-log.sh {scopeDir} task1 task2 ...
#
# Logs spawns with timestamps and adds task names to running.txt.
# Call immediately before spawning the corresponding Task calls.
# All file operations are scoped exclusively to {scopeDir}.

SCOPE_DIR="$1"
shift

if [ -z "$SCOPE_DIR" ]; then
  echo "Usage: spawn-log.sh {scopeDir} task1 task2 ..." >&2
  exit 1
fi

LOG="${SCOPE_DIR}/timing.log"

for task in "$@"; do
  echo "[SPAWN] ${task} $(date '+%H:%M:%S')" >> "$LOG"
  echo "$task" >> "${SCOPE_DIR}/running.txt"
done
