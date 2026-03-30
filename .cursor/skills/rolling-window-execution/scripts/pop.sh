#!/usr/bin/env bash
# pop.sh {N} {scopeDir}
#
# Scans queue.txt for tasks whose dependencies are all in done.txt.
# Pops up to N ready tasks, outputs: SPAWN_NEXT: {task-name} {agent-type}
# Blocked tasks remain in queue.txt untouched.
# Queue format per line: task-name:deps:agent-type:result-file
# All file operations are scoped exclusively to {scopeDir}.

N=${1:-1}
SCOPE_DIR="$2"

if [ -z "$SCOPE_DIR" ]; then
  echo "Usage: pop.sh {N} {scopeDir}" >&2
  exit 1
fi

QUEUE="${SCOPE_DIR}/queue.txt"
DONE="${SCOPE_DIR}/done.txt"

touch "$DONE"
[ ! -f "$QUEUE" ] && exit 0

POPPED=0
REMAINING=()

while IFS= read -r line; do
  [[ -z "$line" ]] && continue

  task=$(echo "$line" | cut -d: -f1)
  deps=$(echo "$line" | cut -d: -f2)
  agent_type=$(echo "$line" | cut -d: -f3)

  if [ $POPPED -ge $N ]; then
    REMAINING+=("$line")
    continue
  fi

  READY=true
  if [ -n "$deps" ]; then
    IFS=',' read -ra dep_list <<< "$deps"
    for dep in "${dep_list[@]}"; do
      [[ -z "$dep" ]] && continue
      grep -q "^${dep}$" "$DONE" 2>/dev/null || { READY=false; break; }
    done
  fi

  if $READY; then
    echo "SPAWN_NEXT: ${task} ${agent_type:-generalPurpose}"
    POPPED=$((POPPED+1))
  else
    REMAINING+=("$line")
  fi
done < "$QUEUE"

printf '%s\n' "${REMAINING[@]}" > "$QUEUE"
