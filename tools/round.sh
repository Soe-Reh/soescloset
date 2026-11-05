#!/bin/sh
# Films the site at a room and pairs it with the reference for blind critics.
#   tools/round.sh <round-name> [#/room], for example tools/round.sh walk1 "#/walk"
# Writes research/blind/rounds/<name>/c0 (site on LEFT) and c1 (site on RIGHT). Workflows hold the key.
set -e
cd "$(dirname "$0")/.."
PORT=8741
curl -sf -o /dev/null "http://localhost:$PORT/" || { nohup python3 -m http.server $PORT --directory site >/dev/null 2>&1 & sleep 1; }
D="research/blind/rounds/$1"
rm -rf "$D"; mkdir -p "$D"
node tools/blind.mjs film "http://localhost:$PORT/$2" "$D/a"
node tools/blind.mjs pair "$D/a" research/blind/ref "$D/c0"
node tools/blind.mjs pair research/blind/ref "$D/a" "$D/c1"
