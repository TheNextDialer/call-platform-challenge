#!/usr/bin/env bash

MODULES=("call-queue" "rate-limiter" "transcript-search" "webhook-retry" "call-metrics")
PASS=0
FAIL=0
RESULTS=()

echo ""
echo "══════════════════════════════════════════"
echo "  Call Platform CI — Module Health Check"
echo "══════════════════════════════════════════"
echo ""

for mod in "${MODULES[@]}"; do
  output=$(timeout 30 node "modules/$mod/test/run.js" 2>&1)
  if [ $? -eq 0 ]; then
    RESULTS+=("  ✅ $mod")
    ((PASS++))
  else
    RESULTS+=("  ❌ $mod")
    ((FAIL++))
  fi
done

for r in "${RESULTS[@]}"; do
  echo "$r"
done

echo ""
echo "──────────────────────────────────────────"
echo "  $PASS / ${#MODULES[@]} modules passing"
echo "──────────────────────────────────────────"
echo ""

if [ $FAIL -gt 0 ]; then
  exit 1
fi
