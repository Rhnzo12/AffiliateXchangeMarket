# Stripe Connect Onboarding - User Guide

This guide explains how creators set up Stripe Connect to receive e-transfer payments on AffiliateXchange.

## For Creators: How to Set Up E-Transfer Payments

### Why Stripe Connect?

Stripe Connect allows you to:
- ✅ Receive payments directly to your own Stripe account
- ✅ Control your own payout schedule (instant, daily, weekly, or monthly)
- ✅ View all earnings and transfers in your Stripe dashboard
- ✅ Get paid via e-transfer to your Canadian bank account
- ✅ Receive international payments (not just CAD)
- ✅ Track your payment history and tax documents in one place

### Step-by-Step Setup Process

#### 1. Add E-Transfer Payment Method

1. Navigate to **Settings** → **Payment Settings**
2. Click **"Add Payment Method"**
3. Select **"E-Transfer"** from the dropdown
4. Enter your email address for e-transfer notifications
5. Click **"Add Payment Method"**

#### 2. Automatic Stripe Account Creation

When you click "Add Payment Method":
- AffiliateXchange automatically creates a Stripe Connect account for you
- Your account is linked to your user profile
- You'll be redirected to Stripe's secure onboarding page

#### 3. Complete Stripe Onboarding

You'll be taken to Stripe's onboarding page where you need to provide:

**Personal Information:**
- Full legal name
- Date of birth
- Phone number
- Home address

**Business Information** (if applicable):
- Business type (Individual, Company, etc.)
- Business description

**Banking Details:**
- Bank account number for receiving payouts
- Routing/transit number
- Bank account type (checking/savings)

**Identity Verification:**
- Government-issued ID (driver's license, passport, etc.)
- Tax information (SIN for Canada, SSN for US)

**Important Notes:**
- All information is collected and stored securely by Stripe, not AffiliateXchange
- Stripe uses this information for KYC (Know Your Customer) compliance
- This is a one-time setup process

#### 4. Complete Setup & Return

After completing all required information:
- Click **"Submit"** on Stripe's onboarding page
- You'll be automatically redirected back to AffiliateXchange
- You'll see a success message: "Stripe Connect onboarding completed!"
- Your e-transfer payment method is now active

### Using Your Stripe Account

#### View Payment Status

Go to **Settings** → **Payment Settings** to see:
- Your active e-transfer payment method
- Stripe account status (active/pending)
- Recent payments received

#### Access Your Stripe Dashboard

1. Go to **Settings** → **Payment Settings**
2. Find your e-transfer payment method
3. Click **"View Stripe Dashboard"** (if available)
4. You'll be taken to your Stripe Express dashboard

In your Stripe dashboard you can:
- View all incoming payments from AffiliateXchange
- Manage payout schedules
- Update banking information
- Download tax documents
- View transaction history

#### Manage Payout Schedule

In your Stripe Express dashboard:
1. Go to **Settings** → **Payouts**
2. Choose your payout schedule:
   - **Manual** - You control when to transfer to your bank (default)
   - **Daily** - Automatic daily payouts
   - **Weekly** - Automatic weekly payouts
   - **Monthly** - Automatic monthly payouts

### How Payments Work

#### Payment Flow

```
1. Company approves your conversion
   ↓
2. AffiliateXchange calculates your earnings:
   - Gross Amount: Full commission
   - Platform Fee: 4%
   - Processing Fee: 3%
   - Net Amount: 93% to you
   ↓
3. Payment appears as "Pending" in your dashboard
   ↓
4. Admin approves payment
   ↓
5. Funds transferred to your Stripe account
   ↓
6. You receive payout to your bank account
```

#### Example Payment

```
Conversion Value: $1,000.00
Commission Rate: 10%
Gross Commission: $100.00

Fee Breakdown:
- Gross Amount:      $100.00 (100%)
- Platform Fee (4%):  -$4.00
- Stripe Fee (3%):    -$3.00
- Net to You (93%):   $93.00
```

#### Minimum Payment Amounts

Stripe requires minimum transfer amounts:
- **CAD:** $1.00 minimum
- **USD:** $1.00 minimum
- **EUR:** €1.00 minimum

Small payments may be batched until they meet the minimum threshold.

### Troubleshooting

#### "Setup Required" Warning

If you see a yellow warning banner on your payment method:
- Your Stripe account setup is incomplete
- Click **"Complete Setup"** to continue onboarding
- You'll be taken back to Stripe to finish verification

#### Payments Not Arriving

If you're not receiving payments:

1. **Check Stripe account status:**
   - Go to your Stripe Express dashboard
   - Ensure "Payouts Enabled" is active
   - Complete any outstanding verification requirements

2. **Check payment status in AffiliateXchange:**
   - Go to **Payment Settings** → **Overview**
   - Look for payment status (pending/processing/completed)
   - Contact support if payment is stuck

3. **Check bank account details:**
   - Verify your banking information in Stripe is correct
   - Ensure your bank account accepts e-transfers
   - Check with your bank for any holds

#### Need to Update Information

To update your Stripe account information:
1. Go to **Settings** → **Payment Settings**
2. Click **"View Stripe Dashboard"**
3. Update your information in Stripe's interface
4. Changes are automatically synced

#### Upgrading Existing E-Transfer Methods

If you created an e-transfer payment method before Stripe Connect:
1. You'll see a yellow banner: "Stripe Connect setup required"
2. Click **"Complete Setup"**
3. Follow the onboarding process to upgrade
4. Your existing email and settings will be preserved

### Security & Privacy

#### Your Information is Safe

- ✅ Stripe is PCI-DSS Level 1 certified (highest security standard)
- ✅ Bank account information is encrypted and stored by Stripe, not AffiliateXchange
- ✅ AffiliateXchange only stores your Stripe account ID (e.g., `acct_xxx`)
- ✅ Two-factor authentication available on Stripe accounts
- ✅ Stripe is used by millions of businesses worldwide

#### What AffiliateXchange Can See

We can only see:
- Your Stripe account ID
- Whether your account is active
- Transfer amounts and dates
- Payout status (pending/completed/failed)

We **cannot** see:
- Your bank account number
- Your personal identification documents
- Your tax information
- Your withdrawal history within Stripe

### Testing (For Development)

If you're testing the platform in development mode:

**Test Onboarding Information:**
- Phone: `+1 000-000-0000`
- SSN/SIN: `000-00-0000`
- Bank Routing: `110000000`
- Bank Account: `000123456789`

**Test Transfers:**
- Use amounts ≥ $1.00 (Stripe minimum)
- Check your test Stripe dashboard to see incoming funds
- Test payouts won't actually transfer to bank accounts

### Getting Help

#### Support Resources

1. **Stripe Support:**
   - Visit: https://support.stripe.com
   - Email: support@stripe.com
   - 24/7 chat support available in Stripe dashboard

2. **AffiliateXchange Support:**
   - Contact: [Your support email]
   - For platform-specific payment questions

3. **Documentation:**
   - Stripe Connect: https://stripe.com/docs/connect
   - Express Accounts: https://stripe.com/docs/connect/express-accounts

#### Common Questions

**Q: How long does onboarding take?**
A: Usually 5-10 minutes. Identity verification is typically instant but may take up to 24 hours.

**Q: Can I use an existing Stripe account?**
A: No, a new Stripe Express account is created automatically. This ensures proper platform integration.

**Q: What if I don't have a Canadian bank account?**
A: Stripe Connect supports international accounts! Select your country during onboarding.

**Q: Are there any fees?**
A: AffiliateXchange charges a 4% platform fee and 3% processing fee. Stripe's transfer fees are covered by the platform.

**Q: How do I delete my payment method?**
A: Go to Payment Settings, find your payment method, and click the trash icon. This doesn't delete your Stripe account.

**Q: Can I have multiple payment methods?**
A: Yes! You can add e-transfer, PayPal, wire transfer, and crypto. Set one as your default.

**Q: What happens to my Stripe account if I leave the platform?**
A: Your Stripe Express account remains active and accessible to you. Any remaining balance can be withdrawn.

---

## For Administrators

### Managing Creator Stripe Accounts

#### View Account Status

Check creator Stripe account status via API:
```javascript
GET /api/stripe-connect/account-status/:accountId
```

Returns:
```json
{
  "success": true,
  "detailsSubmitted": true,
  "chargesEnabled": false,
  "payoutsEnabled": true,
  "requirements": []
}
```

#### Process Payments

Payments are processed automatically when you approve conversions. The system:
1. Verifies creator has completed Stripe onboarding
2. Checks platform Stripe balance
3. Creates transfer to creator's connected account
4. Records transfer ID in payment record

#### Handle Failed Transfers

If a transfer fails:
1. Check error in payment record's `providerResponse`
2. Common issues:
   - Insufficient platform balance
   - Creator account not fully onboarded
   - Amount below Stripe minimum ($1.00)
3. Resolve issue and retry payment

#### Platform Balance Management

Ensure adequate balance in platform Stripe account:
- **Test Mode:** Add test funds via Stripe Dashboard
- **Production:** Collect payments from companies first, or add funds via bank transfer

#### Monitoring

Monitor Stripe activity:
1. Go to Stripe Dashboard → **Connect** → **Accounts**
2. View all connected creator accounts
3. Check account statuses and verification levels
4. Review transfer history

---

## Quick Reference

### User Journey Summary

```
1. Creator adds e-transfer payment method
2. System creates Stripe Connect account
3. Creator completes Stripe onboarding (5-10 min)
4. Returns to AffiliateXchange
5. Payment method is now active
6. Creator earns commissions
7. Funds transferred to Stripe account
8. Creator receives payouts to bank account
```

### API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/stripe-connect/create-account` | Create connected account |
| `POST /api/stripe-connect/onboarding-link` | Generate onboarding URL |
| `GET /api/stripe-connect/account-status/:id` | Check account status |
| `POST /api/stripe-connect/dashboard-link` | Access Stripe dashboard |

### Environment Variables

```bash
STRIPE_SECRET_KEY=sk_test_... # or sk_live_...
BASE_URL=http://localhost:5000 # or production domain
```

---

**Last Updated:** November 2024
**Stripe API Version:** 2024-11-20.acacia
