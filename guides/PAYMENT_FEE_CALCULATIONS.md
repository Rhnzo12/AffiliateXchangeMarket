# Payment Fee Calculation Implementation

## Fee Structure (Per Specification)

**Total Platform Fee: 7%**
- Platform Fee: 4%
- Stripe Processing Fee: 3%

## Implementation Location

**File:** `server/storage.ts` (Lines 1794-1810)
**Method:** `recordConversion(applicationId: string, saleAmount?: number)`

## Calculation Logic

```typescript
const platformFee = grossAmount * 0.04;  // 4% platform fee
const stripeFee = grossAmount * 0.03;     // 3% Stripe processing fee
const netAmount = grossAmount - platformFee - stripeFee;
```

## Test Examples

### Example 1: $100 Sale
- **Gross Amount:** $100.00
- **Platform Fee (4%):** $4.00
- **Stripe Fee (3%):** $3.00
- **Net Amount (93%):** $93.00

### Example 2: $500 Sale
- **Gross Amount:** $500.00
- **Platform Fee (4%):** $20.00
- **Stripe Fee (3%):** $15.00
- **Net Amount (93%):** $465.00

### Example 3: $1,000 Sale
- **Gross Amount:** $1,000.00
- **Platform Fee (4%):** $40.00
- **Stripe Fee (3%):** $30.00
- **Net Amount (93%):** $930.00

### Example 4: $50.75 Sale (with decimals)
- **Gross Amount:** $50.75
- **Platform Fee (4%):** $2.03
- **Stripe Fee (3%):** $1.52
- **Net Amount (93%):** $47.20

## Commission Type Examples

### Per Sale Commission (20% of $200 product)
- **Commission (Gross):** $40.00
- **Platform Fee (4%):** $1.60
- **Stripe Fee (3%):** $1.20
- **Creator Receives (Net):** $37.20
- **Company Pays:** $40.00

### Per Lead Commission ($15 per lead)
- **Commission (Gross):** $15.00
- **Platform Fee (4%):** $0.60
- **Stripe Fee (3%):** $0.45
- **Creator Receives (Net):** $13.95
- **Company Pays:** $15.00

### Per Click Commission ($0.50 per click)
- **Commission (Gross):** $0.50
- **Platform Fee (4%):** $0.02
- **Stripe Fee (3%):** $0.02
- **Creator Receives (Net):** $0.46
- **Company Pays:** $0.50

## Verification Formula

```
netAmount = grossAmount * 0.93
// OR
netAmount = grossAmount * (1 - 0.04 - 0.03)
// OR
netAmount = grossAmount - (grossAmount * 0.04) - (grossAmount * 0.03)
```

## Database Schema

**Table:** `payments`

```sql
payments {
  grossAmount         DECIMAL(10,2)  -- Total commission earned
  platformFeeAmount   DECIMAL(10,2)  -- 4% platform fee
  stripeFeeAmount     DECIMAL(10,2)  -- 3% Stripe fee
  netAmount          DECIMAL(10,2)  -- Amount creator receives (93%)
}
```

## Payment Flow

1. **Company reports conversion** → `POST /api/conversions/:applicationId?saleAmount=X`
2. **System calculates commission** based on offer's commission type and rate
3. **System applies fees:**
   - Platform Fee: 4% of commission
   - Stripe Fee: 3% of commission
4. **Payment record created** with status 'pending'
5. **Creator sees net amount** in payment history
6. **Admin processes payment** → Updates status to 'processing' → 'completed'

## Notes

### Retainer Payments
- Retainer contracts use a separate `retainerPayments` table
- Current schema does **NOT** include fee breakdown fields
- Only stores single `amount` field
- **Recommendation:** Clarify if 7% fee applies to retainer payments
  - If yes: Add `platformFeeAmount`, `stripeFeeAmount`, `netAmount` fields to schema
  - If no: Document that retainer payments are fee-free as fixed contracts

### Rounding
- All amounts rounded to 2 decimal places using `.toFixed(2)`
- Prevents floating-point precision issues

### Edge Cases
- **Minimum amount:** No minimum enforced (even $0.01 commissions are processed)
- **Zero amounts:** Payment not created if `saleAmount` is 0 or undefined for per_sale
- **Negative amounts:** Not validated (should add validation)

## Compliance

This fee structure aligns with:
- Stripe's standard processing fees
- Industry-standard marketplace commission rates (3-5% platform fee)
- Transparent fee disclosure requirements

## Testing Checklist

- [x] Fee calculations implemented in code
- [x] Test examples documented
- [ ] Unit tests for payment calculations
- [ ] Integration tests for conversion recording
- [ ] E2E test: Complete purchase flow with fee verification
- [ ] Verify fees display correctly in creator payment dashboard
- [ ] Verify fees display correctly in admin payment overview
- [ ] Test with various commission types (per_sale, per_lead, per_click)
- [ ] Test rounding edge cases (e.g., $0.01, $0.99, $9.999)

## Related Files

- `server/storage.ts` (Lines 1794-1814) - Fee calculation implementation
- `shared/schema.ts` (Lines 416-437) - Payments table schema
- `client/src/pages/payment-settings.tsx` - Payment UI with fee display
- `server/routes.ts` (Lines 454-491) - Conversion recording endpoint
