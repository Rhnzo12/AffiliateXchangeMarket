#!/bin/bash

USERNAME="${1}"
PASSWORD="${2}"
NICHES="${3}"
BASE_URL="${BASE_URL:-http://localhost:5000}"

if [ -z "$USERNAME" ] || [ -z "$PASSWORD" ] || [ -z "$NICHES" ]; then
  echo "Usage: $0 <username> <password> <niches>"
  echo "Example: $0 creator1 password123 'Gaming,Tech,Reviews'"
  exit 1
fi

# Convert comma-separated string to JSON array
IFS=',' read -ra NICHE_ARRAY <<< "$NICHES"
JSON_NICHES="["
for i in "${!NICHE_ARRAY[@]}"; do
  NICHE=$(echo "${NICHE_ARRAY[$i]}" | xargs)  # Trim whitespace
  if [ $i -gt 0 ]; then
    JSON_NICHES+=","
  fi
  JSON_NICHES+="\"$NICHE\""
done
JSON_NICHES+="]"

echo "🔧 Setting niches for user: $USERNAME"
echo "📋 Niches: $JSON_NICHES"
echo ""

# Login
echo "📝 Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}" \
  -c temp_cookies.txt \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$LOGIN_RESPONSE" | tail -n1)

if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ Login failed (HTTP $HTTP_CODE)"
  rm -f temp_cookies.txt
  exit 1
fi

echo "✅ Login successful"
echo ""

# Update profile with niches
echo "🔄 Updating niches..."
RESPONSE=$(curl -s -X PUT "$BASE_URL/api/profile" \
  -b temp_cookies.txt \
  -H "Content-Type: application/json" \
  -d "{\"niches\":$JSON_NICHES}")

# Check if update was successful
UPDATED_NICHES=$(echo "$RESPONSE" | jq -r '.creatorProfile.niches // .niches // empty' 2>/dev/null)

if [ -n "$UPDATED_NICHES" ]; then
  echo "✅ Niches updated successfully!"
  echo ""
  echo "Current niches:"
  echo "$UPDATED_NICHES"
else
  echo "❌ Failed to update niches"
  echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
fi

# Cleanup
rm -f temp_cookies.txt
