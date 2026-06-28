# NILIN Admin Dashboard Guide

## Overview

The NILIN Admin Dashboard provides comprehensive tools for managing the home services marketplace. This guide covers all available widgets and features for platform administrators.

## Accessing the Admin Dashboard

1. Navigate to `/admin` on the NILIN platform
2. Log in with admin credentials
3. You will be redirected to the admin dashboard

---

## Dashboard Components

### 1. Main Admin Dashboard (`/admin/dashboard`)

The main dashboard provides an overview of platform health and key metrics.

**Widgets Available:**

#### Overview Cards
- **Total Users**: Count of all registered users
- **Active Providers**: Number of currently active service providers
- **Total Bookings**: All-time booking count
- **Revenue**: Platform revenue (AED)

#### Quick Actions
- View pending verifications
- Access customer support queue
- Generate reports

#### Activity Feed
Real-time feed showing recent platform activities:
- New user registrations
- Booking completions
- Provider onboarding requests

---

### 2. Analytics Dashboard (`/admin/analytics`)

Comprehensive analytics for platform insights.

#### Available Widgets

| Widget | Description | Access Path |
|--------|-------------|-------------|
| Revenue Analytics | Revenue breakdown by time period, category, city | `/admin/analytics/revenue` |
| User Analytics | User growth, retention, demographics | `/admin/analytics/users` |
| Booking Analytics | Booking volume, completion rates, popular services | `/admin/analytics/bookings` |
| Provider Analytics | Provider performance, ratings, utilization | `/admin/analytics/providers` |

#### Date Range Selector
- Preset ranges: Today, Last 7 days, Last 30 days, This month, Custom
- Export data as CSV/PDF

#### Filters
- Category filter
- Provider/Customer filter
- Geographic filter (city/area)

---

### 3. Executive Dashboard (`/admin/executive`)

High-level strategic metrics for leadership.

#### Key Metrics

| Metric | Description |
|--------|-------------|
| GMV (Gross Merchandise Value) | Total value of bookings |
| Net Revenue | Platform revenue after commissions |
| Take Rate | Platform commission percentage |
| Active Users (MAU/DAU) | Monthly/Daily Active Users |
| Provider Growth Rate | Month-over-month provider growth |
| Customer LTV | Customer Lifetime Value |

#### Charts
- Revenue trend line chart
- Booking volume bar chart
- User acquisition funnel
- Category breakdown pie chart

---

### 4. Booking Management (`/admin/bookings`)

Manage all platform bookings.

#### Features

| Feature | Description |
|---------|-------------|
| Search | Search by booking ID, customer name, provider name |
| Filters | Status, date range, category, amount range |
| Bulk Actions | Cancel, reassign, export |
| View Details | Full booking information |

#### Booking Statuses
- `pending` - Awaiting provider acceptance
- `accepted` - Provider accepted, awaiting service
- `in_progress` - Service in progress
- `completed` - Service completed
- `cancelled` - Booking cancelled
- `disputed` - Under dispute resolution

#### Actions Available
1. **View Details**: Full booking information including timeline
2. **Cancel Booking**: With optional refund processing
3. **Assign Provider**: Manual provider assignment
4. **Add Notes**: Internal notes for support team
5. **Contact Parties**: Send message to customer/provider

---

### 5. Customer Management (`/admin/customers`)

Manage customer accounts and view customer history.

#### Customer Profile Features

| Section | Description |
|---------|-------------|
| Profile Info | Name, email, phone, registration date |
| Address Book | Saved addresses |
| Payment Methods | Saved cards, wallets |
| Booking History | All past and current bookings |
| Reviews Given | Reviews submitted by customer |
| Disputes | Any disputes filed |
| Wallet | Credit balance, transaction history |

#### Customer Actions

| Action | Description |
|--------|-------------|
| Suspend Account | Temporarily disable account |
| Delete Account | Permanently remove account (GDPR) |
| View Activity | Full activity log |
| Adjust Wallet | Add/remove credit |
| Send Notification | Push/email notification |

#### Filters
- Active/Inactive status
- Date registered
- Booking count
- Total spend

---

### 6. Provider Management (`/admin/providers`)

Comprehensive provider management tools.

#### Provider Profile

| Section | Description |
|---------|-------------|
| Basic Info | Business name, contact, location |
| Services | All services offered |
| Portfolio | Work samples and images |
| Reviews | Customer feedback and ratings |
| Earnings | Payout history and pending |
| Documents | Verification documents |

#### Provider Statuses

| Status | Description |
|--------|-------------|
| `pending_verification` | Awaiting document review |
| `verified` | Documents approved |
| `suspended` | Temporarily suspended |
| `banned` | Permanently banned |

#### Actions

| Action | Description |
|--------|-------------|
| Approve/Reject | Approve or reject verification |
| Suspend Provider | Temporary suspension with reason |
| Ban Provider | Permanent removal |
| View Analytics | Performance metrics |
| Adjust Commission | Custom commission rate |
| Process Payout | Manual payout processing |

#### Filters
- Verification status
- Rating range
- Service category
- Location/Area
- Active bookings count

---

### 7. Service Management (`/admin/services`)

Manage all platform services.

#### Service Details

| Field | Description |
|-------|-------------|
| Name | Service title |
| Category | Service category/subcategory |
| Description | Full service description |
| Price | Amount and currency |
| Duration | Service duration |
| Provider | Service owner |
| Status | Active/Draft/Inactive |
| Featured | Featured on homepage |

#### Actions

| Action | Description |
|--------|-------------|
| Edit | Modify service details |
| Approve | Approve for publishing |
| Reject | Reject with reason |
| Feature | Add to featured section |
| Hide | Hide from search |
| Delete | Remove from platform |

---

### 8. Category Management (`/admin/categories`)

Manage service categories and subcategories.

#### Category Features

| Feature | Description |
|---------|-------------|
| Category Tree | Hierarchical category view |
| Icon/Image | Category visual |
| Description | Category information |
| Subcategories | Child categories |
| Service Count | Number of services |

#### Actions

| Action | Description |
|--------|-------------|
| Add Category | Create new category |
| Edit Category | Modify category details |
| Reorder | Change display order |
| Merge Categories | Combine categories |
| Archive | Soft delete category |

---

### 9. Review Moderation (`/admin/reviews`)

Moderate customer reviews.

#### Review Information

| Field | Description |
|-------|-------------|
| Customer | Reviewer profile |
| Provider | Service provider |
| Service | Service booked |
| Rating | 1-5 stars |
| Text | Review content |
| Photos | Attached images |
| Status | Pending/Approved/Hidden |

#### Actions

| Action | Description |
|--------|-------------|
| Approve | Publish review |
| Hide | Hide from public |
| Flag as Fake | Mark as suspicious |
| Reply | Provider response |
| Delete | Remove review |

#### Filters
- Status (pending/approved/hidden)
- Rating (1-5 stars)
- Provider
- Date range
- Has photos

---

### 10. Dispute Center (`/admin/disputes`)

Handle booking disputes and refund requests.

#### Dispute Information

| Field | Description |
|-------|-------------|
| Booking | Associated booking |
| Customer | Customer who filed |
| Provider | Service provider |
| Reason | Dispute reason |
| Amount | Disputed amount |
| Status | Under review/Resolved |

#### Dispute Statuses

| Status | Description |
|--------|-------------|
| `open` | Newly filed |
| `under_review` | Being investigated |
| `customer_contacted` | Customer contacted |
| `provider_contacted` | Provider contacted |
| `refund_approved` | Refund approved |
| `refund_rejected` | Dispute rejected |
| `resolved` | Fully resolved |

#### Resolution Actions

| Action | Description |
|--------|-------------|
| Full Refund | Refund entire amount |
| Partial Refund | Refund portion |
| No Refund | Reject dispute |
| Split Cost | Share between parties |
| Mediation | Schedule call |

---

### 11. Refund Management (`/admin/refunds`)

Process and track refunds.

#### Refund Types

| Type | Description |
|------|-------------|
| Customer Request | Customer-initiated |
| Provider Cancellation | Provider cancelled |
| Dispute Resolution | After dispute |
| System Error | Payment processing error |

#### Refund Statuses

| Status | Description |
|--------|-------------|
| `pending` | Awaiting processing |
| `processing` | Being processed |
| `completed` | Successfully refunded |
| `failed` | Refund failed |

#### Bulk Actions
- Approve multiple refunds
- Export refund report
- Filter by date/status

---

### 12. Coupon Management (`/admin/coupons`)

Create and manage discount coupons.

#### Coupon Configuration

| Setting | Description |
|---------|-------------|
| Code | Unique coupon code |
| Type | Percentage or fixed amount |
| Value | Discount amount/percentage |
| Min Order | Minimum order value |
| Max Discount | Cap on percentage discount |
| Usage Limit | Total uses allowed |
| Per User | Uses per customer |
| Valid From | Start date |
| Valid Until | Expiry date |

#### Coupon Statuses
- `active` - Currently valid
- `exhausted` - Usage limit reached
- `expired` - Past validity date
- `disabled` - Manually disabled

#### Actions
- Create new coupon
- Edit existing coupon
- Disable coupon
- View usage analytics

---

### 13. Payout Management (`/admin/payouts`)

Process provider payouts.

#### Payout Information

| Field | Description |
|-------|-------------|
| Provider | Payout recipient |
| Amount | Payout amount |
| Period | Earnings period |
| Method | Bank/PayPal/Wallet |
| Status | Pending/Processing/Completed |

#### Payout Statuses

| Status | Description |
|--------|-------------|
| `pending` | Awaiting approval |
| `approved` | Approved for payment |
| `processing` | Payment in progress |
| `completed` | Payment sent |
| `failed` | Payment failed |

#### Actions

| Action | Description |
|--------|-------------|
| Approve | Approve payout |
| Reject | Reject with reason |
| Retry | Retry failed payout |
| Process Manually | Manual payment |

---

### 14. Permission Manager (`/admin/permissions`)

Manage admin role-based access control.

#### Roles

| Role | Permissions |
|------|-------------|
| Super Admin | Full access to all features |
| Admin | Access to most features |
| Support | Customer support limited access |
| Finance | Financial operations only |
| Moderator | Content moderation only |

#### Permission Categories

| Category | Description |
|----------|-------------|
| Users | Customer/Provider management |
| Content | Services, reviews, categories |
| Financial | Payouts, refunds, commissions |
| Analytics | View reports and exports |
| Settings | Platform configuration |

#### Actions
- Create new role
- Edit existing role
- Assign role to admin
- View role permissions
- Audit permission changes

---

### 15. Audit Log (`/admin/audit`)

View all administrative actions.

#### Log Information

| Field | Description |
|-------|-------------|
| Timestamp | When action occurred |
| Admin | Who performed action |
| Action | What was done |
| Target | Affected resource |
| Details | Additional information |
| IP Address | Admin's IP |

#### Filters
- Date range
- Admin user
- Action type
- Target type
- IP address

#### Export
- Export to CSV
- Date range selection
- Filtered export

---

### 16. Fraud Detection Widgets (`/admin/widgets/fraud`)

Monitor and detect fraudulent activity.

#### Fake Booking Detection

| Metric | Description |
|--------|-------------|
| Suspicious Bookings | High-risk bookings flagged |
| Detection Rate | Percentage detected |
| False Positives | Incorrectly flagged |

#### Provider Abuse Monitor

| Metric | Description |
|--------|-------------|
| High Refund Rate | Providers with high cancellations |
| Suspicious Reviews | Unusual review patterns |
| Fake Services | Fictional service listings |

#### Customer Abuse Monitor

| Metric | Description |
|--------|-------------|
| Chargeback Rate | High chargeback customers |
| Review Bombing | Coordinated negative reviews |
| Multi-account | Same-person accounts |

#### Risk Score Dashboard

| Score | Action |
|-------|--------|
| Low (0-30) | Normal monitoring |
| Medium (31-60) | Enhanced review |
| High (61-80) | Manual verification |
| Critical (81-100) | Immediate action |

---

### 17. Commission & Tax Reports (`/admin/commissions`)

Financial reporting for platform earnings.

#### Commission Report

| Metric | Description |
|--------|-------------|
| Gross Revenue | Total booking value |
| Commission Rate | Platform percentage |
| Commission Earned | Platform earnings |
| Provider Payouts | Amount to providers |

#### Tax Report

| Metric | Description |
|--------|-------------|
| Taxable Amount | Amount subject to tax |
| Tax Rate | Applied tax rate |
| Tax Collected | Total tax |
| Tax Remitted | Tax paid to authorities |

#### Export Options
- PDF report
- Excel spreadsheet
- CSV data

---

### 18. Hero Slide Manager (`/admin/hero-slides`)

Manage homepage hero carousel.

#### Slide Configuration

| Field | Description |
|-------|-------------|
| Image | Slide image URL |
| Badge | Small label text |
| Title | Main headline |
| Subtitle | Description text |
| CTA | Call-to-action button |
| CTA Link | Button destination |
| Sort Order | Display priority |

#### Slide Settings

| Setting | Description |
|---------|-------------|
| Active | Enable/disable slide |
| Start Date | When to start showing |
| End Date | When to stop showing |

#### Actions
- Add new slide
- Edit existing slide
- Delete slide
- Reorder slides
- Preview slide

---

### 19. Automation Dashboard (`/admin/automation`)

Monitor and trigger marketing automations.

#### Available Automations

| Automation | Description |
|------------|-------------|
| Welcome Email | New user onboarding |
| Win-Back Campaign | Re-engage inactive users |
| Review Request | Post-booking review |
| Referral | Referral reward processing |

#### Automation Status

| Status | Description |
|--------|-------------|
| Pending | Scheduled to run |
| Processing | Currently executing |
| Completed | Successfully finished |
| Failed | Error occurred |

#### Manual Triggers
- Trigger welcome sequence
- Start win-back campaign
- Send review requests
- Process referrals

---

### 20. SLA Report (`/admin/sla`)

Service Level Agreement monitoring.

#### SLA Metrics

| Metric | Target | Description |
|--------|--------|-------------|
| Response Time | < 1 hour | Provider response to booking |
| Acceptance Rate | > 90% | Bookings accepted |
| Completion Rate | > 95% | Bookings completed |
| Cancellation Rate | < 5% | Bookings cancelled |

#### Reports
- Daily SLA summary
- Weekly trends
- Provider-specific SLA
- Category-specific SLA

---

### 21. Search Analytics (`/admin/search`)

Analyze search behavior.

#### Metrics

| Metric | Description |
|--------|-------------|
| Search Volume | Total searches |
| No Results | Searches with zero results |
| Top Queries | Most searched terms |
| Featured Results | Products clicked |

#### Filters
- Date range
- Category
- User type
- Location

---

### 22. Launch Dashboard (`/admin/launch`)

Platform launch readiness tracking.

#### Launch Checklist

| Category | Task | Status |
|----------|------|--------|
| Infrastructure | Database configured | Done/Pending |
| Services | Core services working | Done/Pending |
| Payments | Payment gateway connected | Done/Pending |
| Notifications | Email/SMS configured | Done/Pending |
| Security | Security audit passed | Done/Pending |

---

## Common Workflows

### Processing a Refund

1. Navigate to `/admin/disputes` or `/admin/refunds`
2. Find the disputed booking
3. Review booking details and dispute reason
4. Choose resolution: Full refund, Partial refund, or Reject
5. Add internal notes
6. Confirm action
7. Customer notified automatically

### Suspending a Provider

1. Navigate to `/admin/providers`
2. Search for provider
3. Click provider name
4. Click "Suspend Provider"
5. Select suspension reason
6. Set suspension duration
7. Confirm suspension
8. Provider notified automatically

### Creating a Coupon

1. Navigate to `/admin/coupons`
2. Click "Create Coupon"
3. Enter coupon code
4. Select type (percentage/fixed)
5. Set value and limits
6. Set validity dates
7. Configure usage limits
8. Save coupon

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + K` | Open command palette |
| `Ctrl + /` | Show keyboard shortcuts |
| `Ctrl + N` | New item (context-dependent) |
| `Escape` | Close modal/cancel |
| `Tab` | Navigate between fields |

---

## Troubleshooting

### Widget Not Loading

1. Check browser console for errors
2. Verify API connectivity
3. Clear browser cache
4. Try incognito mode

### Permission Denied

1. Contact super admin
2. Verify role assignment
3. Check if action is allowed for your role

### Slow Performance

1. Reduce date range filters
2. Clear applied filters
3. Use pagination instead of "Show All"
4. Report to admin for optimization

---

## Support

For issues or questions about the admin dashboard:
- Email: admin-support@nilin.app
- Slack: #admin-help
- Office Hours: Monday-Friday, 9 AM - 6 PM (GST)
