# NILIN API Changelog

This changelog documents new endpoints, breaking changes, and significant updates to the NILIN API.

---

## 2026-06-25

### New Endpoints

#### Provider Service Management
- `GET /api/provider/services/trash/count` - Get count of deleted services
  - Returns trash count for badge display in UI

#### Admin Widgets
- `GET /api/admin/fake-booking-detection` - Fake booking detection data
- `GET /api/admin/provider-abuse` - Provider abuse monitoring
- `GET /api/admin/customer-abuse` - Customer abuse monitoring
- `GET /api/admin/providers/risk` - Provider risk scores
- `GET /api/admin/revenue-by-city` - Revenue breakdown by city
- `GET /api/admin/suspensions` - Suspension center data
- `GET /api/admin/appeals` - Appeal center data
- `GET /api/admin/background-checks` - Background check dashboard
- `GET /api/admin/verification-queue` - Verification queue

#### Admin Financial Widgets
- `GET /api/admin/reconciliation` - Reconciliation engine
- `GET /api/admin/commissions/reports` - Commission reports
- `GET /api/admin/tax-reports` - Tax reports
- `GET /api/admin/refunds/analytics` - Refund analytics

#### P2 Admin Widgets
- `GET /api/admin/onboarding-funnel` - Onboarding funnel metrics
- `GET /api/admin/supply-demand` - Supply/demand ratio
- `GET /api/admin/provider-utilization` - Provider utilization
- `GET /api/admin/geographic/performance` - Geographic performance
- `GET /api/admin/safe-search` - Safe search controls
- `GET /api/admin/incidents` - List incidents
- `POST /api/admin/incidents` - Create incident
- `PATCH /api/admin/incidents/:id` - Update incident
- `GET /api/admin/churn/predictions` - Churn predictions
- `GET /api/admin/automation/winback` - Win-back dashboard
- `GET /api/admin/vip/segment` - VIP segment data
- `GET /api/admin/forecasting` - Trend forecasting
- `GET /api/admin/provider-pl` - Provider P&L
- `GET /api/admin/unit-economics` - Unit economics
- `GET /api/admin/customer-journey` - Customer journey
- `GET /api/admin/funnel-dropoff` - Funnel drop-off

#### Hero Slides Management
- `GET /api/admin/hero-slides` - List hero slides
- `POST /api/admin/hero-slides` - Create hero slide
- `GET /api/admin/hero-slides/:id` - Get hero slide
- `PUT /api/admin/hero-slides/:id` - Update hero slide
- `DELETE /api/admin/hero-slides/:id` - Delete hero slide
- `PATCH /api/admin/hero-slides/:id/toggle` - Toggle active status
- `PATCH /api/admin/hero-slides/:id/reorder` - Reorder slide
- `POST /api/admin/hero-slides/reorder-all` - Bulk reorder

#### Automation
- `POST /api/automation/welcome` - Trigger welcome automation
- `POST /api/automation/winback` - Trigger win-back campaign
- `GET /api/automation/status` - Get automation status
- `POST /api/automation/review-request` - Trigger review request
- `POST /api/automation/referral` - Process referral

### Updated Endpoints

#### Provider Services Export
- `GET /api/provider/services/export` - Now supports filters:
  - `format` (json, csv)
  - `status` (all, active, inactive)
  - `category`
  - `search`
  - `minPrice`, `maxPrice`
  - `startDate`, `endDate`
  - `minRating`
  - `featured`

#### Service Search
Enhanced search to include:
- `name`
- `description`
- `shortDescription`
- `category`
- `tags`

---

## 2026-06-19

### New Endpoints

#### Admin Report Templates
- `GET /api/admin/reports/templates` - List report templates
- `POST /api/admin/reports/templates` - Create template
- `PUT /api/admin/reports/templates/:id` - Update template
- `DELETE /api/admin/reports/templates/:id` - Delete template

#### Equipment Management
- `GET /api/equipment` - List equipment
- `POST /api/equipment` - Create equipment
- `GET /api/equipment/:id` - Get equipment
- `PUT /api/equipment/:id` - Update equipment
- `DELETE /api/equipment/:id` - Delete equipment

### Updated Endpoints

#### Availability Check
- `GET /api/availability/provider/:providerId/slots` - Now supports `serviceId` parameter for per-service availability
- `GET /api/availability/provider/:providerId/check` - Added serviceId parameter support

---

## 2026-06-18

### New Endpoints

#### Membership Routes
- `GET /api/membership/plans` - List membership plans
- `GET /api/membership/status` - Get user membership status
- `POST /api/membership/subscribe` - Subscribe to plan
- `POST /api/membership/cancel` - Cancel subscription

#### Batch Booking Operations
- `POST /api/bookings/batch/accept` - Batch accept bookings
- `POST /api/bookings/batch/decline` - Batch decline bookings
- `POST /api/bookings/batch/complete` - Batch complete bookings
- `POST /api/bookings/batch/cancel` - Batch cancel bookings
- `POST /api/bookings/batch/preview` - Preview batch operation

### Updated Endpoints

#### Availability Override Removal
- `DELETE /api/availability/override` - Now supports both `overrideId` (preferred) and legacy `date` parameter

---

## 2026-06-13

### New Endpoints

#### Winback Campaigns
- `GET /api/winback/campaigns` - List win-back campaigns
- `POST /api/winback/campaigns` - Create campaign
- `GET /api/winback/campaigns/:id` - Get campaign details
- `PATCH /api/winback/campaigns/:id` - Update campaign
- `DELETE /api/winback/campaigns/:id` - Delete campaign
- `POST /api/winback/campaigns/:id/trigger` - Trigger campaign
- `GET /api/winback/campaigns/:id/stats` - Get campaign statistics

### Breaking Changes

None.

---

## 2026-06-12

### New Endpoints

#### Bundle Customer Routes
- `GET /api/my/bundles` - List customer's purchased bundles
- `GET /api/my/bundles/:id` - Get bundle details
- `POST /api/my/bundles/:id/redeem` - Redeem bundle service

#### Bundle Management
- `GET /api/bundles` - List available bundles
- `POST /api/bundles` - Create bundle
- `GET /api/bundles/:id` - Get bundle details
- `PUT /api/bundles/:id` - Update bundle
- `DELETE /api/bundles/:id` - Delete bundle
- `PATCH /api/bundles/:id/toggle` - Toggle bundle status

#### Bundle Admin Management
- `GET /api/admin/bundles` - Admin list bundles
- `POST /api/admin/bundles` - Admin create bundle
- `PUT /api/admin/bundles/:id` - Admin update bundle
- `DELETE /api/admin/bundles/:id` - Admin delete bundle
- `PATCH /api/admin/bundles/:id/approve` - Approve bundle

---

## 2026-06-10

### New Endpoints

#### Hero Admin Routes (Initial)
- `GET /api/admin/hero-slides` - Admin list slides
- `POST /api/admin/hero-slides` - Admin create slide
- `GET /api/admin/hero-slides/:id` - Admin get slide
- `PUT /api/admin/hero-slides/:id` - Admin update slide
- `DELETE /api/admin/hero-slides/:id` - Admin delete slide

#### Analytics Admin Routes
- `GET /api/analytics/admin/overview` - Admin analytics overview
- `GET /api/analytics/admin/users` - User analytics
- `GET /api/analytics/admin/bookings` - Booking analytics
- `GET /api/analytics/admin/revenue` - Revenue analytics
- `GET /api/analytics/admin/providers` - Provider analytics

### Updated Endpoints

#### IA Agent Routes
- `POST /api/ia-agents` - Enhanced with training data support
- `GET /api/ia-agents/:id/analytics` - Chatbot analytics

---

## 2026-06-05

### New Endpoints

#### Provider Insights
- `GET /api/provider/insights/summary` - AI-powered insights summary
- `GET /api/provider/insights/recommendations` - Personalized recommendations
- `GET /api/provider/insights/competitors` - Competitive analysis
- `GET /api/provider/insights/trends` - Market trends

#### Notification Webhooks
- `POST /api/webhooks/whatsapp` - WhatsApp message webhook
- `POST /api/webhooks/telegram` - Telegram message webhook

### Deprecated Endpoints

The following endpoints are deprecated and will be removed in a future version:
- `GET /api/provider/dashboard` - Use `/api/provider/dashboard/stats` instead
- `POST /api/notifications/send` - Use `/api/admin/notifications` instead

---

## 2026-05-30

### New Endpoints

#### Corporate B2B Routes
- `GET /api/corporate/accounts` - List corporate accounts
- `POST /api/corporate/accounts` - Create corporate account
- `GET /api/corporate/accounts/:id` - Get account details
- `PUT /api/corporate/accounts/:id` - Update account
- `POST /api/corporate/accounts/:id/invite` - Invite employees
- `GET /api/corporate/accounts/:id/usage` - Usage reports

#### Session Management
- `GET /api/sessions` - List active sessions
- `DELETE /api/sessions/:id` - Terminate session
- `POST /api/sessions/terminate-all` - Terminate all other sessions

#### Fingerprinting
- `POST /api/fingerprint` - Submit device fingerprint
- `GET /api/fingerprint/verify` - Verify fingerprint

### Updated Endpoints

#### Provider Registration
- Added `serviceType` and `experience` fields
- Enhanced document upload support

#### Lead Routes
- Added `source` tracking
- Enhanced `leadScore` calculation

---

## 2026-05-29

### New Endpoints

#### Onboarding Routes
- `GET /api/customer/onboarding/status` - Get onboarding progress
- `POST /api/customer/onboarding/step` - Complete onboarding step
- `GET /api/customer/onboarding/recommended-actions` - Get recommended actions

#### Sync Routes
- `POST /api/sync/pull` - Pull data from server
- `POST /api/sync/push` - Push local changes
- `GET /api/sync/status` - Get sync status

---

## 2026-05-28

### New Endpoints

#### Invoice Routes
- `GET /api/invoices` - List invoices
- `POST /api/invoices` - Create invoice
- `GET /api/invoices/:id` - Get invoice details
- `PUT /api/invoices/:id` - Update invoice
- `DELETE /api/invoices/:id` - Void invoice
- `POST /api/invoices/:id/send` - Send invoice
- `POST /api/invoices/:id/remind` - Send payment reminder

#### Fraud Detection
- `GET /api/fraud/score` - Get user fraud score
- `GET /api/fraud/flags` - Get fraud flags
- `POST /api/fraud/report` - Report suspicious activity

### Breaking Changes

#### Booking Status Values
Updated to include additional statuses:
- `pending` - Awaiting provider acceptance
- `accepted` - Provider accepted booking
- `in_progress` - Service being delivered
- `completed` - Service completed successfully
- `cancelled` - Booking cancelled
- `disputed` - Under dispute resolution

---

## 2026-05-27

### New Endpoints

#### Churn Prediction
- `GET /api/churn/predictions` - Get churn predictions
- `GET /api/churn/at-risk-users` - List at-risk users
- `POST /api/churn/intervention` - Trigger churn intervention

#### Customer Dashboard Routes
- `GET /api/customer/dashboard/summary` - Dashboard overview
- `GET /api/customer/dashboard/recent-activity` - Recent activity
- `GET /api/customer/dashboard/recommendations` - Personalized recommendations

---

## 2026-05-22

### New Endpoints

#### Geo/Nearby Routes
- `GET /api/nearby/providers` - Get providers near location
- `GET /api/nearby/services` - Get services near location
- `GET /api/geo/search` - Geographic search
- `GET /api/geo/bounds` - Search within bounds

#### Security Enhancements
- `POST /api/auth/admin/invite` - Generate admin invite token
- `POST /api/auth/admin/accept-invite` - Accept admin invite
- `GET /api/auth/admin/invites` - List pending invites
- `DELETE /api/auth/admin/invites/:token` - Revoke invite

### Security Fixes

- Admin invite tokens now use `crypto.randomBytes(32)` instead of predictable tokens
- Added rate limiting to admin invite endpoints
- Enhanced IP allowlist for admin actions

---

## Migration Guides

### Upgrading to v1.12+

When upgrading to the latest version:

1. **Service Export Filters**: Update clients to use new filter parameters
2. **Search Enhancement**: No changes needed, automatic improvement
3. **Hero Slides**: Migrate to new `/api/admin/hero-slides` endpoints
4. **Admin Widgets**: New endpoints available, optional migration

### Breaking Changes Summary

| Version | Breaking Change | Migration |
|---------|----------------|----------|
| v1.12+ | Service status values updated | Update status handling |
| v1.11+ | Admin dashboard split into widgets | Continue using existing pages |

---

## Deprecation Timeline

| Endpoint | Deprecated | Removal Date | Replacement |
|----------|------------|--------------|-------------|
| `GET /api/provider/dashboard` | 2026-06-05 | 2026-09-01 | `/api/provider/dashboard/stats` |
| `POST /api/notifications/send` | 2026-06-05 | 2026-09-01 | `/api/admin/notifications` |

---

## Contact & Support

For questions about API changes:
- Email: api-support@nilin.app
- Documentation: https://docs.nilin.app
- API Playground: https://api.nilin.app/api-docs
