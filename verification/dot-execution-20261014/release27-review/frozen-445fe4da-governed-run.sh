#!/usr/bin/env bash
set -u
cd /workspace/shared/clrt-release-frozen-445fe4da || exit 90
out=/workspace/shared/clrt-iteration-repair-evidence/frozen-445fe4da-governed
[ "$(git rev-parse HEAD)" = 445fe4da9688cc68a59406376ffef0e06cae9f2c ] || exit 91
[ -z "$(git status --porcelain --untracked-files=no)" ] || exit 92
date -u +%Y-%m-%dT%H:%M:%SZ > "$out/started-at.txt"
{ free -h; df -h /workspace/shared; } > "$out/start-resources.txt"
git rev-parse HEAD > "$out/producer-commit.txt"
sha256sum workflow-engine.js workflow-schema.js project-store.js response-ingestion.js verify-full-cycle.mjs test-release-semantic-fixture.mjs > "$out/producer-sha256.txt"
NODE_OPTIONS=--max-old-space-size=4096 node verify-full-cycle.mjs --governed-preproduct --iteration-boundary-directory="$out" --failure-fixture="$out/failure-state.json" > "$out/stdout.json" 2> "$out/stderr.log"
status=$?
printf '%s\n' "$status" > "$out/exit-code.txt"
date -u +%Y-%m-%dT%H:%M:%SZ > "$out/ended-at.txt"
{ free -h; df -h /workspace/shared; } > "$out/end-resources.txt"
exit "$status"
