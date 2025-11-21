# Payment Sandbox Mode

## Overview

Payment Sandbox Mode allows you to test the complete payment flow without making real transactions or requiring fully verified payment accounts. This is essential for development, testing, and debugging payment-related features.

## How It Works

When sandbox mode is enabled:

1. **E-Transfer/Stripe Payments**:
   - Account verification checks return successful mock responses
   - Transfer creation simulates success without calling Stripe API
   - Mock transaction IDs are generated (format: `sandbox_tr_[timestamp]_[random]`)
   - No real money is transferred

2. **Payment Flow**:
   - All payment records are still created in the database
   - Payment status updates work normally
   - Notifications are sent as usual
   - Only the actual API calls to payment providers are mocked

3. **Logging**:
   - Sandbox mode operations are clearly marked with 🏖️ emoji in logs
   - All simulated transactions include warnings that no real money was transferred

## Enabling Sandbox Mode

### Step 1: Update Environment Variables

Add to your `.env` file:

```env
PAYMENT_SANDBOX_MODE=true
```

### Step 2: Restart Your Server

After updating `.env`, restart your development server:

```bash
npm run dev
```

### Step 3: Verify Sandbox Mode is Active

When processing payments, you should see log messages like:

```
[Payment Processor] 🏖️ SANDBOX MODE ENABLED - Payments will be simulated without real transactions
[Stripe Connect] 🏖️ SANDBOX MODE: Simulating successful account status for acct_xxx
[Stripe Connect] 🏖️ SANDBOX MODE: Simulating successful transfer sandbox_tr_xxx for $83.67 CAD
[Stripe Connect] 🏖️ SANDBOX MODE: No actual money transferred. This is a test transaction.
```

## When to Use Sandbox Mode

### ✅ Use Sandbox Mode For:

- **Local Development**: Testing payment features without real accounts
- **Integration Testing**: Verifying payment flow logic
- **UI/UX Testing**: Testing payment-related UI components
- **Debugging**: Investigating payment-related issues
- **Demo Environments**: Showcasing payment features without real transactions

### ❌ Don't Use Sandbox Mode For:

- **Production**: Always disable in production environments
- **Real Testing**: When you need to verify actual payment provider integration
- **Financial Audits**: When tracking real money movement

## Configuration Examples

### Development Environment

```env
# .env.development
NODE_ENV=development
PAYMENT_SANDBOX_MODE=true
STRIPE_SECRET_KEY=sk_test_... # Test keys are fine in sandbox mode
```

### Staging Environment (Testing Real APIs)

```env
# .env.staging
NODE_ENV=staging
PAYMENT_SANDBOX_MODE=false # Test with real Stripe test accounts
STRIPE_SECRET_KEY=sk_test_... # Use real test keys
```

### Production Environment

```env
# .env.production
NODE_ENV=production
PAYMENT_SANDBOX_MODE=false # NEVER enable in production
STRIPE_SECRET_KEY=sk_live_... # Use live keys
```

## Resolving the "Payouts Not Enabled" Error

If you encounter this error during development:

```
[E-Transfer] ERROR: Account acct_xxx payouts not enabled.
Requirements: ["individual.verification.document", ...]
```

**Solution**: Enable sandbox mode instead of completing real Stripe verification.

### Before (Without Sandbox Mode):
- ❌ Required completing Stripe identity verification
- ❌ Required uploading documents
- ❌ Could take hours/days for verification
- ❌ Not suitable for rapid development

### After (With Sandbox Mode):
- ✅ Instant testing without verification
- ✅ No document uploads required
- ✅ Immediate payment flow testing
- ✅ Perfect for development iterations

## Technical Details

### Files Modified

1. **`.env.example`**: Added `PAYMENT_SANDBOX_MODE` variable
2. **`server/stripeConnectService.ts`**:
   - Added `isSandboxMode()` helper function
   - Modified `checkAccountStatus()` to return mock success in sandbox mode
   - Modified `createTransfer()` to simulate transfers in sandbox mode
3. **`server/paymentProcessor.ts`**:
   - Added `isSandboxMode()` helper function
   - Added sandbox mode logging to payment methods

### Sandbox Mode Detection

```typescript
function isSandboxMode(): boolean {
  return process.env.PAYMENT_SANDBOX_MODE === 'true';
}
```

### Mock Data Examples

**Mock Account Status:**
```typescript
{
  success: true,
  detailsSubmitted: true,
  chargesEnabled: true,
  payoutsEnabled: true,
  requirements: [],
}
```

**Mock Transfer ID:**
```
sandbox_tr_1700000000000_abc123xyz
```

## Testing Payment Flows

### Example Test Scenario

1. **Setup**:
   ```bash
   echo "PAYMENT_SANDBOX_MODE=true" >> .env
   npm run dev
   ```

2. **Create Test Payment**:
   - Navigate to a completed offer
   - Process the affiliate payment
   - Watch the logs for sandbox indicators

3. **Verify Results**:
   - Payment status should update to "completed"
   - Transaction ID should start with `sandbox_tr_`
   - No real Stripe API calls should be made
   - Database records should be created normally

## Frequently Asked Questions

### Q: Will sandbox mode affect my real Stripe account?
**A:** No, sandbox mode prevents all real Stripe API calls.

### Q: Can I use sandbox mode with real Stripe accounts?
**A:** Yes, but it's unnecessary. Sandbox mode is designed to work even without properly configured Stripe accounts.

### Q: Does sandbox mode work for PayPal?
**A:** PayPal has its own sandbox via `PAYPAL_MODE=sandbox`. The `PAYMENT_SANDBOX_MODE` primarily affects Stripe/e-transfer functionality.

### Q: How do I disable sandbox mode?
**A:** Set `PAYMENT_SANDBOX_MODE=false` or remove the variable from `.env`, then restart your server.

### Q: Will notifications still be sent in sandbox mode?
**A:** Yes, email notifications and other non-payment operations work normally.

## Troubleshooting

### Sandbox Mode Not Working

1. **Check environment variable**:
   ```bash
   grep PAYMENT_SANDBOX_MODE .env
   ```
   Should return: `PAYMENT_SANDBOX_MODE=true`

2. **Restart server**:
   ```bash
   # Kill existing process
   # Restart dev server
   npm run dev
   ```

3. **Verify logs**:
   Look for 🏖️ emoji in payment-related logs

### Still Getting Stripe Errors

If you still see Stripe API errors:
- Ensure server was restarted after adding environment variable
- Check that variable name is exactly `PAYMENT_SANDBOX_MODE` (case-sensitive)
- Verify value is string `"true"`, not boolean

## Best Practices

1. **Always Use in Development**: Enable sandbox mode for local development
2. **Document When Disabled**: If testing real APIs, document why sandbox mode is disabled
3. **Never Commit Enabled**: Don't commit `.env` with sandbox mode enabled
4. **Clear Indicators**: Always check logs to confirm sandbox mode status
5. **Test Both Modes**: Test with sandbox ON and OFF before deploying

## Support

If you encounter issues with sandbox mode:
1. Check this documentation
2. Verify environment variables
3. Check server logs for sandbox indicators
4. Review the modified files listed above
