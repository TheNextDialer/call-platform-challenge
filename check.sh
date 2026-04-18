#!/usr/bin/env bash

MODULES=("call-routing" "dial-scheduler" "call-recording-store" "contact-dedup" "voicemail-drop" "campaign-analytics" "sip-parser" "billing-calculator")
PASS=0
FAIL=0
RESULTS=()

echo ""
echo "══════════════════════════════════════════"
echo "  Call Platform CI — Module Health Check"
echo "══════════════════════════════════════════"
echo ""

# macOS doesn't have `timeout` by default; use it if available, else run directly
if command -v timeout >/dev/null 2>&1; then
  TIMEOUT_CMD="timeout 30"
elif command -v gtimeout >/dev/null 2>&1; then
  TIMEOUT_CMD="gtimeout 30"
else
  TIMEOUT_CMD=""
fi

for mod in "${MODULES[@]}"; do
  output=$($TIMEOUT_CMD node "modules/$mod/test/run.js" 2>&1)
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
