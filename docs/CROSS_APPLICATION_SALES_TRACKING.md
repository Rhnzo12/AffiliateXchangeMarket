# Cross-Application Sales Tracking - Implementation Analysis

## Is It Implemented? **YES - FULLY IMPLEMENTED**

The specification's "HOW CROSS-APPLICATION SALES ARE TRACKED" section is **completely implemented** with all three methods.

---

## How Cross-Application Sales Tracking Works

### The Problem It Solves
When a user clicks an affiliate link and lands on a **company's external website** (not the AffiliateXchange app), how does the platform know when a sale happens? The sale happens **outside** the platform.

### The Solution: 3 Methods Implemented

---

## Method A: Postback URL (Server-to-Server)

**Endpoint:** `POST /api/tracking/postback`

**File:** `server/routes.ts:9006-9115`

**How it works:**
```
1. Creator shares link: yourapp.com/go/AB12CD34
2. User clicks → redirected to company website
3. User makes purchase on company website
4. Company's SERVER sends conversion to AffiliateXchange:

   POST /api/tracking/postback
   Headers:
     X-API-Key: company_api_key
     Content-Type: application/json
   Body:
     {
       "trackingCode": "AB12CD34",
       "eventType": "sale",
       "saleAmount": 99.99,
       "currency": "USD",
       "orderId": "ORDER-12345",
       "timestamp": 1701234567890,
       "signature": "hmac_sha256_signature"
     }

5. AffiliateXchange validates API key + signature
6. Records conversion → Creator gets commission
```

**Security Features:**
- API key authentication (`X-API-Key` header)
- HMAC-SHA256 signature validation (`server/trackingService.ts:57-76`)
- Timestamp validation (5-minute window) (`server/trackingService.ts:81-85`)
- Timing-safe comparison to prevent timing attacks

---

## Method B: Tracking Pixel

**Endpoints:**
- `GET /api/tracking/pixel/:code?event=sale&amount=99.99`
- `GET /conversion?code=AB12CD34&event=sale&amount=99.99`

**File:** `server/routes.ts:9126-9213`

**How it works:**
```html
<!-- Company places this on their "Thank You" / order confirmation page -->
<img src="https://yourapp.com/api/tracking/pixel/AB12CD34?event=sale&amount=99.99"
     width="1" height="1" style="display:none" />
```

```
1. User completes purchase on company website
2. "Thank you" page loads with tracking pixel
3. Browser requests the pixel image
4. AffiliateXchange records conversion asynchronously
5. Returns 1x1 transparent GIF immediately
6. Creator gets credited for the sale
```

**Features:**
- Non-blocking (returns pixel immediately, records async)
- No-cache headers prevent duplicate counting
- Graceful error handling (always returns pixel)
- Works without JavaScript

---

## Method C: JavaScript Snippet

**Endpoint:** `GET /api/company/tracking/snippet`

**File:** `server/trackingService.ts:138-220`

**Generated snippet:**
```javascript
<script>
(function() {
  var AX = window.AffiliateXchange = {};
  AX.companyId = 'company_id';
  AX.apiKey = 'api_key';
  AX.baseUrl = 'https://yourapp.com';

  // Gets tracking code from URL (?ax_ref=ABC123) or cookie
  AX.getTrackingCode = function() {
    var urlParams = new URLSearchParams(window.location.search);
    var code = urlParams.get('ax_ref') || urlParams.get('ref');
    if (code) {
      // Store in cookie for 30-day attribution window
      document.cookie = 'ax_tracking=' + code + '; max-age=' + (30 * 24 * 60 * 60) + '; path=/';
      return code;
    }
    // Try to get from cookie
    var match = document.cookie.match(/ax_tracking=([^;]+)/);
    return match ? match[1] : null;
  };

  // Track conversion
  AX.trackConversion = function(eventType, data) {
    var trackingCode = AX.getTrackingCode();
    if (!trackingCode) return;

    // Sends POST to /api/tracking/postback
    fetch(AX.baseUrl + '/api/tracking/postback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': AX.apiKey
      },
      body: JSON.stringify({
        trackingCode: trackingCode,
        eventType: eventType || 'sale',
        saleAmount: data && data.amount,
        orderId: data && data.orderId,
        timestamp: Date.now()
      })
    });
  };

  // Auto-detect thank-you pages
  AX.autoTrack = function() {
    if (/thank|success|confirmation|complete/i.test(window.location.pathname)) {
      AX.trackConversion('sale');
    }
  };

  AX.getTrackingCode(); // Initialize
})();
</script>
```

**Features:**
- 30-day cookie attribution window
- Auto-detection of thank-you pages
- Manual `AX.trackConversion('sale', {amount: 99.99})` call
- Works with URL parameters (`?ax_ref=CODE` or `?ref=CODE`)

---

## Complete Flow: Click → External Sale → Attribution

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CROSS-APPLICATION SALES TRACKING                          │
└─────────────────────────────────────────────────────────────────────────────┘

STEP 1: CLICK (Inside Platform)
─────────────────────────────────
Creator shares: https://yourapp.com/go/AB12CD34
                                    │
                                    ▼
                         ┌──────────────────┐
                         │  GET /go/:code   │
                         │ (routes.ts:1906) │
                         └────────┬─────────┘
                                  │
     ┌────────────────────────────┼────────────────────────────┐
     │                            │                            │
     ▼                            ▼                            ▼
┌─────────────┐           ┌─────────────┐           ┌─────────────┐
│ Log Click   │           │   Fraud     │           │  302        │
│  - IP       │           │ Detection   │           │ Redirect    │
│  - Device   │           │  Scoring    │           │ to Company  │
│  - Geo      │           │  (0-100)    │           │  Website    │
│  - UTMs     │           │             │           │             │
└─────────────┘           └─────────────┘           └──────┬──────┘
                                                          │
                                                          ▼
                                              ┌─────────────────────┐
                                              │   COMPANY WEBSITE   │
                                              │   (External Site)   │
                                              └──────────┬──────────┘
                                                         │
                                                         ▼
                                              ┌─────────────────────┐
                                              │   USER MAKES        │
                                              │   PURCHASE          │
                                              └──────────┬──────────┘
                                                         │
STEP 2: CONVERSION (Outside Platform)                    │
──────────────────────────────────────                   │
                    ┌────────────────────────────────────┼────────────────────────────────────┐
                    │                                    │                                    │
                    ▼                                    ▼                                    ▼
         ┌──────────────────┐               ┌──────────────────┐               ┌──────────────────┐
         │   METHOD A       │               │   METHOD B       │               │   METHOD C       │
         │   Postback URL   │               │ Tracking Pixel   │               │   JS Snippet     │
         │ (Server-to-Server)               │  (Image Tag)     │               │  (Client-side)   │
         └────────┬─────────┘               └────────┬─────────┘               └────────┬─────────┘
                  │                                  │                                  │
                  ▼                                  ▼                                  ▼
     ┌─────────────────────┐           ┌─────────────────────┐           ┌─────────────────────┐
     │ Company server      │           │ Thank-you page:     │           │ JS calls:           │
     │ calls:              │           │ <img src="/api/     │           │ AX.trackConversion( │
     │ POST /api/tracking/ │           │   tracking/pixel/   │           │   'sale',           │
     │   postback          │           │   AB12CD34?         │           │   {amount: 99.99}   │
     │ + API Key           │           │   amount=99.99" />  │           │ )                   │
     │ + Signature         │           │                     │           │                     │
     └────────┬────────────┘           └────────┬────────────┘           └────────┬────────────┘
              │                                 │                                 │
              └─────────────────────────────────┼─────────────────────────────────┘
                                                │
                                                ▼
STEP 3: RECORD & CALCULATE (Back in Platform)
──────────────────────────────────────────────
                                    ┌──────────────────┐
                                    │ recordConversion │
                                    │ (storage.ts)     │
                                    └────────┬─────────┘
                                             │
              ┌──────────────────────────────┼──────────────────────────────┐
              │                              │                              │
              ▼                              ▼                              ▼
     ┌─────────────────┐           ┌─────────────────┐           ┌─────────────────┐
     │ Get Commission  │           │ Calculate       │           │ Create Payment  │
     │ Type from Offer │           │ Earnings        │           │ Record          │
     │                 │           │                 │           │                 │
     │ - per_sale      │           │ per_sale:       │           │ - grossAmount   │
     │ - per_lead      │           │   $99.99 × 20%  │           │ - platformFee   │
     │ - per_click     │           │   = $19.99      │           │   (4%)          │
     │ - hybrid        │           │                 │           │ - stripeFee     │
     └─────────────────┘           │ per_lead:       │           │   (3%)          │
                                   │   Fixed $10     │           │ - netAmount     │
                                   └─────────────────┘           │   (93%)         │
                                                                 └─────────────────┘
                                                                          │
                                                                          ▼
                                                                 ┌─────────────────┐
                                                                 │ Update          │
                                                                 │ Analytics       │
                                                                 │ - conversions   │
                                                                 │ - earnings      │
                                                                 └─────────────────┘
```

---

## Attribution Window: 30-Day Cookie

**Implementation:** `server/trackingService.ts:153`

```javascript
document.cookie = 'ax_tracking=' + code + '; max-age=' + (30 * 24 * 60 * 60) + '; path=/';
```

- Cookie name: `ax_tracking`
- Duration: **30 days** (2,592,000 seconds)
- Scope: Entire site (`path=/`)
- Survives browser restart

This means if a user clicks a tracking link but doesn't buy until 29 days later, the creator still gets credit.

---

## API Key Management

**Endpoint:** `POST /api/company/tracking/api-key`

**File:** `server/routes.ts:9219-9251`

Companies can generate/regenerate API keys for secure postback integration:

```typescript
const apiKey = generateCompanyApiKey(companyProfile.id);
// Stored in companyProfiles.trackingApiKey
```

---

## Specification Compliance

| Spec Requirement | Status | Implementation |
|-----------------|--------|----------------|
| Postback URL (server-to-server) | Implemented | `POST /api/tracking/postback` |
| API key authentication | Implemented | `X-API-Key` header |
| HMAC-SHA256 signature | Implemented | `trackingService.ts:40-76` |
| Timestamp validation | Implemented | 5-minute window |
| Tracking Pixel | Implemented | `GET /api/tracking/pixel/:code` |
| JavaScript Snippet | Implemented | `generateTrackingSnippet()` |
| Cookie attribution (30 days) | Implemented | `ax_tracking` cookie |
| Event types (sale, lead, click, etc.) | Implemented | 6 event types supported |
| Manual confirmation | Implemented | `POST /api/applications/:id/complete` |
| Commission calculation | Implemented | `recordConversion()` in storage.ts |

---

## Database Tables Involved

**File:** `shared/schema.ts`

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `applications` | Creator-Offer relationship | `trackingCode`, `trackingLink`, `creatorId`, `offerId` |
| `clickEvents` | Individual click records | `applicationId`, `ipAddress`, `fraudScore`, `timestamp`, UTM params |
| `analytics` | Daily aggregated metrics | `applicationId`, `date`, `clicks`, `uniqueClicks`, `conversions`, `earnings` |
| `companyProfiles` | Company config | `trackingApiKey`, `trackingApiKeyCreatedAt` |

---

## Key File Locations

| File | Purpose |
|------|---------|
| `server/trackingService.ts` | Core tracking utilities (signature, pixel, snippet generation) |
| `server/routes.ts:1906-1993` | Click redirect handler (`GET /go/:code`) |
| `server/routes.ts:9006-9115` | Postback endpoint (`POST /api/tracking/postback`) |
| `server/routes.ts:9126-9213` | Pixel endpoints |
| `server/routes.ts:9219-9251` | API key generation |
| `server/storage.ts` | `recordConversion()` function |
| `server/fraudDetection.ts` | Click fraud scoring |

---

## Fraud Detection on Clicks

**File:** `server/fraudDetection.ts`

When a tracking link is clicked, fraud detection scores the click (0-100):

| Check | Points |
|-------|--------|
| Rate limit exceeded (10+ clicks/min) | 40 |
| Bot user agent detected | 30 |
| Repeated clicks (5+ same IP) | 25 |
| Suspicious IP (VPN/datacenter) | 20 |
| No user agent | 15 |
| No referer | 10 |

**Threshold:** Clicks with score >= 50 are flagged and not counted in analytics.

---

## Summary

**Cross-Application Sales Tracking is FULLY IMPLEMENTED** with:

1. **Postback URL** - Secure server-to-server with HMAC signatures
2. **Tracking Pixel** - Simple image tag for thank-you pages
3. **JavaScript Snippet** - Full-featured client-side tracking
4. **30-day attribution window** via cookies
5. **API key management** for companies
6. **Multiple event types** (sale, lead, signup, install, custom)
7. **Commission calculation** integrated with conversion recording
8. **Fraud detection** on clicks

**The implementation meets 100% of the specification requirements for cross-application sales tracking.**

---

*Document generated: 2024-11-28*
*All features from the Affiliate Marketplace App specification have been implemented.*
