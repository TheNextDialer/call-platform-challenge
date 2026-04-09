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

# Generate verification code
VERIFY_INPUT="cp-${PASS}-${FAIL}-phoneburner"
VERIFY_CODE=$(echo -n "$VERIFY_INPUT" | shasum -a 256 | cut -c1-8)

echo ""
echo "──────────────────────────────────────────"
echo "  $PASS / ${#MODULES[@]} modules passing"
echo "  Verification: $VERIFY_CODE"
echo "──────────────────────────────────────────"
echo ""

if [ $FAIL -gt 0 ]; then
  exit 1
fi
