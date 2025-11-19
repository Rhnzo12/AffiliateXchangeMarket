# Stripe Payment Setup - Complete Guide

## Understanding Your Current Payment System

Your payment management system is currently a **tracking and management platform** that:

✅ **What It Does:**
- Tracks payment records in the database
- Calculates fees (4% platform + 3% Stripe = 7%)
- Displays payment history to creators, companies, and admins
- Manages payment statuses (pending → processing → completed)
- Shows fee breakdowns in the UI

❌ **What It Doesn't Do (Yet):**
- Doesn't actually process payments through Stripe
- Doesn't charge credit cards
- Doesn't transfer money to creators
- Doesn't integrate with Stripe API

## Current Payment Flow

```
1. Company records conversion
   ↓
2. System calculates commission based on offer type
   ↓
3. System calculates fees:
   - Platform Fee: 4% of gross
   - Stripe Fee: 3% of gross (estimated)
   - Net: 93% to creator
   ↓
4. Payment record created in database (status: "pending")
   ↓
5. Admin can update status to "processing" → "completed"
   ↓
6. Data displays in payment management UI
```

**Important:** Currently, no actual money moves - it's a tracking system.

---

## Getting Stripe Test Keys (Free)

To get your Stripe credentials:

### Step 1: Create Stripe Account

1. Go to https://stripe.com
2. Click **"Start now"** (It's FREE for testing)
3. Sign up with your email
4. Verify your email

### Step 2: Get Test API Keys

1. Log in to https://dashboard.stripe.com
2. Make sure you're in **TEST MODE** (toggle in top right)
3. Click **"Developers"** in the left sidebar
4. Click **"API keys"**
5. You'll see:
   - **Publishable key** (starts with `pk_test_...`)
   - **Secret key** (starts with `sk_test_...`)

### Step 3: Update Your .env File

Replace the placeholder values in your `.env`:

```env
# Stripe Test Keys (Replace with your actual keys)
STRIPE_SECRET_KEY=sk_test_51abc123def456ghi789...
VITE_STRIPE_PUBLIC_KEY=pk_test_51abc123def456ghi789...

# Optional: Keep testing keys separate
TESTING_STRIPE_SECRET_KEY=sk_test_51abc123def456ghi789...
TESTING_VITE_STRIPE_PUBLIC_KEY=pk_test_51abc123def456ghi789...
```

**Where to find them:**
- `pk_test_...` = Publishable key (safe to use in frontend)
- `sk_test_...` = Secret key (NEVER share, server-side only)

---

## How to Make Payment System Work 100%

### Option 1: Keep Current System (Payment Tracking Only)

**What you have now:** A complete payment tracking and management system

**To make it work:**

1. ✅ Database is already set up
2. ✅ Payment calculations are working (4% + 3% = 7%)
3. ✅ UI displays all payment data
4. ✅ Status management works

**How to use it:**

```typescript
// When a conversion happens, create a payment record
POST /api/conversions/:applicationId
Body: { saleAmount: 1000 }

// This automatically:
// - Calculates commission
// - Calculates fees (4% platform + 3% Stripe)
// - Creates payment record with status "pending"
// - Shows in UI immediately
```

**Payment flow:**
1. Company records conversion → Payment created as "pending"
2. Admin reviews → Changes status to "processing"
3. You manually pay creator (bank transfer, PayPal, etc.)
4. Admin marks as "completed" → Creator sees payment in UI

**Pros:**
- ✅ Already working
- ✅ No Stripe integration needed
- ✅ Full tracking and reporting
- ✅ Handles multiple payout methods (etransfer, wire, PayPal, crypto)

**Cons:**
- ⚠️ Manual payment processing
- ⚠️ No automatic transfers

---

### Option 2: Add Full Stripe Integration (Automated Payments)

**What this adds:** Automatic payment processing through Stripe

**Requirements:**
1. Stripe account (with verification for real money)
2. Additional code to integrate Stripe API
3. Stripe Connect for marketplace payments

**What needs to be built:**

#### A. Server-Side Integration

Create `/server/stripe.ts`:

```typescript
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

// Create payment intent for creator payout
export async function createPayoutToCreator(paymentId: string) {
  const payment = await getPayment(paymentId);

  // Create transfer to creator
  const transfer = await stripe.transfers.create({
    amount: Math.round(parseFloat(payment.netAmount) * 100), // Convert to cents
    currency: 'usd',
    destination: payment.creatorStripeAccountId, // Creator's Stripe Connect account
    description: payment.description,
  });

  // Update payment record
  await updatePayment(paymentId, {
    stripeTransferId: transfer.id,
    status: 'completed',
  });
}
```

#### B. Creator Onboarding

Creators need Stripe Connect accounts:

```typescript
// Create connected account for creator
const account = await stripe.accounts.create({
  type: 'express',
  country: 'US',
  email: creator.email,
  capabilities: {
    transfers: { requested: true },
  },
});

// Generate onboarding link
const accountLink = await stripe.accountLinks.create({
  account: account.id,
  refresh_url: 'https://yourapp.com/reauth',
  return_url: 'https://yourapp.com/dashboard',
  type: 'account_onboarding',
});
```

#### C. Payment Processing Endpoint

```typescript
// POST /api/payments/:id/process
app.post('/api/payments/:id/process', requireAuth, requireRole('admin'), async (req, res) => {
  const { id } = req.params;

  try {
    await createPayoutToCreator(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**Complexity:** High - requires:
- Stripe Connect setup
- Creator account verification
- Webhook handling
- Error handling
- Compliance requirements

---

## Recommended Approach

### For Testing/MVP: Use Option 1 (Current System)

Your current system is **already working** and tracks everything properly:

1. **Get Stripe keys** (for future use):
   ```env
   STRIPE_SECRET_KEY=sk_test_51abc...
   VITE_STRIPE_PUBLIC_KEY=pk_test_51abc...
   ```

2. **Use the system as-is**:
   - Companies record conversions
   - System calculates fees automatically
   - Payments show as "pending"
   - Admin manually processes payments
   - Update status to "completed"

3. **Payment workflow:**
   ```
   Conversion → Automatic fee calculation → Database record →
   Admin approval → Manual payout → Status update → Shows in UI
   ```

### For Production: Upgrade to Option 2

When you're ready for automated payments:
1. Complete Stripe account verification
2. Implement Stripe Connect
3. Build payout automation
4. Add webhook handlers
5. Test with small amounts first

---

## Quick Start: Make Current System Work

### Step 1: Ensure Database Has Payment Table

Your `payments` table should have:
```sql
- gross_amount (total earned)
- platform_fee_amount (4%)
- stripe_fee_amount (3%)
- net_amount (93%)
- status (pending/processing/completed)
```

✅ **This already exists in your database!**

### Step 2: Test Payment Creation

```bash
# Start your server
npm run dev

# Record a test conversion (as company user)
# This creates a payment record automatically
curl -X POST http://localhost:3000/api/conversions/{applicationId} \
  -H "Content-Type: application/json" \
  -d '{"saleAmount": 1000}'
```

### Step 3: View in UI

1. Login as creator
2. Go to `/payment-settings`
3. See payment with:
   - Gross: $100.00 (10% of $1000 sale)
   - Platform Fee: $4.00 (4%)
   - Stripe Fee: $3.00 (3%)
   - Net: $93.00 (what creator receives)

### Step 4: Process Payment (Admin)

1. Login as admin
2. Go to `/payment-settings`
3. View all pending payments
4. Update status to "processing"
5. Manually send $93 to creator (via their chosen payout method)
6. Update status to "completed"

---

## Stripe Keys - What They're For

### Current System (No Stripe Integration)
```env
# These aren't used yet, but keep them for future
STRIPE_SECRET_KEY=sk_test_your_key
VITE_STRIPE_PUBLIC_KEY=pk_test_your_key
```

The Stripe keys are placeholders for future integration. Currently:
- ✅ System calculates **estimated** Stripe fees (3%)
- ❌ Doesn't actually use Stripe API
- ❌ Doesn't process real payments through Stripe

### With Full Integration (Future)
```env
# Used to create payment intents and transfers
STRIPE_SECRET_KEY=sk_test_51abc...

# Used in frontend for Stripe Elements (if needed)
VITE_STRIPE_PUBLIC_KEY=pk_test_51abc...
```

---

## Payment System Health Check

Run these checks to verify your system:

### ✅ Check 1: Database Tables Exist
```sql
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('payments', 'payment_settings', 'users', 'offers', 'applications');
```

Expected: All 5 tables exist

### ✅ Check 2: Payment Calculation is Correct
```javascript
const grossAmount = 100;
const platformFee = grossAmount * 0.04; // 4.00
const stripeFee = grossAmount * 0.03;   // 3.00
const netAmount = grossAmount * 0.93;   // 93.00

console.log({
  gross: grossAmount,
  platformFee,    // Should be 4.00
  stripeFee,      // Should be 3.00
  netAmount,      // Should be 93.00
  totalFees: platformFee + stripeFee // Should be 7.00
});
```

### ✅ Check 3: API Endpoints Work
```bash
# Get creator payments
curl http://localhost:3000/api/payments/creator \
  -H "Cookie: your-session-cookie"

# Get all payments (admin)
curl http://localhost:3000/api/payments/all \
  -H "Cookie: admin-session-cookie"
```

### ✅ Check 4: UI Displays Payment Data
1. Login to app
2. Navigate to `/payment-settings`
3. Verify payment history table shows
4. Check fee breakdown is displayed correctly

---

## Common Questions

### Q: Do I need Stripe keys to use the payment system?
**A:** No! The current system works without Stripe. It just tracks payments and calculates estimated fees.

### Q: How do I actually pay creators?
**A:** Currently manual:
1. See pending payments in admin dashboard
2. Use creator's payout method (etransfer, PayPal, wire, crypto)
3. Manually send money
4. Update payment status to "completed"

### Q: What if I want automatic payments?
**A:** You'll need to:
1. Get verified Stripe account
2. Implement Stripe Connect
3. Build payout automation
4. This is Option 2 above (complex)

### Q: Are the fee calculations accurate?
**A:** Yes! The 7% split (4% platform + 3% Stripe) is correctly calculated:
```
$1000 sale × 10% commission = $100 gross
$100 × 4% = $4 platform fee
$100 × 3% = $3 Stripe fee
$100 - $7 = $93 net to creator
```

### Q: Can I test payments without real money?
**A:** Yes! Use the tracking system:
1. Create test conversions
2. Watch payments appear in database
3. View in UI
4. Update statuses manually
5. No real money involved

---

## Next Steps

### Immediate (Today):
1. ✅ Your payment system is already working
2. ✅ Test by recording a conversion
3. ✅ View payment data in UI
4. ✅ Verify fee calculations are correct

### Short-term (This Week):
1. Get Stripe test keys (free, 5 minutes)
2. Add them to .env (future-proofing)
3. Test complete payment workflow
4. Document your manual payout process

### Long-term (When Ready):
1. Complete Stripe account verification
2. Implement Stripe Connect
3. Build automated payouts
4. Test with small amounts
5. Launch automated payments

---

## Support

**Your current system includes:**
- ✅ Complete payment tracking
- ✅ Accurate fee calculations (4% + 3% = 7%)
- ✅ Multi-role dashboards (creator/company/admin)
- ✅ Payment status management
- ✅ Multiple payout methods
- ✅ Full payment history
- ✅ Fee transparency

**To get Stripe test keys:**
1. https://stripe.com → Sign up (FREE)
2. https://dashboard.stripe.com/test/apikeys
3. Copy keys to .env
4. Done!

**The payment system works 100% for tracking.** Stripe integration is optional and only needed for automated processing.

---

**Last Updated:** 2025-11-02
**System Status:** ✅ Fully Functional (Tracking Mode)
**Stripe Status:** 🔄 Optional (For Automation)
