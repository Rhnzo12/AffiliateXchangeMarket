#!/bin/bash

BASE_URL="${BASE_URL:-http://localhost:5000}"
USERNAME="${1:-testcreator}"
PASSWORD="${2:-password}"

echo "🧪 Testing Recommendation Algorithm"
echo "===================================="
echo "Server: $BASE_URL"
echo "Username: $USERNAME"
echo ""

# Login
echo "📝 Step 1: Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}" \
  -c test_cookies.txt \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$LOGIN_RESPONSE" | tail -n1)

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Login successful (HTTP 200)"
else
  echo "❌ Login failed (HTTP $HTTP_CODE)"
  rm -f test_cookies.txt
  exit 1
fi

echo ""

# Get profile to check niches
echo "👤 Step 2: Checking creator profile..."
PROFILE=$(curl -s -X GET "$BASE_URL/api/profile" \
  -b test_cookies.txt \
  -H "Content-Type: application/json")

NICHES=$(echo "$PROFILE" | jq -r '.creatorProfile.niches // [] | join(", ")')
if [ -n "$NICHES" ] && [ "$NICHES" != "" ]; then
  echo "✅ Creator niches: [$NICHES]"
else
  echo "⚠️  No niches set for this creator"
fi

echo ""

# Get recommendations
echo "📊 Step 3: Fetching recommendations..."
RESPONSE=$(curl -s -X GET "$BASE_URL/api/offers/recommended" \
  -b test_cookies.txt \
  -H "Content-Type: application/json" \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ API call successful (HTTP 200)"
  echo ""
  
  # Parse response
  COUNT=$(echo "$BODY" | jq '. | length')
  echo "📈 Found $COUNT recommended offers:"
  echo ""
  
  if [ "$COUNT" -gt 0 ]; then
    echo "$BODY" | jq -r '.[] | "  • \(.title)"
    "    Niche: \(.primaryNiche)"
    "    Commission: \(.commissionType) - \(.commissionAmount // .commissionPercentage // "N/A")"
    ""'
    echo ""
    echo "✅ Test completed successfully!"
  else
    echo "  (No recommendations available)"
    echo ""
    echo "⚠️  This could mean:"
    echo "    - No approved offers in database"
    echo "    - Creator has already applied to all offers"
    echo "    - No offers match creator's niches"
  fi
else
  echo "❌ API call failed (HTTP $HTTP_CODE)"
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
  rm -f test_cookies.txt
  exit 1
fi

# Get applications to see what was excluded
echo ""
echo "📋 Step 4: Checking existing applications..."
APPS=$(curl -s -X GET "$BASE_URL/api/applications" \
  -b test_cookies.txt \
  -H "Content-Type: application/json")

APP_COUNT=$(echo "$APPS" | jq '. | length')
if [ "$APP_COUNT" -gt 0 ]; then
  echo "✅ Creator has $APP_COUNT existing applications (these are excluded from recommendations)"
else
  echo "ℹ️  Creator has no existing applications"
fi

echo ""
echo "================================"
echo "✅ All tests completed!"
echo "================================"

# Cleanup
rm -f test_cookies.txt
