# Stripe Connect Setup Guide

This guide explains how to set up Stripe Connect for processing e-transfer payments using connected accounts.

## Table of Contents

- [What is Stripe Connect?](#what-is-stripe-connect)
- [Why Use Stripe Connect?](#why-use-stripe-connect)
- [Setup Steps](#setup-steps)
- [Database Migration](#database-migration)
- [Environment Variables](#environment-variables)
- [Frontend Integration](#frontend-integration)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

## What is Stripe Connect?

Stripe Connect allows platforms to facilitate payments between multiple parties. In our case:

1. **Platform (AffiliateXchange)** - Manages the marketplace and holds funds
2. **Creators** - Connect their own Stripe accounts to receive payouts

### Payment Flow

```
Company pays → Platform Stripe Account → Transfer → Creator's Stripe Account → Creator's Bank Account
```

This is different from the previous approach where the platform tried to payout directly to creator emails, which had permission and balance issues.

## Why Use Stripe Connect?

### Previous Issues (Direct Payouts)
- ❌ Required extensive API permissions
- ❌ Platform needed to hold all funds
- ❌ Complex compliance requirements
- ❌ "Insufficient balance" errors
- ❌ No creator control over payouts

### Benefits of Stripe Connect
- ✅ Stripe handles KYC/compliance for creators
- ✅ Creators manage their own payout schedules
- ✅ Better permission model (no special API access needed)
- ✅ Creators can see their earnings in Stripe dashboard
- ✅ Reduced platform liability
- ✅ Supports international payouts (not just CAD)

## Setup Steps

### 1. Enable Stripe Connect in Your Stripe Account

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Connect** → **Settings**
3. Enable **Express accounts** (recommended for most platforms)
4. Configure your branding (logo, colors, etc.)

### 2. Get Your Stripe API Keys

You need API keys with Connect permissions:

1. Go to **Developers** → **API keys**
2. Copy your **Secret key** (starts with `sk_test_` for test mode or `sk_live_` for production)
3. Ensure the key has **read_write** permissions (default for Secret keys)

**Note:** Standard Secret keys automatically have Connect permissions. The previous error occurred because the code was trying to access account management endpoints that aren't needed with the new implementation.

### 3. Set Environment Variables

Add to your `.env` file:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_secret_key_here

# Your application's base URL (for redirect URLs)
BASE_URL=http://localhost:5000
# For production: BASE_URL=https://yourdomain.com
```

### 4. Run Database Migration

Add the new `stripeAccountId` field to the `payment_settings` table:

```sql
ALTER TABLE payment_settings
ADD COLUMN stripe_account_id VARCHAR(255);

-- Add index for faster lookups
CREATE INDEX idx_payment_settings_stripe_account
ON payment_settings(stripe_account_id);
```

Or if using Drizzle migrations:

```bash
npm run db:generate
npm run db:migrate
```

## Database Migration

The schema has been updated in `shared/schema.ts`:

```typescript
export const paymentSettings = pgTable("payment_settings", {
  // ... existing fields ...
  stripeAccountId: varchar("stripe_account_id"), // NEW FIELD
  // ... rest of fields ...
});
```

### Manual Migration SQL

```sql
-- Add the column
ALTER TABLE payment_settings
ADD COLUMN IF NOT EXISTS stripe_account_id VARCHAR(255);

-- Add index
CREATE INDEX IF NOT EXISTS idx_payment_settings_stripe_account
ON payment_settings(stripe_account_id);

-- Verify the change
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'payment_settings'
  AND column_name = 'stripe_account_id';
```

## Environment Variables

Required environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `STRIPE_SECRET_KEY` | Your Stripe secret API key | `sk_test_...` or `sk_live_...` |
| `BASE_URL` | Your application's base URL | `http://localhost:5000` or `https://yourdomain.com` |

Optional variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `STRIPE_WEBHOOK_SECRET` | For webhook verification | None (for future webhook implementation) |

## Frontend Integration

### 1. Creator E-Transfer Setup Flow

When a creator wants to add e-transfer as a payment method:

```javascript
// Step 1: Create a Stripe Connect account
const createStripeAccount = async () => {
  const response = await fetch('/api/stripe-connect/create-account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  const data = await response.json();
  return data.accountId;
};

// Step 2: Get onboarding link
const getOnboardingLink = async (accountId) => {
  const response = await fetch('/api/stripe-connect/onboarding-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId,
      returnUrl: window.location.origin + '/settings/payment?stripe_onboarding=success',
      refreshUrl: window.location.origin + '/settings/payment?stripe_onboarding=refresh',
    }),
  });

  const data = await response.json();
  return data.url;
};

// Step 3: Save payment settings with Stripe account ID
const savePaymentSettings = async (accountId, email) => {
  await fetch('/api/payment-settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payoutMethod: 'etransfer',
      payoutEmail: email,
      stripeAccountId: accountId,
      isDefault: true,
    }),
  });
};

// Complete flow
const setupETransfer = async (email) => {
  try {
    // Create account
    const accountId = await createStripeAccount();

    // Save settings first (so we can track the account)
    await savePaymentSettings(accountId, email);

    // Get onboarding link and redirect
    const onboardingUrl = await getOnboardingLink(accountId);
    window.location.href = onboardingUrl;
  } catch (error) {
    console.error('Setup failed:', error);
  }
};
```

### 2. Check Account Status

```javascript
const checkAccountStatus = async (accountId) => {
  const response = await fetch(`/api/stripe-connect/account-status/${accountId}`);
  const data = await response.json();

  return {
    isReady: data.payoutsEnabled && data.detailsSubmitted,
    needsOnboarding: !data.detailsSubmitted,
    pendingRequirements: data.requirements || [],
  };
};
```

### 3. Access Stripe Dashboard

Allow creators to access their Stripe Express dashboard:

```javascript
const openStripeDashboard = async (accountId) => {
  const response = await fetch('/api/stripe-connect/dashboard-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId }),
  });

  const data = await response.json();
  window.open(data.url, '_blank');
};
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/stripe-connect/create-account` | POST | Creates a new Stripe Connect account for the user |
| `/api/stripe-connect/onboarding-link` | POST | Generates an onboarding URL for completing account setup |
| `/api/stripe-connect/account-status/:accountId` | GET | Checks if account is fully onboarded |
| `/api/stripe-connect/dashboard-link` | POST | Creates a login link to Stripe Express dashboard |

## Testing

### Test Mode Setup

1. **Use Test API Keys**
   ```bash
   STRIPE_SECRET_KEY=sk_test_...
   ```

2. **Create Test Connected Account**
   ```bash
   curl -X POST http://localhost:5000/api/stripe-connect/create-account \
     -H "Authorization: Bearer YOUR_SESSION_TOKEN"
   ```

3. **Complete Test Onboarding**
   - Use test phone numbers: `+1 000-000-0000`
   - Use test SSN: `000-00-0000`
   - Use test bank account: Routing `110000000`, Account `000123456789`

4. **Fund Your Test Platform Account**
   ```bash
   # In Stripe Dashboard → Balance → Add funds (test mode only)
   ```

5. **Test a Transfer**
   - Create a payment for $1.00 or more (Stripe minimum)
   - Mark payment as completed
   - Check creator's connected account balance in Stripe Dashboard

### Test Amounts

Stripe requires minimum amounts for transfers:

| Currency | Minimum Amount |
|----------|---------------|
| CAD | $1.00 |
| USD | $1.00 |
| EUR | €1.00 |

**Note:** The original $0.01 test amount will fail. Use at least $1.00 for testing.

### Verify Transfer Success

1. **Platform Side:**
   - Go to Stripe Dashboard → Balance → **Transfers**
   - You should see the transfer to the connected account

2. **Creator Side:**
   - Creator logs into their Stripe Express dashboard
   - They should see the incoming transfer
   - They can then payout to their bank account on their own schedule

## Troubleshooting

### "Creator has not connected their Stripe account"

**Cause:** The creator hasn't completed Stripe onboarding.

**Solution:**
1. Check if `stripeAccountId` is saved in their payment settings
2. If yes, check account status: `/api/stripe-connect/account-status/:accountId`
3. If `payoutsEnabled: false`, send creator to complete onboarding
4. Generate new onboarding link: `/api/stripe-connect/onboarding-link`

### "Insufficient balance in platform Stripe account"

**Cause:** Your platform Stripe account doesn't have enough balance for the transfer.

**Solution:**
1. **Test Mode:** Add test funds in Stripe Dashboard
2. **Production:** Ensure you're collecting payments from companies first, or manually add funds via bank transfer

### "Stripe API key does not have required permissions"

**Cause:** Using a restricted API key.

**Solution:**
1. Use a standard Secret Key (not Restricted Key)
2. Verify in Stripe Dashboard → Developers → API keys
3. Secret keys automatically have Connect permissions

### "Transfer amount too small"

**Cause:** Attempting to transfer less than Stripe's minimum ($1.00).

**Solution:**
- Use amounts ≥ $1.00 CAD for transfers
- Consider batching small payments into larger transfers

### "Account not yet enabled for payouts"

**Cause:** Creator hasn't completed required onboarding information.

**Solution:**
1. Check account requirements: `/api/stripe-connect/account-status/:accountId`
2. Review `requirements.currently_due` array
3. Send creator to complete onboarding with a fresh account link

## Production Checklist

Before going live:

- [ ] Switch to live Stripe API keys (`sk_live_...`)
- [ ] Update `BASE_URL` to production domain
- [ ] Test full flow with real bank accounts (use small amounts)
- [ ] Set up Stripe webhook endpoint for `account.updated` events (future enhancement)
- [ ] Configure email notifications for failed transfers
- [ ] Add monitoring for transfer failures
- [ ] Review Stripe Connect pricing in your Stripe Dashboard
- [ ] Test payout schedule for creators
- [ ] Verify tax form collection (if required in your jurisdiction)

## Additional Resources

- [Stripe Connect Documentation](https://stripe.com/docs/connect)
- [Express Accounts Guide](https://stripe.com/docs/connect/express-accounts)
- [Transfers API Reference](https://stripe.com/docs/api/transfers)
- [Testing Connect](https://stripe.com/docs/connect/testing)

## Support

For issues or questions:
1. Check Stripe Dashboard logs: **Developers** → **Logs**
2. Review server logs for detailed error messages
3. Consult Stripe's extensive documentation
4. Contact Stripe support (they're very responsive!)
