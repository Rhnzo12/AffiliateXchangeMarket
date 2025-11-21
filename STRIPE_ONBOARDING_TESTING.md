# Stripe Connect Onboarding - Testing Guide

This guide walks you through testing the complete Stripe Connect onboarding flow in development mode.

## Prerequisites

### 1. Environment Setup

Ensure your `.env` file has:
```bash
STRIPE_SECRET_KEY=sk_test_51...
BASE_URL=http://localhost:5000
```

**Get Test API Keys:**
1. Go to https://dashboard.stripe.com/test/apikeys
2. Copy your **Secret key** (starts with `sk_test_`)
3. Add to `.env` file

### 2. Database Migration

Run the Stripe Connect migration:
```bash
npm run migrate:stripe-connect
```

This adds the `stripe_account_id` column to `payment_settings` table.

### 3. Start the Application

```bash
npm run dev
```

---

## Testing Flow

### Part 1: Creator Onboarding

#### Step 1: Create Creator Account

1. Navigate to: `http://localhost:5000/creator-register`
2. Fill out registration form:
   - Username: `testcreator1`
   - Email: `creator@test.com`
   - Password: `TestPass123!`
3. Complete creator profile setup
4. Login to account

#### Step 2: Navigate to Payment Settings

1. Click on your profile (top right)
2. Select **"Settings"** → **"Payment Settings"**
3. Or navigate directly to: `http://localhost:5000/settings/payment`

#### Step 3: Add E-Transfer Payment Method

1. Click **"Add Payment Method"** button
2. Select **"E-Transfer"** from dropdown
3. Enter email: `creator@test.com`
4. Click **"Add Payment Method"**

**What Happens:**
- System creates Stripe Connect account automatically
- Account ID saved to database
- You're redirected to Stripe onboarding

#### Step 4: Complete Stripe Onboarding

You'll be taken to Stripe's onboarding page.

**Use These Test Values:**

**Business Type:**
- Select: **"Individual"**

**Personal Information:**
- First Name: `Test`
- Last Name: `Creator`
- Date of Birth: `01/01/1990`
- Phone: `000-000-0000` (Stripe test phone)
- Address: `123 Test Street`
- City: `Toronto`
- Province: `Ontario`
- Postal Code: `M5H 2N2`

**Business Details:**
- Industry: `Software and IT services`
- Business Description: `Content creation and affiliate marketing`
- Website: `https://test-creator.com` (optional)

**Tax Information:**
- SSN/SIN: `000000000` (9 zeros - Stripe test value)

**Bank Account Information:**
- Country: `Canada` (or your test country)
- Currency: `CAD`
- Routing Number: `11000-000` (format: transit-institution)
  - Transit: `11000`
  - Institution: `000`
- Account Number: `000123456789`
- Account Type: `Checking`

**Identity Verification:**
- You may be asked to upload ID (in test mode, any image works)
- Or Stripe may skip this step for test accounts

#### Step 5: Complete and Return

1. Click **"Submit"** when all information is filled
2. You'll be redirected to: `http://localhost:5000/settings/payment?stripe_onboarding=success`
3. You should see a success toast message
4. Your payment method should now show as active (no warning banner)

---

### Part 2: Verify Account Setup

#### Check Payment Settings

1. Go to **Settings** → **Payment Settings**
2. You should see your e-transfer payment method listed
3. It should show:
   - ✅ E-Transfer
   - ✅ Email: `creator@test.com`
   - ✅ No yellow warning banner
   - ✅ "Default" badge (if it's your only payment method)

#### Verify in Database

Query the database:
```sql
SELECT
  id,
  user_id,
  payout_method,
  payout_email,
  stripe_account_id,
  is_default
FROM payment_settings
WHERE payout_method = 'etransfer';
```

You should see a record with:
- `payout_method`: `etransfer`
- `payout_email`: `creator@test.com`
- `stripe_account_id`: `acct_xxxxxxxxxxxxx`

#### Check Stripe Dashboard

1. Go to: https://dashboard.stripe.com/test/connect/accounts
2. You should see the connected account you just created
3. Click on it to view details
4. Verify:
   - Status: **Active** or **Enabled**
   - Details submitted: ✅
   - Payouts enabled: ✅

---

### Part 3: Test Account Status API

Use curl or Postman to test the API:

```bash
# Get your session token (login first and check browser cookies)
SESSION_TOKEN="your-session-token-here"

# Check account status
curl -X GET "http://localhost:5000/api/stripe-connect/account-status/acct_xxxxxxxxxxxxx" \
  -H "Cookie: connect.sid=$SESSION_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "detailsSubmitted": true,
  "chargesEnabled": false,
  "payoutsEnabled": true,
  "requirements": []
}
```

---

### Part 4: Test Payment Transfer

#### Prerequisites

**Fund Your Test Platform Account:**
1. Go to: https://dashboard.stripe.com/test/balance
2. Click **"Add funds"** (test mode only)
3. Add at least $100.00 CAD

#### Create Test Payment

As an **admin** user:

1. Create a test offer and application
2. Record a conversion
3. Create a payment for the creator
4. Approve the payment

Or use the API directly:

```bash
# Create a test payment (as admin)
curl -X POST "http://localhost:5000/api/payments" \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=$ADMIN_SESSION" \
  -d '{
    "creatorId": "creator_user_id",
    "grossAmount": "100.00",
    "netAmount": "93.00",
    "status": "pending"
  }'
```

#### Process the Payment

The payment processor should automatically:
1. Look up creator's Stripe account ID
2. Verify account is ready for payouts
3. Create transfer via Stripe
4. Update payment status to "completed"

#### Verify Transfer

**In Stripe Dashboard:**
1. Go to: https://dashboard.stripe.com/test/balance/overview
2. Click **"Transfers"** tab
3. You should see the transfer to the connected account

**In Creator's Stripe Account:**
1. As the creator, access Stripe dashboard (via the dashboard link)
2. You should see the incoming transfer
3. Balance should reflect the payment amount

---

### Part 5: Test Upgrade Flow (Existing E-Transfer)

This tests upgrading old e-transfer payment methods without Stripe.

#### Create Old-Style Payment Method

Manually insert a payment method without `stripe_account_id`:

```sql
INSERT INTO payment_settings (
  id,
  user_id,
  payout_method,
  payout_email,
  is_default,
  created_at,
  updated_at
) VALUES (
  'pm_test_123',
  'creator_user_id',
  'etransfer',
  'oldmethod@test.com',
  false,
  NOW(),
  NOW()
);
```

#### Test Upgrade Button

1. Go to **Settings** → **Payment Settings**
2. You should see the payment method with:
   - Yellow warning banner
   - "Setup Required" badge
   - "Complete Setup" button
3. Click **"Complete Setup"**
4. Follow the same onboarding flow as above
5. The `stripe_account_id` will be added to the existing record

---

### Part 6: Error Scenarios

#### Test Incomplete Onboarding

1. Start the e-transfer setup flow
2. When redirected to Stripe, **close the tab** or click **"Back"**
3. You'll return to: `http://localhost:5000/settings/payment?stripe_onboarding=refresh`
4. Should see error toast: "Setup Incomplete"
5. Payment method still exists but shows warning banner
6. Click "Complete Setup" to retry

#### Test Account Status with Pending Requirements

If Stripe requires additional verification:

```bash
# Check account status
curl -X GET "http://localhost:5000/api/stripe-connect/account-status/acct_xxx" \
  -H "Cookie: connect.sid=$SESSION_TOKEN"
```

Response will include:
```json
{
  "success": true,
  "detailsSubmitted": false,
  "payoutsEnabled": false,
  "requirements": ["individual.verification.document", "individual.id_number"]
}
```

#### Test Transfer to Non-Onboarded Account

1. Create payment for creator without completed onboarding
2. Attempt to process payment
3. Should fail with error: "Creator has not connected their Stripe account"

#### Test Insufficient Platform Balance

1. Process a payment larger than your test balance
2. Should fail with error: "Insufficient balance in platform Stripe account"

#### Test Transfer Below Minimum

1. Create payment for $0.50 CAD (below $1.00 minimum)
2. Should fail with error: "Transfer amount below minimum"

---

### Part 7: Test Dashboard Access

#### Generate Dashboard Link

```bash
curl -X POST "http://localhost:5000/api/stripe-connect/dashboard-link" \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=$SESSION_TOKEN" \
  -d '{
    "accountId": "acct_xxxxxxxxxxxxx"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "url": "https://connect.stripe.com/express/acct_xxxxx/..."
}
```

Open the URL to access the creator's Stripe Express dashboard.

---

## Automated Testing Checklist

- [ ] Creator can add e-transfer payment method
- [ ] Stripe account is created automatically
- [ ] Onboarding redirect works
- [ ] Creator completes Stripe onboarding
- [ ] Return URL works (`?stripe_onboarding=success`)
- [ ] Success toast appears
- [ ] Payment method shows as active (no warning)
- [ ] `stripe_account_id` is saved in database
- [ ] Account status API returns correct data
- [ ] Platform can create transfers to connected account
- [ ] Transfers appear in Stripe dashboard
- [ ] Upgrade flow works for existing payment methods
- [ ] Incomplete onboarding shows error message
- [ ] Dashboard link generation works
- [ ] Error handling for failed transfers

---

## Common Test Issues

### Issue: "Stripe credentials not configured"

**Solution:**
```bash
# Check .env file
cat .env | grep STRIPE_SECRET_KEY

# Should output: STRIPE_SECRET_KEY=sk_test_...
# If empty, add your test key
```

### Issue: Database error "column stripe_account_id does not exist"

**Solution:**
```bash
# Run migration
npm run migrate:stripe-connect

# Or manually:
psql $DATABASE_URL -f db/migrations/013_add_stripe_connect_account_id.sql
```

### Issue: Redirect not working after onboarding

**Check:**
1. Ensure `BASE_URL` in `.env` matches your development URL
2. Check browser console for errors
3. Verify URL params: `?stripe_onboarding=success` or `refresh`

### Issue: "Unauthorized" when accessing API

**Solution:**
- Ensure you're logged in
- Check session cookie is present
- Try logging out and back in

### Issue: Transfer fails with "account_invalid"

**Possible Causes:**
1. Onboarding not completed (`detailsSubmitted: false`)
2. Payouts not enabled (`payoutsEnabled: false`)
3. Account has pending requirements

**Check:**
```bash
# Get account status
curl -X GET "http://localhost:5000/api/stripe-connect/account-status/acct_xxx"
```

---

## Integration Testing Script

Save as `test-stripe-onboarding.sh`:

```bash
#!/bin/bash

# Test Stripe Connect Onboarding Flow

BASE_URL="http://localhost:5000"
SESSION_TOKEN="your-session-token"

echo "=== Testing Stripe Connect Onboarding ==="

# 1. Create Stripe account
echo "1. Creating Stripe Connect account..."
ACCOUNT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/stripe-connect/create-account" \
  -H "Cookie: connect.sid=$SESSION_TOKEN")

ACCOUNT_ID=$(echo $ACCOUNT_RESPONSE | jq -r '.accountId')
echo "   Account ID: $ACCOUNT_ID"

# 2. Generate onboarding link
echo "2. Generating onboarding link..."
ONBOARDING_RESPONSE=$(curl -s -X POST "$BASE_URL/api/stripe-connect/onboarding-link" \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=$SESSION_TOKEN" \
  -d "{
    \"accountId\": \"$ACCOUNT_ID\",
    \"returnUrl\": \"$BASE_URL/settings/payment?stripe_onboarding=success\",
    \"refreshUrl\": \"$BASE_URL/settings/payment?stripe_onboarding=refresh\"
  }")

ONBOARDING_URL=$(echo $ONBOARDING_RESPONSE | jq -r '.url')
echo "   Onboarding URL: $ONBOARDING_URL"

# 3. Check account status
echo "3. Checking account status..."
STATUS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/stripe-connect/account-status/$ACCOUNT_ID" \
  -H "Cookie: connect.sid=$SESSION_TOKEN")

echo "   Status: $STATUS_RESPONSE" | jq '.'

# 4. Generate dashboard link
echo "4. Generating dashboard link..."
DASHBOARD_RESPONSE=$(curl -s -X POST "$BASE_URL/api/stripe-connect/dashboard-link" \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=$SESSION_TOKEN" \
  -d "{\"accountId\": \"$ACCOUNT_ID\"}")

DASHBOARD_URL=$(echo $DASHBOARD_RESPONSE | jq -r '.url')
echo "   Dashboard URL: $DASHBOARD_URL"

echo "=== Test Complete ==="
```

Run with:
```bash
chmod +x test-stripe-onboarding.sh
./test-stripe-onboarding.sh
```

---

## Next Steps

After successful testing:

1. **Production Setup:**
   - Switch to live API keys (`sk_live_...`)
   - Update `BASE_URL` to production domain
   - Test with real bank accounts (small amounts)

2. **Monitoring:**
   - Set up webhook listeners for Stripe events
   - Monitor transfer failures
   - Track onboarding completion rates

3. **User Experience:**
   - Add email notifications for completed onboarding
   - Show onboarding progress indicators
   - Add help tooltips for common issues

4. **Documentation:**
   - Update user-facing help docs
   - Create video tutorials
   - Add FAQ section

---

**Happy Testing!** 🎉
