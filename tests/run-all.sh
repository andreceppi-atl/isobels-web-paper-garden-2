#!/usr/bin/env bash
# Runs every rule test in the repo.  Usage:  ./tests/run-all.sh
#
# Each test gets its OWN throwaway server on port 5291 with its OWN temp data
# folder, so this can never touch the live world's data (server/data) and the
# tests cannot interfere with each other. Takes a few minutes (rate-limit and
# expiry tests wait in real time).
cd "$(dirname "$0")/.." || exit 1

PORT=5291
FAILED=()
TMPS=()
SERVER_PID=""

cleanup() {
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null
  for d in "${TMPS[@]}"; do rm -rf "$d"; done
}
trap cleanup EXIT

start_server() {   # start_server <datadir> [ENV=VALUE ...]
  local dir=$1; shift
  env PORT=$PORT DATA_DIR="$dir" MAP_ID=canopy THREAD_TICK_MS=100000 "$@" node server/src/index.js >"$dir/server.log" 2>&1 &
  SERVER_PID=$!
  sleep 1.5
}

stop_server() {
  kill "$SERVER_PID" 2>/dev/null
  wait "$SERVER_PID" 2>/dev/null
  SERVER_PID=""
}

# run_test <label> "<ENV=V ...>" <script> [args...]   (server URL is inserted after the script)
run_test() {
  local label=$1 envs=$2 script=$3; shift 3
  local dir; dir=$(mktemp -d); TMPS+=("$dir")
  echo "== $label"
  # shellcheck disable=SC2086
  start_server "$dir" $envs
  if node "$script" "http://localhost:$PORT" "$@"; then :; else FAILED+=("$label"); fi
  stop_server
}

echo "== shared geometry + maps"
node shared/check.mjs || FAILED+=("shared/check.mjs")
echo "== movement model"
node tests/movement-model.mjs || FAILED+=("movement model")
echo "== trick + style model"
node tests/trick-model.mjs || FAILED+=("trick + style model")
echo "== touch controls model"
node tests/touch-model.mjs || FAILED+=("touch controls model")
echo "== Long Garden + home web model"
node tests/world-webs.mjs || FAILED+=("Long Garden + home web model")

run_test "handshake rules"          ""                                                                tests/handshake-rules.mjs
run_test "chat rules"               ""                                                                tests/chat-rules.mjs
run_test "emotes (scope: everyone)" ""                                                                tests/emote-rules.mjs everyone
run_test "emotes (scope: connected)" "EMOTE_SCOPE=connected"                                          tests/emote-rules.mjs connected
run_test "new-map strand + rotation rules" ""                                                         tests/map-rules.mjs
run_test "strand expiry + thread trickle" "STRAND_LIFETIME_MS=1500 STRAND_SWEEP_MS=300 THREAD_TICK_MS=200" tests/strand-rules.mjs expiry

# strands / thread / colors, then restart the SAME server data and check it all persisted
for name in strand color; do
  dir=$(mktemp -d); TMPS+=("$dir")
  echo "== $name rules (+ restart persistence)"
  start_server "$dir"
  node "tests/$name-rules.mjs" "http://localhost:$PORT" rules || FAILED+=("$name rules")
  sleep 6.5            # let the debounced saves flush
  stop_server
  if [ "$name" = color ]; then
    # legacy / hostile strand colors must fall back to silk after a restart
    node -e '
      const fs=require("fs");const f=process.argv[1]+"/strands.json";const d=JSON.parse(fs.readFileSync(f,"utf8"));
      const t=Date.now()+600000;
      d.strands.push({id:"legacy000001",owner:"someone",x1:100,y1:1500,x2:170,y2:1500,expiresAt:t});
      d.strands.push({id:"legacy000002",owner:"someone",x1:200,y1:1500,x2:270,y2:1500,expiresAt:t,color:"red;}body{display:none"});
      fs.writeFileSync(f,JSON.stringify(d));' "$dir"
  fi
  start_server "$dir"
  node "tests/$name-rules.mjs" "http://localhost:$PORT" restart || FAILED+=("$name restart persistence")
  stop_server
done

echo
if [ ${#FAILED[@]} -eq 0 ]; then
  echo "ALL TEST GROUPS PASSED"
else
  echo "FAILED: ${FAILED[*]}"
  exit 1
fi
