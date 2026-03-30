#!/usr/bin/env bash
# Frees ports used by `npm run dev` so a fresh turbo run can bind.
# Run from repo root when you see EADDRINUSE or 502 after starting dev twice.

set -euo pipefail
PORTS=(3000 3001 3010 4010 4110 4210 4310 4410 4510 4610)

echo "Stopping listeners on: ${PORTS[*]}"
for p in "${PORTS[@]}"; do
  pids=$(lsof -tiTCP:"$p" -sTCP:LISTEN 2>/dev/null || true)
  if [[ -n "${pids}" ]]; then
    echo "  Port $p: killing PID(s) $pids"
    kill -9 $pids 2>/dev/null || true
  else
    echo "  Port $p: (nothing listening)"
  fi
done
echo "Done. Start again with: npm run dev"
