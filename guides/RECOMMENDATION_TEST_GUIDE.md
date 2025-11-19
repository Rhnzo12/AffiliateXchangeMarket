# Testing the Recommendation Algorithm

This guide will help you test the newly implemented recommendation algorithm for offers.

## Prerequisites

1. **Development server running**
2. **Database with test data** (users, offers, applications, analytics)
3. **A creator account** with a profile that has niches set

---

## Method 1: Test via Web UI (Easiest)

### Step 1: Start the Development Server

```bash
npm run dev
```

Wait for the server to start (usually runs on `http://localhost:5000`)

### Step 2: Login as a Creator

1. Open your browser to `http://localhost:5000`
2. Login with a creator account
3. Navigate to the **Creator Dashboard** (`/creator-dashboard`)

### Step 3: View Recommended Offers

On the Creator Dashboard, you should see a **"Recommended For You"** section showing up to 3 recommended offers.

**What to look for:**
- ✅ Offers that match your creator profile's niches should appear
- ✅ Offers you've already applied to should NOT appear
- ✅ Only approved offers should be shown
- ✅ Offers should be sorted by relevance (highest scoring first)

---

## Method 2: Test via API (Detailed Testing)

### Step 1: Start the Server

```bash
npm run dev
```

### Step 2: Get Your Session Cookie

Login first to get authenticated:

```bash
# Login as a creator
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "your_creator_username",
    "password": "your_password"
  }' \
  -c cookies.txt \
  -v
```

This saves your session cookie to `cookies.txt`.

### Step 3: Test the Recommendation Endpoint

```bash
# Get recommended offers
curl -X GET http://localhost:5000/api/offers/recommended \
  -b cookies.txt \
  -H "Content-Type: application/json" | jq
```

**Expected Response:**
```json
[
  {
    "id": "offer-uuid-1",
    "title": "Fitness App Promotion",
    "primaryNiche": "Fitness",
    "commissionType": "per_sale",
    "commissionAmount": "50.00",
    "shortDescription": "Promote our fitness app...",
    ...
  },
  {
    "id": "offer-uuid-2",
    "title": "Gaming Gear Affiliate",
    "primaryNiche": "Gaming",
    ...
  },
  ...up to 10 offers
]
```

---

## Method 3: Testing Different Scenarios

### Scenario 1: Creator with Specific Niches

**Setup:**
1. Create/login as a creator
2. Set creator profile niches: `["Fitness", "Health", "Wellness"]`
3. Create offers with matching and non-matching niches

**Expected Result:**
- Offers with "Fitness", "Health", or "Wellness" should rank higher
- Primary niche matches should score 50 points
- Additional niche matches should score 25 points each

**Test Query:**
```bash
# Check your creator profile niches first
curl -X GET http://localhost:5000/api/profile \
  -b cookies.txt | jq '.creatorProfile.niches'

# Then get recommendations
curl -X GET http://localhost:5000/api/offers/recommended \
  -b cookies.txt | jq '.[].primaryNiche'
```

### Scenario 2: Exclude Already-Applied Offers

**Setup:**
1. Apply to 2-3 offers
2. Request recommendations

**Expected Result:**
- Offers you've applied to should NOT appear in recommendations
- Only unapplied offers should be returned

**Test Query:**
```bash
# Get your applications
curl -X GET http://localhost:5000/api/applications \
  -b cookies.txt | jq '.[].offerId'

# Get recommendations (should not include above offer IDs)
curl -X GET http://localhost:5000/api/offers/recommended \
  -b cookies.txt | jq '.[].id'
```

### Scenario 3: Performance-Based Recommendations

**Setup:**
1. Have some approved applications with analytics data
2. Check if past performance influences recommendations

**Expected Result:**
- If you performed well in "Fitness" niche (high conversion rate)
- New "Fitness" offers should rank higher (up to +50 points)

**Test Query:**
```bash
# Check your analytics
curl -X GET http://localhost:5000/api/analytics \
  -b cookies.txt | jq

# Get recommendations
curl -X GET http://localhost:5000/api/offers/recommended \
  -b cookies.txt | jq
```

### Scenario 4: New Creator (No History)

**Setup:**
1. Create a brand new creator account
2. Set niches but have no applications/analytics

**Expected Result:**
- Recommendations should be based purely on niche matching
- Popular offers (high view/application counts) should rank higher
- Should still get 10 recommendations (if 10+ approved offers exist)

**Test Query:**
```bash
# Login as new creator
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "new_creator",
    "password": "password"
  }' \
  -c new_cookies.txt

# Get recommendations
curl -X GET http://localhost:5000/api/offers/recommended \
  -b new_cookies.txt | jq
```

---

## Testing on Production (Render)

### Step 1: Login to Production

```bash
# Replace with your production URL
curl -X POST https://affiliatexchange.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "your_username",
    "password": "your_password"
  }' \
  -c prod_cookies.txt \
  -v
```

### Step 2: Test Recommendations

```bash
curl -X GET https://affiliatexchange.onrender.com/api/offers/recommended \
  -b prod_cookies.txt \
  -H "Content-Type: application/json" | jq
```

---

## Debugging Tips

### Check Server Logs

Look for this log message when you call the endpoint:

```
[Recommendations] Error: <error message if any>
```

### Common Issues

**1. Empty array returned `[]`**
- ✅ Check if creator profile has niches set
- ✅ Check if there are approved offers in the database
- ✅ Check if you've already applied to all available offers

**2. Error 401 Unauthorized**
- ✅ Make sure you're logged in
- ✅ Check that your session cookie is valid
- ✅ Try logging in again

**3. Error 500 Internal Server Error**
- ✅ Check server console for error details
- ✅ Check if database is accessible
- ✅ Look for syntax errors in the implementation

### Manual Database Checks

```sql
-- Check if creator has niches
SELECT niches FROM creator_profiles
WHERE user_id = 'your-user-id';

-- Check approved offers
SELECT id, title, primary_niche, status
FROM offers
WHERE status = 'approved';

-- Check creator's applications
SELECT offer_id, status
FROM applications
WHERE creator_id = 'your-user-id';

-- Check creator's analytics
SELECT offer_id, SUM(conversions) as total_conversions, SUM(clicks) as total_clicks
FROM analytics
WHERE creator_id = 'your-user-id'
GROUP BY offer_id;
```

---

## Validation Checklist

After testing, verify:

- [ ] Recommendations appear on Creator Dashboard
- [ ] Offers match creator's niches (at least some)
- [ ] Already-applied offers are excluded
- [ ] Returns up to 10 offers
- [ ] Only approved offers are shown
- [ ] No duplicate offers in results
- [ ] API returns valid JSON
- [ ] No server errors in console
- [ ] Performance is acceptable (< 1 second response time)

---

## Expected Behavior Summary

### Scoring Breakdown

For a creator with niches `["Gaming", "Tech"]`:

**Offer A: Gaming Headset**
- Primary niche: "Gaming" → **+50 points**
- View count: 150 → **+15 points**
- Application count: 25 → **+15 points**
- Commission: $30 per sale → **+3 points**
- **Total: 83 points**

**Offer B: Fitness App**
- Primary niche: "Fitness" → **+0 points** (no match)
- Additional niches: ["Health", "Wellness"] → **+0 points**
- View count: 200 → **+15 points**
- Commission: $50 per sale → **+5 points**
- **Total: 20 points**

**Result:** Offer A ranks higher than Offer B

### Edge Cases

1. **No niches set** - Recommendations based on popularity + commission only
2. **All offers applied to** - Returns empty array `[]`
3. **No approved offers** - Returns empty array `[]`
4. **First-time creator** - No performance data, uses niche + popularity only

---

## Quick Test Script

Save this as `test-recommendations.sh`:

```bash
#!/bin/bash

BASE_URL="http://localhost:5000"

echo "🧪 Testing Recommendation Algorithm"
echo "===================================="
echo ""

# Login
echo "📝 Step 1: Logging in..."
curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"'${1:-testcreator}'","password":"'${2:-password}'"}' \
  -c test_cookies.txt > /dev/null

if [ $? -eq 0 ]; then
  echo "✅ Login successful"
else
  echo "❌ Login failed"
  exit 1
fi

echo ""

# Get recommendations
echo "📊 Step 2: Fetching recommendations..."
RESPONSE=$(curl -s -X GET "$BASE_URL/api/offers/recommended" \
  -b test_cookies.txt \
  -H "Content-Type: application/json")

if [ $? -eq 0 ]; then
  echo "✅ API call successful"
  echo ""

  # Parse response
  COUNT=$(echo "$RESPONSE" | jq '. | length')
  echo "📈 Found $COUNT recommended offers:"
  echo ""

  echo "$RESPONSE" | jq -r '.[] | "  • \(.title) (\(.primaryNiche)) - \(.commissionType)"'

  echo ""
  echo "✅ Test completed successfully!"
else
  echo "❌ API call failed"
  exit 1
fi

# Cleanup
rm -f test_cookies.txt
```

**Usage:**
```bash
chmod +x test-recommendations.sh
./test-recommendations.sh your_username your_password
```

---

## Need Help?

If you encounter issues:

1. Check server logs: `npm run dev` output
2. Verify database has test data
3. Ensure creator profile has niches set
4. Check if there are approved offers available
5. Review the REQUIREMENTS_CHECKLIST.md for implementation details

Happy testing! 🚀
