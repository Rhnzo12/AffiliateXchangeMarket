# UTM Parameter Tracking - Testing Guide

## Prerequisites

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Ensure you have a test application with tracking link:**
   - Login as a creator
   - Apply to an offer
   - Get the application approved (or approve it as the company)
   - You'll receive a tracking link like: `http://localhost:5000/go/CR-12345678-87654321`

---

## Test 1: Basic UTM Parameter Tracking

### Step 1: Test with Browser

Open your browser and visit the tracking link with UTM parameters:

```
http://localhost:5000/go/CR-12345678-87654321?utm_source=facebook&utm_medium=cpc&utm_campaign=summer_sale&utm_term=best_deals&utm_content=video_ad
```

**Expected Result:**
- You should be redirected to the offer's product URL
- Click event should be logged in the database

### Step 2: Verify Data in Database

Connect to your database and check the `click_events` table:

```sql
SELECT
  id,
  ip_address,
  utm_source,
  utm_medium,
  utm_campaign,
  utm_term,
  utm_content,
  timestamp
FROM click_events
ORDER BY timestamp DESC
LIMIT 5;
```

**Expected Result:**
```
utm_source   | facebook
utm_medium   | cpc
utm_campaign | summer_sale
utm_term     | best_deals
utm_content  | video_ad
```

---

## Test 2: Test with cURL (Command Line)

### Test Full UTM Parameters

```bash
curl -L "http://localhost:5000/go/CR-12345678-87654321?utm_source=google&utm_medium=email&utm_campaign=product_launch&utm_term=new_product&utm_content=banner_ad"
```

### Test Partial UTM Parameters (some missing)

```bash
curl -L "http://localhost:5000/go/CR-12345678-87654321?utm_source=twitter&utm_medium=social"
```

**Expected Result:**
- Only provided UTM parameters should be stored
- Missing parameters should be NULL in database

### Test Without UTM Parameters

```bash
curl -L "http://localhost:5000/go/CR-12345678-87654321"
```

**Expected Result:**
- Click should still be logged
- All UTM fields should be NULL

---

## Test 3: Test Different Traffic Sources

### Test 1: Facebook Ads
```bash
curl -L "http://localhost:5000/go/CR-12345678-87654321?utm_source=facebook&utm_medium=cpc&utm_campaign=fall_promo&utm_content=carousel_ad"
```

### Test 2: Google Ads
```bash
curl -L "http://localhost:5000/go/CR-12345678-87654321?utm_source=google&utm_medium=cpc&utm_campaign=brand_awareness&utm_term=affiliate+marketplace"
```

### Test 3: Email Newsletter
```bash
curl -L "http://localhost:5000/go/CR-12345678-87654321?utm_source=newsletter&utm_medium=email&utm_campaign=weekly_digest&utm_content=top_link"
```

### Test 4: Instagram Story
```bash
curl -L "http://localhost:5000/go/CR-12345678-87654321?utm_source=instagram&utm_medium=social&utm_campaign=influencer_collab&utm_content=story_swipeup"
```

---

## Test 4: Automated Test Script

Create a test script to verify UTM tracking:

```bash
#!/bin/bash
# Save as test-utm-tracking.sh

TRACKING_CODE="CR-12345678-87654321"  # Replace with your actual tracking code
BASE_URL="http://localhost:5000"

echo "🧪 Testing UTM Parameter Tracking..."
echo "======================================"

# Test 1: All UTM parameters
echo ""
echo "Test 1: All UTM parameters"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" \
  "${BASE_URL}/go/${TRACKING_CODE}?utm_source=test_source&utm_medium=test_medium&utm_campaign=test_campaign&utm_term=test_term&utm_content=test_content"

sleep 1

# Test 2: Partial UTM parameters
echo ""
echo "Test 2: Partial UTM parameters (source + medium only)"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" \
  "${BASE_URL}/go/${TRACKING_CODE}?utm_source=partial_test&utm_medium=partial_medium"

sleep 1

# Test 3: No UTM parameters
echo ""
echo "Test 3: No UTM parameters"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" \
  "${BASE_URL}/go/${TRACKING_CODE}"

sleep 1

# Test 4: Special characters in UTM parameters
echo ""
echo "Test 4: Special characters in UTM parameters"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" \
  "${BASE_URL}/go/${TRACKING_CODE}?utm_source=test&utm_campaign=2024%20Summer%20Sale&utm_content=50%25%20off"

echo ""
echo "✅ Tests complete! Check your database to verify results."
```

**Run the script:**
```bash
chmod +x test-utm-tracking.sh
./test-utm-tracking.sh
```

---

## Test 5: Check Server Logs

Monitor your server console output while clicking tracking links:

**Expected Log Output:**
```
[Tracking] Logged click for application abc123 from New York, US - IP: 192.168.1.100
```

---

## Test 6: Query Analytics Data

### Check Click Events with UTM Data

```sql
-- View all clicks with UTM parameters
SELECT
  ce.id,
  ce.ip_address,
  ce.utm_source,
  ce.utm_medium,
  ce.utm_campaign,
  ce.timestamp,
  a.tracking_code,
  o.title as offer_title
FROM click_events ce
JOIN applications a ON ce.application_id = a.id
JOIN offers o ON ce.offer_id = o.id
WHERE ce.utm_source IS NOT NULL
ORDER BY ce.timestamp DESC
LIMIT 20;
```

### Group by Traffic Source

```sql
-- Count clicks by traffic source
SELECT
  utm_source,
  utm_medium,
  COUNT(*) as click_count
FROM click_events
WHERE utm_source IS NOT NULL
GROUP BY utm_source, utm_medium
ORDER BY click_count DESC;
```

### Campaign Performance Analysis

```sql
-- Analyze campaign performance
SELECT
  utm_campaign,
  utm_source,
  utm_medium,
  COUNT(*) as total_clicks,
  COUNT(DISTINCT ip_address) as unique_clicks,
  AVG(fraud_score) as avg_fraud_score
FROM click_events
WHERE utm_campaign IS NOT NULL
GROUP BY utm_campaign, utm_source, utm_medium
ORDER BY total_clicks DESC;
```

---

## Test 7: Integration Test with Postman

### Create Postman Collection

1. **Request 1: Track Click with Full UTM**
   - Method: `GET`
   - URL: `http://localhost:5000/go/{{tracking_code}}`
   - Query Params:
     - `utm_source`: facebook
     - `utm_medium`: cpc
     - `utm_campaign`: summer_sale
     - `utm_term`: best_deals
     - `utm_content`: video_ad

2. **Request 2: Track Click - Google Ads**
   - Method: `GET`
   - URL: `http://localhost:5000/go/{{tracking_code}}`
   - Query Params:
     - `utm_source`: google
     - `utm_medium`: cpc
     - `utm_campaign`: brand_campaign

3. **Request 3: Track Click - Email**
   - Method: `GET`
   - URL: `http://localhost:5000/go/{{tracking_code}}`
   - Query Params:
     - `utm_source`: newsletter
     - `utm_medium`: email
     - `utm_campaign`: weekly_digest

---

## Test 8: Test with Fraud Detection

The UTM parameters should work alongside fraud detection:

```bash
# Test 1: Normal click with UTM (should pass fraud detection)
curl -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" \
  -H "Referer: https://facebook.com" \
  "http://localhost:5000/go/CR-12345678-87654321?utm_source=facebook&utm_medium=cpc"

# Test 2: Bot-like click with UTM (should be flagged but still logged)
curl -A "bot crawler spider" \
  "http://localhost:5000/go/CR-12345678-87654321?utm_source=test&utm_medium=test"
```

**Expected Result:**
- Both clicks logged with UTM parameters
- Second click has higher fraud_score
- UTM data preserved regardless of fraud detection

---

## Test 9: End-to-End User Flow

### Complete Test Scenario

1. **Setup (as Company):**
   - Create an offer
   - Approve the offer (or have admin approve)

2. **Apply (as Creator):**
   - Login as creator
   - Apply to the offer

3. **Approve (as Company):**
   - Login as company
   - Approve the creator's application
   - Copy the tracking link from the application details

4. **Share Link (as Creator):**
   - Share the tracking link with UTM parameters:
     ```
     http://localhost:5000/go/CR-abc-xyz?utm_source=instagram&utm_medium=story&utm_campaign=spring_promo
     ```

5. **Click Link (as End User):**
   - Click the link in browser
   - Verify redirect to product URL

6. **Check Analytics (as Creator):**
   - Login as creator
   - Visit `/analytics` page
   - Verify click was counted

7. **Verify Database:**
   - Check `click_events` table for UTM data

---

## Test 10: Verify NULL Handling

Test that the system correctly handles missing UTM parameters:

```sql
-- Should show clicks without UTM data
SELECT
  COUNT(*) as clicks_without_utm
FROM click_events
WHERE utm_source IS NULL
  AND utm_medium IS NULL
  AND utm_campaign IS NULL;

-- Should show clicks with partial UTM data
SELECT
  COUNT(*) as clicks_with_partial_utm
FROM click_events
WHERE utm_source IS NOT NULL
  AND (utm_medium IS NULL OR utm_campaign IS NULL);
```

---

## Expected Results Summary

### ✅ Success Criteria

1. **Tracking Link Redirect**: All tracking links should redirect to product URL (HTTP 302)
2. **Data Storage**: UTM parameters correctly stored in `click_events` table
3. **NULL Handling**: Missing UTM parameters stored as NULL (not empty string)
4. **Fraud Detection**: UTM tracking works with fraud detection enabled
5. **Analytics**: Clicks counted in analytics regardless of UTM presence
6. **Special Characters**: URL-encoded characters handled correctly
7. **Case Sensitivity**: UTM parameters case-preserved as provided

### ❌ Failure Indicators

- 404 errors when accessing tracking links
- UTM parameters not appearing in database
- Server errors in console
- Clicks not being counted in analytics
- Empty strings instead of NULL for missing parameters

---

## Troubleshooting

### Issue: UTM parameters not showing in database

**Check:**
1. Verify schema migration ran successfully
2. Check if `click_events` table has the 5 new columns
3. Verify tracking endpoint is parsing query parameters

**Fix:**
```bash
# Push database schema changes
npm run db:push
```

### Issue: Tracking link returns 404

**Check:**
1. Application has valid tracking code
2. Application status is 'approved'
3. Server is running

### Issue: Clicks not counted in analytics

**Check:**
1. Fraud score is below 50 (high fraud scores excluded from analytics)
2. Click event was successfully logged
3. Analytics aggregation is working

---

## Next Steps After Testing

Once you've verified UTM tracking works:

1. **Update Creator Documentation**: Explain how to use UTM parameters
2. **Add Analytics Dashboard**: Show UTM-based reports in `/analytics`
3. **Create Campaign Presets**: Allow creators to save common UTM combinations
4. **Add Validation**: Consider validating UTM parameter formats
5. **Export Features**: Include UTM data in CSV exports

---

## Database Migration Note

⚠️ **IMPORTANT**: After pulling these changes, you'll need to update your database schema:

```bash
npm run db:push
```

This will add the 5 new UTM columns to the `click_events` table.

---

## Quick Test Checklist

- [ ] Tracking link redirects correctly
- [ ] All 5 UTM parameters stored in database
- [ ] Partial UTM parameters work (some missing)
- [ ] No UTM parameters works (all NULL)
- [ ] Special characters in UTM handled correctly
- [ ] Fraud detection still works with UTM
- [ ] Analytics count includes UTM-tracked clicks
- [ ] Server logs show successful click logging
- [ ] Multiple clicks create separate records
- [ ] Query analytics by campaign works
