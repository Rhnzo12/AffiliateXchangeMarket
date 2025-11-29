# Offer Workflow Implementation Status

## Overview

This document compares the documented offer workflow specification against the actual implementation in the AffiliateXchange codebase.

**Legend:**
- ✅ **IMPLEMENTED** - Feature is fully implemented
- ⚠️ **PARTIAL** - Feature is partially implemented or has gaps
- ❌ **MISSING** - Feature is not implemented

**Last Updated:** 2025-11-28

---

## STEP 1 — Company Registration → Admin Approval

### Specification
- Company fills out registration + uploads business documents
- Status = Pending
- Super Admin manually reviews documents
- If approved → company can publish offers
- If rejected → company must re-apply later (90-day restriction)

### Implementation Status: ✅ IMPLEMENTED

| Feature | Status | Location |
|---------|--------|----------|
| Company registration | ✅ | `server/routes.ts:351` - `/api/company/onboarding` |
| Company status tracking (pending/approved/rejected/suspended) | ✅ | `shared/schema.ts:22` - `companyStatusEnum` |
| Admin approval endpoint | ✅ | `server/routes.ts:4491` - `POST /api/admin/companies/:id/approve` |
| Admin rejection endpoint | ✅ | `server/routes.ts:4501` - `POST /api/admin/companies/:id/reject` |
| Admin suspension endpoint | ✅ | `server/routes.ts:4512` - `POST /api/admin/companies/:id/suspend` |
| Rejection reason storage | ✅ | `shared/schema.ts:198` - `companyProfiles.rejectionReason` |
| Approval timestamp | ✅ | `shared/schema.ts:197` - `companyProfiles.approvedAt` |
| Website verification | ✅ | `server/routes.ts:4532-4585` - Verification token system |
| **90-day retry restriction** | ✅ | `server/storage.ts:1180-1221` - `canCompanyReapply()` function |
| Re-apply endpoint | ✅ | `server/routes.ts:9507-9563` - `POST /api/company/reapply` |
| Rejection count tracking | ✅ | `shared/schema.ts:195` - `companyProfiles.rejectionCount` |

---

## STEP 2 — Company Creates an Offer

### Specification
- Company fills out: Title, niche, description, commission type, payment terms, example videos (6-12 required), requirements for creators
- Offer = Under Review
- Admin approves → Offer goes live

### Implementation Status: ✅ IMPLEMENTED

| Feature | Status | Location |
|---------|--------|----------|
| Offer creation endpoint | ✅ | `server/routes.ts:993` - `POST /api/offers` |
| Title, niche, description fields | ✅ | `shared/schema.ts:225-279` - `offers` table |
| Commission types (Per Sale, Per Lead, Per Click, Retainer) | ✅ | `shared/schema.ts:24` - `commissionTypeEnum` |
| Example videos | ✅ | `shared/schema.ts:282-294` - `offerVideos` table |
| Submit for review | ✅ | `server/routes.ts:1130` - `POST /api/offers/:id/submit-for-review` |
| **6-12 video requirement validation** | ✅ | `server/routes.ts:1154-1168` - Enforced on submit |
| Admin approval endpoint | ✅ | `server/routes.ts:5233` - `POST /api/admin/offers/:id/approve` |
| Admin rejection endpoint | ✅ | `server/routes.ts:5274` - `POST /api/admin/offers/:id/reject` |
| Edit request system | ✅ | `server/routes.ts:5304` - `POST /api/admin/offers/:id/request-edits` |
| Cookie duration field | ✅ | `shared/schema.ts:246` - `offers.cookieDuration` |

---

## STEP 3 — Creator Browses & Applies

### Specification
- Creator sees offers based on niche, commission, trending, popularity
- Clicks "Apply Now"
- Enters message + selects desired commission model
- Application status = PENDING

### Implementation Status: ✅ IMPLEMENTED

| Feature | Status | Location |
|---------|--------|----------|
| Browse offers | ✅ | `server/routes.ts` - `GET /api/offers` with filtering |
| Filter by niche | ✅ | Offer filtering by niche implemented |
| Filter by commission | ✅ | Offer filtering by commission type |
| Apply to offer | ✅ | `server/routes.ts:1462` - `POST /api/applications` |
| Application message | ✅ | `shared/schema.ts:308` - `applications.message` |
| Application status (pending) | ✅ | `shared/schema.ts:309` - `applications.status` |
| Notification to company | ✅ | Notification sent on application creation |

---

## STEP 4 — Auto-Approval (7 Minutes)

### Specification
- After 7 minutes: Application changes → APPROVED (unless admin/company manually reviewed)
- System generates the creator's unique tracking link
- Link format: `https://track.yourapp.com/go/AB12CD34`

### Implementation Status: ✅ IMPLEMENTED

| Feature | Status | Location |
|---------|--------|----------|
| Auto-approval scheduler | ✅ | `server/routes.ts:8636-8704` - Runs every 60 seconds |
| **Auto-approval triggered on creation** | ✅ | `server/routes.ts:1521-1524` - Sets `autoApprovalScheduledAt` |
| Auto-approval field | ✅ | `shared/schema.ts:314` - `applications.autoApprovalScheduledAt` |
| **Short tracking codes (8-char alphanumeric)** | ✅ | `server/trackingService.ts:89-97` - `generateShortTrackingCode()` |
| Tracking link generation | ✅ | Format: `{baseURL}/go/{trackingCode}` |
| Link tied to IDs | ✅ | `applications` table stores all relationships |

---

## STEP 5 — Creator Promotes the Offer

### Specification
- Creator posts the tracking link on various platforms
- Works everywhere, even off-platform

### Implementation Status: ✅ IMPLEMENTED

| Feature | Status | Location |
|---------|--------|----------|
| Tracking link provided to creator | ✅ | Stored in `applications.trackingLink` |
| QR code generation | ✅ | `server/routes.ts:1409` - `GET /api/applications/:id/qrcode` |
| Universal redirect link | ✅ | Works across all platforms |

---

## STEP 6 — User Clicks Tracking Link

### Specification
- User goes to tracking URL
- Backend logs: IP address, User device, Timestamp, Geo location, Referrer
- Tracks unique clicks
- Redirects user to product URL

### Implementation Status: ✅ IMPLEMENTED

| Feature | Status | Location |
|---------|--------|----------|
| Click redirect handler | ✅ | `server/routes.ts:1887` - `GET /go/:code` |
| IP address logging | ✅ | `shared/schema.ts:479` - `clickEvents.ipAddress` |
| User agent logging | ✅ | `shared/schema.ts:480` - `clickEvents.userAgent` |
| Timestamp logging | ✅ | `shared/schema.ts:491` - `clickEvents.timestamp` |
| Geo location (country/city) | ✅ | Uses `geoip-lite` library |
| Referrer logging | ✅ | `shared/schema.ts:481` - `clickEvents.referer` |
| UTM parameter tracking | ✅ | `shared/schema.ts:486-490` - All UTM fields |
| Unique click tracking | ✅ | `storage.ts` - Tracks unique IPs per day |
| Redirect to product URL | ✅ | `server/routes.ts:1969` - 302 redirect |
| Fraud detection | ✅ | `server/fraudDetection.ts` - Scores clicks 0-100 |

---

## STEP 7 — Conversion / Sale / Lead Tracking

### Specification
Three tracking methods:
- **METHOD A** — Postback URL (Server-to-server)
- **METHOD B** — Tracking Pixel
- **METHOD C** — Manual Confirmation

### Implementation Status: ✅ IMPLEMENTED

| Feature | Status | Location |
|---------|--------|----------|
| **METHOD A - Postback URL** | | |
| Postback endpoint | ✅ | `server/routes.ts:9001-9110` - `POST /api/tracking/postback` |
| API key authentication | ✅ | `X-API-Key` header validation |
| **Signature validation (HMAC-SHA256)** | ✅ | `server/trackingService.ts:42-70` |
| Timestamp validation (5-min window) | ✅ | `server/trackingService.ts:73-78` |
| **Event type distinction** | ✅ | Supports: `sale`, `lead`, `click`, `signup`, `install`, `custom` |
| **METHOD B - Tracking Pixel** | | |
| Pixel endpoint | ✅ | `server/routes.ts:9121-9166` - `GET /api/tracking/pixel/:code` |
| Alternative pixel URL | ✅ | `server/routes.ts:9172-9207` - `GET /conversion?code=xxx` |
| 1x1 transparent GIF response | ✅ | `server/trackingService.ts:105-121` |
| **METHOD C - Manual Confirmation** | | |
| Manual conversion endpoint | ✅ | `server/routes.ts:1977` - `POST /api/conversions/:applicationId` |
| Application completion | ✅ | `server/routes.ts:1634` - `POST /api/applications/:id/complete` |
| Deliverable approval (retainer) | ✅ | `server/routes.ts:8264` |

---

## Commission Calculation

### Specification
- **TYPE 1: Per Sale** - Fixed $ or % of purchase amount
- **TYPE 2: Per Lead** - Fixed payout per lead
- **TYPE 3: Per Click** - Fixed payout per click
- **TYPE 4: Monthly Retainer** - Monthly amount with deliverables

### Implementation Status: ✅ IMPLEMENTED

| Feature | Status | Location |
|---------|--------|----------|
| Per Sale (fixed/percentage) | ✅ | `shared/schema.ts:238-239` |
| Per Lead (fixed payout) | ✅ | `storage.ts` - Uses `commissionAmount` |
| Per Click (fixed payout) | ✅ | `storage.ts` - Uses `commissionAmount` |
| Monthly Retainer | ✅ | `shared/schema.ts:572-610` - `retainerContracts` table |
| Hybrid commission type | ✅ | `storage.ts` - Supports both |
| Cookie/attribution duration | ✅ | `shared/schema.ts:246` - `offers.cookieDuration` |

---

## Platform Fee & Creator Earnings

### Specification
- **7% total fee**: 4% platform profit + 3% Stripe processing
- Example: $100 gross → $4 platform → $3 Stripe → $93 net to creator

### Implementation Status: ✅ IMPLEMENTED

| Feature | Status | Location |
|---------|--------|----------|
| Fee calculator service | ✅ | `server/feeCalculator.ts` |
| Platform fee (4% default) | ✅ | `feeCalculator.ts:17` |
| Stripe fee (3%) | ✅ | `feeCalculator.ts:18` |
| Per-company custom fees | ✅ | `shared/schema.ts:189` |
| Admin fee management | ✅ | `server/routes.ts:4609-4750` |
| Fee breakdown in payments | ✅ | `shared/schema.ts:545-548` |

---

## Payment/Payout System

### Specification
- Company → charged using Stripe Connect
- Platform collects 7% fee
- Creator receives net payout
- Invoice/receipt generated
- Analytics update in real-time

### Implementation Status: ✅ IMPLEMENTED

| Feature | Status | Location |
|---------|--------|----------|
| **Stripe Connect Integration** | | |
| Create connected account | ✅ | `stripeConnectService.ts:39-102` |
| Account onboarding link | ✅ | `stripeConnectService.ts:108-136` |
| Transfer to connected account | ✅ | `stripeConnectService.ts:185-278` |
| **Alternative Payment Methods** | | |
| E-Transfer | ✅ | `paymentProcessor.ts` |
| Wire Transfer | ✅ | `shared/schema.ts:510-512` |
| PayPal | ✅ | `paymentProcessor.ts:85-91` |
| Crypto | ✅ | `shared/schema.ts:517-518` |
| **Payment Management** | | |
| Payment creation | ✅ | Created on conversion |
| Payment status tracking | ✅ | `shared/schema.ts:556` |
| Payment approval | ✅ | `server/routes.ts:3270` |
| Payment dispute | ✅ | `server/routes.ts:3340` |
| **Invoice Generation** | | |
| Invoice endpoint | ✅ | `server/routes.ts:9388-9434` - `GET /api/payments/:id/invoice` |
| Invoice download | ✅ | `server/routes.ts:9441-9476` |
| HTML invoice generation | ✅ | `server/invoiceService.ts` |
| **Company Charging** | | |
| Admin charge creation | ✅ | `server/routes.ts:9572-9625` - `POST /api/admin/companies/:id/charge` |
| Company view charges | ✅ | `server/routes.ts:9632-9670` - `GET /api/company/charges` |
| Batch payment processing | ✅ | `server/routes.ts:9677-9735` - `POST /api/company/process-batch-payment` |
| Real-time analytics | ✅ | Updated on conversion |

---

## JavaScript Tracking Snippet

### Specification
- Companies can use JavaScript snippet for easy integration
- Tracks conversions on thank-you pages
- Stores tracking code in cookies for attribution

### Implementation Status: ✅ IMPLEMENTED

| Feature | Status | Location |
|---------|--------|----------|
| Snippet generator | ✅ | `server/trackingService.ts:127-185` |
| Get snippet endpoint | ✅ | `server/routes.ts:9295-9321` - `GET /api/company/tracking/snippet` |
| Integration details endpoint | ✅ | `server/routes.ts:9252-9288` - `GET /api/company/tracking/integration` |
| API key generation | ✅ | `server/routes.ts:9214-9245` - `POST /api/company/tracking/api-key` |
| Signature generation helper | ✅ | `server/routes.ts:9328-9374` |

---

## Summary

### All Core Features: ✅ IMPLEMENTED

| Feature | Status |
|---------|--------|
| Company Registration & Approval | ✅ |
| 90-Day Retry Restriction | ✅ |
| Offer Creation & Review | ✅ |
| 6-12 Video Requirement | ✅ |
| Creator Application | ✅ |
| 7-Minute Auto-Approval | ✅ |
| Short Tracking Codes | ✅ |
| Click Tracking | ✅ |
| Postback URL (with signature) | ✅ |
| Tracking Pixel | ✅ |
| JavaScript Snippet | ✅ |
| Commission Calculation | ✅ |
| Platform Fees (7%) | ✅ |
| Payment Processing | ✅ |
| Invoice Generation | ✅ |
| Company Charging | ✅ |

---

## New API Endpoints Added

### Tracking Integration
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/tracking/postback` | Server-to-server conversion tracking |
| GET | `/api/tracking/pixel/:code` | Pixel-based conversion tracking |
| GET | `/conversion` | Alternative pixel endpoint |
| POST | `/api/company/tracking/api-key` | Generate tracking API key |
| GET | `/api/company/tracking/integration` | Get integration details & docs |
| GET | `/api/company/tracking/snippet` | Get JavaScript tracking snippet |
| POST | `/api/company/tracking/generate-signature` | Generate signature for testing |

### Invoice & Billing
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/payments/:id/invoice` | Generate payment invoice |
| GET | `/api/payments/:id/invoice/download` | Download invoice HTML |

### Company Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/company/can-reapply` | Check 90-day reapply restriction |
| POST | `/api/company/reapply` | Submit re-application |
| GET | `/api/company/charges` | View pending charges |
| POST | `/api/company/process-batch-payment` | Process batch payment |
| POST | `/api/admin/companies/:id/charge` | Admin creates charge |

---

## New Files Added

| File | Purpose |
|------|---------|
| `server/trackingService.ts` | Tracking utilities (signature, pixel, snippet generation) |
| `server/invoiceService.ts` | Invoice HTML generation |

---

*Document generated: 2025-11-28*
*All features from the Affiliate Marketplace App specification have been implemented.*
