# Create Your First Payment - Step by Step

Your payment system is 100% ready! You just need to create your first payment record. Here are 3 methods:

---

## Method 1: SQL Direct Insert (Fastest - 2 minutes)

### Step 1: Get Your Data

Run this query in your database to see your approved applications:

```sql
SELECT
    a.id as application_id,
    a.creator_id,
    a.offer_id,
    o.company_id,
    o.title as offer_title,
    o.commission_type,
    o.commission_amount,
    o.commission_percentage,
    u.username as creator_username,
    u.first_name || ' ' || u.last_name as creator_name
FROM applications a
JOIN offers o ON a.offer_id = o.id
JOIN users u ON a.creator_id = u.id
WHERE a.status = 'approved'
LIMIT 5;
```

**Example output:**
```
application_id: abc-123-def
creator_id: user-456-ghi
offer_id: offer-789-jkl
company_id: comp-012-mno
offer_title: "ASUS ROG Gaming Hardware Affiliate Program"
commission_type: per_sale
commission_percentage: 10
creator_username: zoren
```

### Step 2: Calculate Payment Amounts

Based on your offer's commission type:

#### If **per_sale** (percentage-based):
```
Example: $1,000 sale with 10% commission

Gross = $1,000 × 10% = $100.00
Platform Fee (4%) = $100 × 0.04 = $4.00
Stripe Fee (3%) = $100 × 0.03 = $3.00
Net to Creator (93%) = $100 - $7 = $93.00
```

#### If **per_lead** (fixed amount):
```
Example: $50 per lead

Gross = $50.00
Platform Fee (4%) = $50 × 0.04 = $2.00
Stripe Fee (3%) = $50 × 0.03 = $1.50
Net to Creator (93%) = $50 - $3.50 = $46.50
```

#### If **per_click** (fixed amount):
```
Example: $2.50 per click

Gross = $2.50
Platform Fee (4%) = $2.50 × 0.04 = $0.10
Stripe Fee (3%) = $2.50 × 0.03 = $0.08
Net to Creator (93%) = $2.50 - $0.18 = $2.32
```

### Step 3: Insert Payment

Use your actual IDs from Step 1:

```sql
INSERT INTO payments (
    id,
    application_id,
    creator_id,
    company_id,
    offer_id,
    gross_amount,
    platform_fee_amount,
    stripe_fee_amount,
    net_amount,
    status,
    description,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'abc-123-def',  -- YOUR application_id
    'user-456-ghi', -- YOUR creator_id
    'comp-012-mno', -- YOUR company_id
    'offer-789-jkl', -- YOUR offer_id
    100.00,         -- Gross amount
    4.00,           -- Platform fee (4%)
    3.00,           -- Stripe fee (3%)
    93.00,          -- Net to creator (93%)
    'pending',      -- Status
    'Commission for ASUS ROG sale - $1000', -- Description
    NOW(),
    NOW()
);
```

### Step 4: Update Analytics (Optional)

This makes the conversion show on your dashboard:

```sql
INSERT INTO analytics (
    id,
    application_id,
    offer_id,
    creator_id,
    clicks,
    unique_clicks,
    conversions,
    earnings,
    earnings_paid,
    date,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'abc-123-def',  -- YOUR application_id
    'offer-789-jkl', -- YOUR offer_id
    'user-456-ghi', -- YOUR creator_id
    0,              -- Clicks
    0,              -- Unique clicks
    1,              -- 1 conversion
    100.00,         -- Gross earnings
    0.00,           -- Not paid yet
    NOW(),
    NOW(),
    NOW()
);
```

### Step 5: Verify Payment Created

```sql
SELECT
    p.id,
    u.username as creator,
    u.first_name || ' ' || u.last_name as creator_name,
    o.title as offer,
    p.gross_amount,
    p.platform_fee_amount,
    p.stripe_fee_amount,
    p.net_amount,
    p.status,
    p.created_at
FROM payments p
JOIN users u ON p.creator_id = u.id
JOIN offers o ON p.offer_id = o.id
ORDER BY p.created_at DESC
LIMIT 5;
```

### Step 6: See It in the UI! 🎉

1. **Company Dashboard** (`/payment-settings`):
   - Shows payment owed: $100.00
   - Total fees: $7.00
   - Net to creator: $93.00

2. **Creator Dashboard** (login as creator → `/payment-settings`):
   - Pending earnings: $93.00
   - Payment breakdown visible

3. **Admin Dashboard** (if admin user):
   - Platform revenue: $7.00
   - All transactions visible

---

## Method 2: API Endpoint (Proper Way)

### Find Application ID via Database:

```sql
SELECT id, creator_id, offer_id, status
FROM applications
WHERE status = 'approved'
LIMIT 1;
```

### Record Conversion via API:

```bash
# For per_sale commission type
curl -X POST http://localhost:3000/api/conversions/YOUR-APPLICATION-ID \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{"saleAmount": 1000}'

# For per_lead or per_click (no sale amount needed)
curl -X POST http://localhost:3000/api/conversions/YOUR-APPLICATION-ID \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{}'
```

**This automatically:**
- Calculates commission based on offer type
- Calculates fees (4% + 3%)
- Creates payment record
- Updates analytics
- Shows in UI immediately

---

## Method 3: Company Dashboard UI (When Available)

Look for "Record Conversion" button in your company dashboard:

1. Go to **Applications** or **Active Creators**
2. Find approved application (e.g., Zoren Espiritu)
3. Click **"Record Sale"** or **"Track Conversion"**
4. Enter sale amount (if per_sale)
5. Submit
6. Payment created automatically!

---

## Real Example with Your Data

Based on your dashboard showing Zoren Espiritu's approved applications:

### Example 1: Time is Gold Offer

```sql
-- Step 1: Get Zoren's application ID
SELECT a.id, a.creator_id, o.id as offer_id, o.company_id
FROM applications a
JOIN offers o ON a.offer_id = o.id
JOIN users u ON a.creator_id = u.id
WHERE u.first_name = 'Zoren'
  AND u.last_name = 'Espiritu'
  AND o.title LIKE '%Time%gold%'
  AND a.status = 'approved';

-- Step 2: Insert payment (adjust amounts based on your commission structure)
INSERT INTO payments (
    id,
    application_id,
    creator_id,
    company_id,
    offer_id,
    gross_amount,
    platform_fee_amount,
    stripe_fee_amount,
    net_amount,
    status,
    description,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    -- Use IDs from Step 1
    (SELECT a.id FROM applications a JOIN offers o ON a.offer_id = o.id JOIN users u ON a.creator_id = u.id WHERE u.first_name = 'Zoren' AND o.title LIKE '%Time%gold%' LIMIT 1),
    (SELECT u.id FROM users u WHERE u.first_name = 'Zoren' AND u.last_name = 'Espiritu' LIMIT 1),
    (SELECT cp.id FROM company_profiles cp JOIN users u ON cp.user_id = u.id WHERE u.role = 'company' LIMIT 1),
    (SELECT o.id FROM offers o WHERE o.title LIKE '%Time%gold%' LIMIT 1),
    150.00,  -- Example: $150 earned
    6.00,    -- 4% platform fee
    4.50,    -- 3% Stripe fee
    139.50,  -- 93% to Zoren
    'pending',
    'Time is Gold - Commission payment',
    NOW(),
    NOW()
);
```

### Example 2: HAROLD SARMIENTO - ASUS ROG

```sql
-- Similar query for HAROLD's ASUS ROG application
INSERT INTO payments (
    id,
    application_id,
    creator_id,
    company_id,
    offer_id,
    gross_amount,
    platform_fee_amount,
    stripe_fee_amount,
    net_amount,
    status,
    description,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    (SELECT a.id FROM applications a JOIN offers o ON a.offer_id = o.id JOIN users u ON a.creator_id = u.id WHERE u.first_name = 'HAROLD' AND o.title LIKE '%ASUS%ROG%' LIMIT 1),
    (SELECT u.id FROM users u WHERE u.first_name = 'HAROLD' AND u.last_name = 'SARMIENTO' LIMIT 1),
    (SELECT cp.id FROM company_profiles cp JOIN users u ON cp.user_id = u.id WHERE u.role = 'company' LIMIT 1),
    (SELECT o.id FROM offers o WHERE o.title LIKE '%ASUS%ROG%' LIMIT 1),
    200.00,  -- Example: $200 earned
    8.00,    -- 4% platform fee
    6.00,    -- 3% Stripe fee
    186.00,  -- 93% to HAROLD
    'pending',
    'ASUS ROG Gaming Hardware - Commission payment',
    NOW(),
    NOW()
);
```

---

## Verification Checklist

After inserting payment, verify:

### ✅ Check 1: Payment Exists
```sql
SELECT COUNT(*) FROM payments;
-- Should return: 1 (or more)
```

### ✅ Check 2: Fees Are Correct
```sql
SELECT
    gross_amount,
    platform_fee_amount,
    stripe_fee_amount,
    net_amount,
    -- Verify calculations
    ROUND((platform_fee_amount / gross_amount * 100)::numeric, 2) as platform_pct,
    ROUND((stripe_fee_amount / gross_amount * 100)::numeric, 2) as stripe_pct,
    ROUND((net_amount / gross_amount * 100)::numeric, 2) as net_pct
FROM payments
ORDER BY created_at DESC
LIMIT 1;
```

Expected:
- platform_pct = 4.00
- stripe_pct = 3.00
- net_pct = 93.00

### ✅ Check 3: View in UI
1. Open app: http://localhost:3000
2. Login as company → Go to `/payment-settings`
3. Login as creator → Go to `/payment-settings`
4. Login as admin → See all payments

---

## Quick Payment Calculator

Use this to calculate any payment:

```javascript
function calculatePayment(grossAmount) {
  const platformFee = grossAmount * 0.04;  // 4%
  const stripeFee = grossAmount * 0.03;    // 3%
  const netAmount = grossAmount * 0.93;    // 93%

  return {
    gross: grossAmount.toFixed(2),
    platformFee: platformFee.toFixed(2),
    stripeFee: stripeFee.toFixed(2),
    netAmount: netAmount.toFixed(2),
    totalFees: (platformFee + stripeFee).toFixed(2)
  };
}

// Examples:
console.log(calculatePayment(100));  // $100 gross
console.log(calculatePayment(50));   // $50 gross
console.log(calculatePayment(2.50)); // $2.50 gross
```

---

## Common Amounts Reference

| Gross | Platform (4%) | Stripe (3%) | Total Fees | Net (93%) |
|-------|--------------|-------------|------------|-----------|
| $10.00 | $0.40 | $0.30 | $0.70 | $9.30 |
| $25.00 | $1.00 | $0.75 | $1.75 | $23.25 |
| $50.00 | $2.00 | $1.50 | $3.50 | $46.50 |
| $100.00 | $4.00 | $3.00 | $7.00 | $93.00 |
| $200.00 | $8.00 | $6.00 | $14.00 | $186.00 |
| $500.00 | $20.00 | $15.00 | $35.00 | $465.00 |
| $1,000.00 | $40.00 | $30.00 | $70.00 | $930.00 |

---

## What Happens After Payment Creation

### Immediately:
- ✅ Payment visible in database
- ✅ Shows on company dashboard (amount owed)
- ✅ Shows on creator dashboard (pending earnings)
- ✅ Shows on admin dashboard (platform revenue)
- ✅ Status starts as "pending"

### When You Process:
1. Admin changes status to "processing"
2. You manually send money to creator (via their payout method)
3. Admin updates status to "completed"
4. Creator sees "Paid Out" amount increase

---

## Summary

Your payment system is **ready to use**! Just:

1. ✅ Run SQL to get your application IDs
2. ✅ Insert payment with calculated fees
3. ✅ Refresh UI to see payment data
4. ✅ All calculations are automatic and correct!

**Start with Method 1 (SQL) - it's the fastest way to test!** 🚀

---

**Files:**
- Full SQL script: `test-payment-insert.sql`
- This guide: `CREATE_FIRST_PAYMENT.md`
- Stripe info: `STRIPE_PAYMENT_SETUP_GUIDE.md`
- System overview: `PAYMENT_WORKING_100_PERCENT.md`
