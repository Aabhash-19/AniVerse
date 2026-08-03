#!/usr/bin/env bash
# chain_sync_to_5000.sh
# Chains multiple 1000-anime syncs on production until we hit ~5000 anime.

API="https://namiverse-api.onrender.com/api/v1"
TARGET=5000
BATCH=1000

count_anime() {
  total=0
  page=1
  while true; do
    c=$(curl -s "$API/anime?sort=popularity&page=${page}&limit=100" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))" 2>/dev/null)
    total=$((total + c))
    if [ "$c" -lt "100" ]; then break; fi
    page=$((page + 1))
  done
  echo $total
}

reset_stuck() {
  curl -s -X POST "$API/admin/jobs/reset-stuck" > /dev/null 2>&1
}

trigger_sync() {
  local round_num=$1
  local start_page=$(( ( (round_num - 1) * (BATCH / 20) ) + 1 ))
  echo "  (AniList Start Page: $start_page)"
  curl -s -X POST "$API/admin/catalogue/sync?limit=$BATCH&start_page=$start_page" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('job_id','ERROR')[:8] if 'job_id' in d else d.get('detail','?'))"
}

wait_for_jobs() {
  echo "  ⏳ Waiting for sync to complete..."
  while true; do
    sleep 30
    status=$(curl -s "$API/admin/jobs?limit=1" | python3 -c "import sys,json; jobs=json.load(sys.stdin); print(jobs[0]['status'] if jobs else 'UNKNOWN')" 2>/dev/null)
    processed=$(curl -s "$API/admin/jobs?limit=1" | python3 -c "import sys,json; jobs=json.load(sys.stdin); print(jobs[0].get('records_processed',0) if jobs else 0)" 2>/dev/null)
    echo "  → Status: $status | processed: $processed"
    if [ "$status" = "COMPLETED" ] || [ "$status" = "FAILED" ]; then
      break
    fi
  done
}

echo "🍊 NamiVerse Catalogue Chain Sync — Target: $TARGET anime"
echo "=========================================================="

round=1
while true; do
  echo ""
  current=$(count_anime)
  echo "📊 Round $round — Current production anime: $current"

  if [ "$current" -ge "$TARGET" ]; then
    echo "✅ TARGET REACHED! $current anime in production. Done! 🏴‍☠️"
    break
  fi

  echo "🔄 Resetting any stuck jobs..."
  reset_stuck
  sleep 2

  echo "🚀 Triggering $BATCH-anime sync (Round $round)..."
  job_id=$(trigger_sync $round)
  echo "  Job ID: $job_id"

  if echo "$job_id" | grep -qi "running\|already"; then
    echo "  ⚠️  Job already running, waiting..."
    wait_for_jobs
  else
    wait_for_jobs
  fi

  round=$((round + 1))

  # Safety cap
  if [ $round -gt 8 ]; then
    echo "⚠️  Reached max rounds (8). Stopping."
    break
  fi
done

final=$(count_anime)
echo ""
echo "🎌 Final production anime count: $final"
