# Stripe Connect Onboarding - Complete Implementation

## 📋 Overview

This implementation provides **complete Stripe Connect onboarding** for creators to receive e-transfer payments via their own Stripe accounts. The feature is **production-ready** and fully integrated into AffiliateXchange.

### Key Features

✅ **Automatic Stripe Account Creation** - Creates Express accounts for creators
✅ **Seamless Onboarding Flow** - Redirects to Stripe's hosted onboarding
✅ **Account Status Tracking** - Monitors onboarding completion and verification
✅ **Secure Transfers** - Processes payments via Stripe Connect transfers
✅ **Dashboard Access** - Creators can access their Stripe Express dashboard
✅ **Upgrade Support** - Converts existing e-transfer methods to use Stripe
✅ **Comprehensive Error Handling** - Handles all edge cases and failures

---

## 🏗️ Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    AffiliateXchange Platform                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Frontend (React)                                          │
│  └─ payment-settings.tsx                                   │
│     ├─ Add E-Transfer Payment Method                       │
│     ├─ Upgrade Existing Methods                            │
│     ├─ View Account Status                                 │
│     └─ Access Stripe Dashboard                             │
│                                                             │
│  Backend (Express)                                         │
│  └─ routes.ts                                              │
│     ├─ POST /api/stripe-connect/create-account            │
│     ├─ POST /api/stripe-connect/onboarding-link           │
│     ├─ GET  /api/stripe-connect/account-status/:id        │
│     └─ POST /api/stripe-connect/dashboard-link            │
│                                                             │
│  Services                                                  │
│  └─ stripeConnectService.ts                               │
│     ├─ createConnectedAccount()                           │
│     ├─ createAccountLink()                                │
│     ├─ checkAccountStatus()                               │
│     ├─ createTransfer()                                   │
│     └─ createLoginLink()                                  │
│                                                             │
│  Database                                                  │
│  └─ payment_settings                                      │
│     └─ stripe_account_id (VARCHAR)                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Stripe API
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Stripe Connect                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Express Accounts                                          │
│  ├─ Hosted Onboarding                                      │
│  ├─ KYC/Compliance                                         │
│  ├─ Identity Verification                                  │
│  └─ Bank Account Management                                │
│                                                             │
│  Transfers API                                             │
│  └─ Platform → Creator Transfers                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
1. Creator Action: Add E-Transfer
   ↓
2. Backend: Create Stripe Connect Account
   POST /api/stripe-connect/create-account
   ↓
3. Backend: Save stripe_account_id to Database
   INSERT INTO payment_settings
   ↓
4. Backend: Generate Onboarding URL
   POST /api/stripe-connect/onboarding-link
   ↓
5. Redirect: Send Creator to Stripe
   window.location.href = onboardingUrl
   ↓
6. Stripe: Creator Completes Onboarding
   - Personal Information
   - Banking Details
   - Identity Verification
   ↓
7. Redirect: Return to AffiliateXchange
   /settings/payment?stripe_onboarding=success
   ↓
8. Frontend: Show Success Message
   Toast: "Stripe Connect onboarding completed!"
   ↓
9. Payment Flow: Process Transfers
   createTransfer(accountId, amount, currency)
```

---

## 📁 File Structure

### Backend Files

```
server/
├── stripeConnectService.ts          # Core Stripe Connect service
├── routes.ts                         # API endpoints (lines 2468-2584)
├── paymentProcessor.ts               # Payment processing logic
└── storage.ts                        # Database operations

db/migrations/
└── 013_add_stripe_connect_account_id.sql  # Database migration

scripts/
└── run-migration-013.ts              # Migration runner
```

### Frontend Files

```
client/src/pages/
└── payment-settings.tsx              # Payment settings UI
    ├── Add E-Transfer Flow (lines 2174-2256)
    ├── Upgrade E-Transfer Flow (lines 2340-2392)
    ├── Onboarding Return Handler (lines 2129-2149)
    └── Payment Method Display (lines 379-451)
```

### Documentation Files

```
docs/
├── STRIPE_CONNECT_SETUP.md           # Developer setup guide
├── STRIPE_ONBOARDING_USER_GUIDE.md   # User-facing guide
├── STRIPE_ONBOARDING_TESTING.md      # Testing guide
└── STRIPE_ONBOARDING_README.md       # This file
```

---

## 🚀 Quick Start

### For Developers

#### 1. Install Dependencies

```bash
npm install stripe
```

#### 2. Configure Environment

Add to `.env`:
```bash
STRIPE_SECRET_KEY=sk_test_51...    # Get from Stripe Dashboard
BASE_URL=http://localhost:5000      # Your app URL
```

#### 3. Run Database Migration

```bash
npm run migrate:stripe-connect
```

Or manually:
```sql
ALTER TABLE payment_settings
ADD COLUMN IF NOT EXISTS stripe_account_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_payment_settings_stripe_account_id
ON payment_settings(stripe_account_id);
```

#### 4. Test the Flow

1. Start app: `npm run dev`
2. Create creator account
3. Go to Payment Settings
4. Add E-Transfer payment method
5. Complete Stripe onboarding
6. Verify success

### For Users (Creators)

1. **Navigate:** Settings → Payment Settings
2. **Add:** Click "Add Payment Method"
3. **Select:** Choose "E-Transfer"
4. **Enter:** Your email address
5. **Submit:** Click "Add Payment Method"
6. **Onboard:** Complete Stripe verification (5-10 min)
7. **Done:** Return to AffiliateXchange

---

## 🔧 API Reference

### Create Connected Account

**Endpoint:** `POST /api/stripe-connect/create-account`
**Auth:** Required (creator role)

**Response:**
```json
{
  "success": true,
  "accountId": "acct_1234567890abcdef"
}
```

**Errors:**
- `400` - Failed to create account
- `401` - Unauthorized
- `500` - Server error

---

### Generate Onboarding Link

**Endpoint:** `POST /api/stripe-connect/onboarding-link`
**Auth:** Required (account owner)

**Request Body:**
```json
{
  "accountId": "acct_1234567890abcdef",
  "returnUrl": "https://yoursite.com/settings/payment?stripe_onboarding=success",
  "refreshUrl": "https://yoursite.com/settings/payment?stripe_onboarding=refresh"
}
```

**Response:**
```json
{
  "success": true,
  "url": "https://connect.stripe.com/setup/s/..."
}
```

**Errors:**
- `400` - Missing accountId or invalid parameters
- `403` - Unauthorized (account doesn't belong to user)
- `500` - Failed to create link

---

### Check Account Status

**Endpoint:** `GET /api/stripe-connect/account-status/:accountId`
**Auth:** Required (account owner)

**Response:**
```json
{
  "success": true,
  "detailsSubmitted": true,
  "chargesEnabled": false,
  "payoutsEnabled": true,
  "requirements": []
}
```

**Status Fields:**
- `detailsSubmitted` - Onboarding completed
- `chargesEnabled` - Can accept payments (always false for our use case)
- `payoutsEnabled` - Can receive transfers
- `requirements` - Array of missing verification items

---

### Generate Dashboard Link

**Endpoint:** `POST /api/stripe-connect/dashboard-link`
**Auth:** Required (account owner)

**Request Body:**
```json
{
  "accountId": "acct_1234567890abcdef"
}
```

**Response:**
```json
{
  "success": true,
  "url": "https://connect.stripe.com/express/acct_.../dashboard"
}
```

**Usage:**
- Link expires after user accesses it
- Generate new link each time user wants to access dashboard
- Opens in new tab/window

---

## 💾 Database Schema

### payment_settings Table

```sql
CREATE TABLE payment_settings (
  id VARCHAR PRIMARY KEY,
  user_id VARCHAR NOT NULL REFERENCES users(id),
  payout_method payout_method_enum NOT NULL,  -- 'etransfer' | 'wire' | 'paypal' | 'crypto'
  payout_email VARCHAR,
  bank_routing_number VARCHAR,
  bank_account_number VARCHAR,
  paypal_email VARCHAR,
  crypto_wallet_address VARCHAR,
  crypto_network VARCHAR,
  stripe_account_id VARCHAR,                  -- NEW: Stripe Connect account ID
  tax_information JSONB,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_payment_settings_stripe_account_id
ON payment_settings(stripe_account_id);
```

### Example Record

```json
{
  "id": "pm_abc123",
  "user_id": "user_xyz789",
  "payout_method": "etransfer",
  "payout_email": "creator@example.com",
  "stripe_account_id": "acct_1234567890abcdef",
  "is_default": true,
  "created_at": "2024-11-20T10:00:00Z",
  "updated_at": "2024-11-20T10:05:00Z"
}
```

---

## 🔄 User Flows

### New E-Transfer Setup

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Creator clicks "Add Payment Method"                      │
└──────────────────────────────────────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. Selects "E-Transfer" and enters email                    │
└──────────────────────────────────────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. Frontend calls:                                           │
│    POST /api/stripe-connect/create-account                   │
│    Returns: { accountId: "acct_xxx" }                       │
└──────────────────────────────────────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. Frontend saves payment settings:                         │
│    POST /api/payment-settings                                │
│    Body: {                                                   │
│      payoutMethod: "etransfer",                             │
│      payoutEmail: "creator@example.com",                    │
│      stripeAccountId: "acct_xxx"                            │
│    }                                                         │
└──────────────────────────────────────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ 5. Frontend calls:                                           │
│    POST /api/stripe-connect/onboarding-link                  │
│    Returns: { url: "https://connect.stripe.com/..." }      │
└──────────────────────────────────────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ 6. Redirect to Stripe onboarding:                           │
│    window.location.href = onboardingUrl                     │
└──────────────────────────────────────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ 7. Creator completes Stripe onboarding                      │
│    - Personal info                                           │
│    - Banking details                                         │
│    - Identity verification                                   │
└──────────────────────────────────────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ 8. Stripe redirects back:                                   │
│    /settings/payment?stripe_onboarding=success              │
└──────────────────────────────────────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ 9. Frontend shows success toast                             │
│    Payment method is now active                             │
└──────────────────────────────────────────────────────────────┘
```

### Upgrade Existing E-Transfer

```
┌──────────────────────────────────────────────────────────────┐
│ Old E-Transfer Method (no stripe_account_id)                │
│ Shows: Yellow warning banner                                │
│ Button: "Complete Setup"                                    │
└──────────────────────────────────────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ Creator clicks "Complete Setup"                             │
└──────────────────────────────────────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ 1. Create Stripe account                                    │
│    POST /api/stripe-connect/create-account                   │
└──────────────────────────────────────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. Update existing payment settings:                        │
│    PUT /api/payment-settings/:id                             │
│    Body: { stripeAccountId: "acct_xxx" }                    │
└──────────────────────────────────────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. Get onboarding link and redirect                        │
│    (Same as steps 5-9 above)                                │
└──────────────────────────────────────────────────────────────┘
```

### Payment Processing Flow

```
┌──────────────────────────────────────────────────────────────┐
│ Admin approves payment                                      │
└──────────────────────────────────────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ PaymentProcessor.processPayment()                           │
│ 1. Look up creator's payment settings                       │
│ 2. Get stripe_account_id                                    │
└──────────────────────────────────────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ stripeConnectService.checkAccountStatus()                   │
│ Verify: payoutsEnabled === true                            │
└──────────────────────────────────────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ stripeConnectService.createTransfer()                       │
│ - Amount: netAmount (93% after fees)                       │
│ - Currency: CAD/USD/EUR                                     │
│ - Destination: stripe_account_id                            │
└──────────────────────────────────────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ Update payment record:                                      │
│ - status: "completed"                                       │
│ - stripe_transfer_id: "tr_xxx"                              │
│ - completed_at: NOW()                                       │
└──────────────────────────────────────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ Creator sees funds in Stripe dashboard                      │
│ Can withdraw to bank account on their schedule              │
└──────────────────────────────────────────────────────────────┘
```

---

## ⚠️ Error Handling

### Frontend Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Failed to create Stripe Connect account" | Backend API error | Retry, check logs |
| "Failed to create onboarding link" | Invalid accountId | Verify account exists |
| "Setup Incomplete" | User exited onboarding | Click "Complete Setup" to retry |
| "Unauthorized" | Session expired | Re-login |

### Backend Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Stripe credentials not configured" | Missing `STRIPE_SECRET_KEY` | Add to `.env` |
| "Creator has not connected their Stripe account" | Onboarding incomplete | Complete onboarding |
| "Insufficient balance in platform Stripe account" | Not enough funds | Add funds in Stripe Dashboard |
| "Transfer amount too small" | Below $1.00 minimum | Batch small payments |
| "Account not yet enabled for payouts" | Pending verification | Check `requirements` array |

### Stripe API Errors

| Error Code | Meaning | Fix |
|------------|---------|-----|
| `account_invalid` | Account doesn't exist or is disabled | Verify accountId, check Stripe Dashboard |
| `insufficient_funds` | Platform balance too low | Add funds to platform account |
| `transfer_declined` | Declined by bank | Contact Stripe support |
| `invalid_request_error` | Bad API request | Check request parameters |

---

## 🧪 Testing

### Test Mode Setup

1. **Get Test API Keys:**
   - Go to: https://dashboard.stripe.com/test/apikeys
   - Copy Secret Key: `sk_test_...`
   - Add to `.env`

2. **Use Test Data:**
   - Phone: `000-000-0000`
   - SSN: `000000000`
   - Bank Routing: `110000000`
   - Bank Account: `000123456789`

3. **Fund Test Account:**
   - Stripe Dashboard → Balance → Add funds

4. **Test Transfers:**
   - Use amounts ≥ $1.00 CAD
   - Verify in Stripe Dashboard

### Automated Tests

```bash
# Run integration tests
npm test -- stripe-connect

# Test specific flow
npm test -- stripe-onboarding-flow
```

### Manual Testing Checklist

- [ ] Creator can add e-transfer payment method
- [ ] Stripe account created automatically
- [ ] Onboarding redirect works
- [ ] Creator completes Stripe onboarding successfully
- [ ] Return URL works with success parameter
- [ ] Success toast appears
- [ ] Payment method shows as active
- [ ] Database has `stripe_account_id` saved
- [ ] Account status API returns correct data
- [ ] Platform can create transfers
- [ ] Transfers appear in both dashboards
- [ ] Upgrade flow works for old methods
- [ ] Error handling works (incomplete onboarding)
- [ ] Dashboard link generation works

---

## 🚢 Production Deployment

### Pre-Launch Checklist

#### 1. Stripe Configuration

- [ ] Switch to live API keys (`sk_live_...`)
- [ ] Enable Connect in Stripe Dashboard
- [ ] Configure branding (logo, colors)
- [ ] Set up webhook endpoints (future)
- [ ] Review pricing and fees

#### 2. Environment Variables

```bash
# Production .env
STRIPE_SECRET_KEY=sk_live_...
BASE_URL=https://yourdomain.com
NODE_ENV=production
```

#### 3. Database

- [ ] Run migration in production
- [ ] Verify schema matches
- [ ] Test database connectivity
- [ ] Set up backups

#### 4. Testing

- [ ] Test with real bank accounts (small amounts)
- [ ] Verify full onboarding flow
- [ ] Test transfers end-to-end
- [ ] Check error handling
- [ ] Test dashboard access

#### 5. Monitoring

- [ ] Set up error logging
- [ ] Monitor transfer failures
- [ ] Track onboarding completion rates
- [ ] Set up alerts for critical errors

#### 6. Documentation

- [ ] Update user-facing docs
- [ ] Create video tutorials
- [ ] Add FAQ section
- [ ] Train support staff

### Post-Launch Monitoring

**Key Metrics:**
- Onboarding completion rate
- Average onboarding time
- Transfer success rate
- Failed transfer reasons
- User satisfaction

**Error Monitoring:**
- Failed account creations
- Incomplete onboardings
- Transfer failures
- API errors

---

## 📚 Additional Resources

### Documentation

- [STRIPE_CONNECT_SETUP.md](./STRIPE_CONNECT_SETUP.md) - Developer setup guide
- [STRIPE_ONBOARDING_USER_GUIDE.md](./STRIPE_ONBOARDING_USER_GUIDE.md) - User guide
- [STRIPE_ONBOARDING_TESTING.md](./STRIPE_ONBOARDING_TESTING.md) - Testing guide

### Stripe Resources

- [Stripe Connect Docs](https://stripe.com/docs/connect)
- [Express Accounts](https://stripe.com/docs/connect/express-accounts)
- [Transfers API](https://stripe.com/docs/api/transfers)
- [Testing Connect](https://stripe.com/docs/connect/testing)

### Support

- **Stripe Support:** https://support.stripe.com (24/7 chat)
- **AffiliateXchange Support:** [Your contact email]

---

## 🎯 Summary

The Stripe Connect onboarding feature is **fully implemented** and **production-ready**. Key highlights:

✅ **Complete Implementation** - All endpoints, services, and UI components ready
✅ **Comprehensive Documentation** - Setup, user guide, and testing docs
✅ **Error Handling** - Handles all edge cases gracefully
✅ **Security** - Stripe handles sensitive data, not the platform
✅ **User Experience** - Seamless flow from signup to payout
✅ **Scalable** - Supports international creators and multiple currencies

**Next Steps:**
1. Review documentation
2. Test in development environment
3. Deploy to production
4. Monitor and iterate

---

**Version:** 1.0.0
**Last Updated:** November 2024
**Status:** Production Ready ✅
