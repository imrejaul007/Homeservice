# Admin & Provider System Documentation

This document provides comprehensive context about the Admin and Provider functionality in this home services marketplace application.

---

## 1. USER ROLES & AUTHENTICATION

### User Roles
The system has three user roles:
- **customer** - End users who book services
- **provider** - Service providers who offer services
- **admin** - Platform administrators who manage everything

### Account Statuses
Users can have these account statuses:
- `active` - Normal operating account
- `suspended` - Temporarily disabled
- `pending_verification` - Awaiting verification (for providers)
- `deactivated` - Permanently disabled

### Route Protection
- `ProtectedRoute` - Base protection with optional role requirements
- `AdminRoute` - Restricts to `admin` role only
- `ProviderRoute` - Restricts to `provider` role with optional verification checks
- `CustomerRoute` - Restricts to `customer` role

---

## 2. ADMIN CAPABILITIES

### 2.1 Admin Dashboard
The admin dashboard provides:
- **Real-time Stats**: Total users, active providers, today's bookings, revenue
- **Pending Verifications**: Count with alerts
- **Churn Statistics**: Risk levels (critical, high, medium, low)
- **Funnel Analytics**: views → searches → service views → booking requests → confirmed → completed
- **Geographic Data**: Booking distribution by city
- **Conversion Rate Tracking**
- **Quick Actions**: Users, Providers, Analytics, Disputes, Churn, Fraud, SLA, Reports

### 2.2 Provider Management
Admins can:
- **View Pending Providers**: List providers pending verification (paginated, max 50/page)
- **Review Provider Details**: View full provider profile for verification
- **Approve Provider**: 
  - Requires identity, business, background check approved
  - Creates Service documents for approved services
  - Sets verified badge (`instagramStyleProfile.isVerified = true`)
  - Updates user account status to `active`
  - Sends approval email and in-app notification
  - Emits socket event `providerApproved`
- **Reject Provider**:
  - Requires rejection reason
  - Suspends user account
  - Invalidates all tokens
  - Emits socket event `providerRejected`
- **View Verification Stats**: Provider verification statistics
- **View Providers with Services**: Hierarchical view of providers and their services
- **Batch Service Actions**: Batch approve/reject services

### 2.3 Service Management
Admins can:
- **List All Services**: With filtering by status, category, provider, search
- **View Pending Services**: Services awaiting review
- **Approve/Reject Services**: Update service status
- **Activate/Deactivate Services**: Change `isActive` status
- **Delete Services**: Remove services from platform
- **View Service Stats**: Statistics by category

### 2.4 User Management
Admins can:
- **List All Users**: With role/status filtering
- **Update User Status**: Activate, suspend, or ban users
- **Delete Users**: Cascade deletes to provider profiles and services
- **View User Stats**: Statistics by role

### 2.5 Booking Management
Admins can:
- **List All Bookings**: With filters (status, provider, customer, date range)
- **View Booking Details**: Full booking information
- **Override Booking Status**: Admin can change any booking status
- **Cancel Bookings**: Admin-initiated cancellation with refund handling
- **View Booking Stats**: Booking statistics

### 2.6 Category Management
Admins can:
- **List Categories**: View all service categories
- **Create Categories**: Create new categories with subcategories
- **Update Categories**: Modify category details
- **Delete Categories**: Remove categories (checks for active services first)
- **Feature/Unfeature Categories**: Toggle `featured` status
- **Add Subcategories**: Add subcategories to existing categories
- **View Category Stats**: Category statistics

### 2.7 Review Moderation
Admins can:
- **View Pending Reviews**: Reviews awaiting moderation
- **View Flagged Reviews**: Reviews with reports/high report counts
- **Moderate Reviews**: Approve, reject, hide, or delete reviews
- **View Review Stats**: Rating distribution and statistics
- **List All Reviews**: Full review listing with filters

### 2.8 Dispute Management
**Dispute Center Page** provides:
- **View Disputes**: See disputes between customers and providers
- **Status Workflow**: open → under_review → escalated → resolved → closed
- **Resolution Types**:
  - `no_action` - No action taken
  - `refund` - Full refund to customer
  - `partial_refund` - Partial refund to customer
  - `provider_warning` - Warning issued to provider
  - `provider_suspended` - Provider account suspended
- **Communication**: Message both parties
- **Evidence Management**: View and manage evidence from both parties
- **Timeline Tracking**: Full dispute history

### 2.9 Withdrawal/Payout Management
Admins can:
- **View Pending Withdrawals**: List withdrawal requests
- **View Withdrawal Stats**: Withdrawal statistics
- **Approve Withdrawals**: Approve provider payouts
- **Reject Withdrawals**: Reject with reason

### 2.10 Platform Management
Admins can:
- **Toggle Maintenance Mode**: Enable/disable platform maintenance with custom message
- **Manage Permissions/RBAC**:
  - Custom roles and permissions
  - Permission categories: bookings, services, users, providers, analytics, settings, finance, content, security, compliance
  - Create/edit/delete roles
  - Assign permissions to roles
  - View users by role

### 2.11 Admin Reports & Analytics
Available reports:
- **SLA Report**: Service Level Agreement monitoring
- **Churn Report**: Customer churn analysis
- **Fraud Report**: Fraud detection and prevention
- **Anomaly Dashboard**: Anomaly detection
- **Launch Dashboard**: Launch metrics
- **Offer Analytics**: Promotional offer performance
- **Refund Management**: Refund processing and tracking
- **Payout Management**: Provider payout tracking
- **Customer Management**: Customer insights

Additional analytics endpoints:
- **Churn Stats**: Customer churn statistics
- **Funnel Analytics**: Conversion funnel data
- **Geographic Analytics**: Booking distribution by location

---

## 3. PROVIDER CAPABILITIES

### 3.1 Provider Dashboard
The provider dashboard shows:
- **Quick Actions**: Add Service, Bookings, Services, Analytics, Earnings, Ads, Reviews, Availability, Profile, Portfolio, Settings, Managed Services
- **Stats Cards**: Monthly Earnings, Total Bookings (completed), Average Rating, Profile Views
- **Booking Requests**: Accept/decline booking requests
- **Recent Reviews**: Display recent reviews
- **Business Performance**: Revenue breakdown (total, available, pending)
- **Recognition Badges**: Elite Provider, Top Rated, Rising Star, New Provider

### 3.2 Service Management
Providers can:
- **List Own Services**: With filtering and pagination
- **View Service Details**: Get specific service information
- **Create Service**:
  - Sets status to `pending_review`
  - Sets `isActive` to false until approved
  - Inherits location from provider profile
  - Emits socket event `newServicePending`
- **Update Service**: Modify service details
- **Delete Service**: Remove service (checks for active bookings first)
- **Toggle Service Status**: Activate/deactivate service
- **View Service Analytics**: Service-specific performance data

### 3.3 Provider Onboarding
Providers can:
- **Check Onboarding Status**: View progress percentage
- **View Verification Status**: Current verification status
- **Upload Verification Documents**:
  - Identity documents
  - Business documents
  - Insurance documents
- **Submit for Verification**: Submit for admin review
  - Emits socket event `newProviderSubmission`
  - Creates notifications for admins

### 3.4 Portfolio Management
Providers can:
- **List Portfolio Items**: View all portfolio items
- **Create Portfolio Items**: Add with images
- **Update Portfolio Items**: Modify existing items
- **Delete Portfolio Items**: Remove items
- **Add Portfolio Images**: Add images to existing items
- **Remove Portfolio Images**: Remove images from items

### 3.5 Provider Settings
Providers can configure:
- **Auto-accept Bookings**: Automatically accept booking requests
- **Cancellation Policy**: Set cancellation rules
- **Location Settings**: Update service location
- **Privacy Settings**: Control profile visibility

### 3.6 Analytics
Providers have access to:
- **Overview Analytics**: Dashboard overview (services, performance, bookings, revenue)
- **Insights Analytics**: Analytics for 7d/30d/90d periods

### 3.7 Profile Management
Provider profile includes:
- **Business Info**: businessName, businessType, description, tagline, serviceRadius, instantBooking, advanceBookingDays, businessHours
- **Instagram-Style Profile**: profilePhoto, bio, isVerified, verificationBadges, highlights, followersCount, engagementRate
- **Location Info**: primaryAddress (with coordinates), mobileService, hasFixedLocation, serviceAreas
- **Services**: List of offered services
- **Verification Status**: Overall and individual document statuses
- **Portfolio**: Featured items, certifications, awards
- **Settings**: Business and privacy settings
- **Earnings**: totalEarned, availableBalance, pendingBalance
- **Ratings**: average, count
- **Analytics**: profileViews, totalBookings, repeatCustomers

---

## 4. CONNECTION BETWEEN ADMIN AND PROVIDER

### 4.1 Provider Verification Flow
```
1. Provider submits verification documents
        ↓
2. Admin receives notification (socket event: newProviderSubmission)
        ↓
3. Admin reviews provider profile + documents
        ↓
4. Admin approves OR rejects
        ↓
5. Provider notified (email + socket event + in-app notification)
        ↓
IF APPROVED:
   - Provider account status → 'active'
   - Services created in Service collection
   - Verified badge granted
   - Socket event: providerApproved
        ↓
IF REJECTED:
   - Provider account suspended
   - All tokens invalidated
   - Socket event: providerRejected
   - CanAppeal flag set
```

### 4.2 Service Approval Flow
```
1. Provider creates/updates service
        ↓
2. Service status → 'pending_review', isActive → false
        ↓
3. Admin sees pending service (socket event: newServicePending)
        ↓
4. Admin reviews and approves OR rejects
        ↓
5. Provider notified (socket + notification)
        ↓
IF APPROVED:
   - Service status → 'active'
   - isActive → true
   - Service becomes searchable
   - Socket event: serviceApproved
        ↓
IF REJECTED:
   - Socket event: serviceRejected
   - Includes rejection reason
```

### 4.3 Booking Management Connection
- Admins can view ALL bookings across all providers
- Admins can override booking statuses (for any booking)
- Admins can cancel bookings with refund handling
- Providers manage their own booking accept/decline workflow
- Booking status changes emit socket events for notification

### 4.4 Dispute Resolution Connection
```
1. Customer initiates dispute for booking
        ↓
2. Admin receives notification (socket event: newDispute)
        ↓
3. Admin reviews booking details + evidence from both parties
        ↓
4. Admin assigns dispute to themselves
        ↓
5. Admin communicates with both parties via messages
        ↓
6. Admin resolves with action:
   - no_action → Customer gets no refund
   - refund → Customer gets full refund
   - partial_refund → Customer gets partial refund
   - provider_warning → Warning issued to provider
   - provider_suspended → Provider account suspended
        ↓
7. System executes resolution automatically
```

### 4.5 Withdrawal/Payout Connection
```
1. Provider requests withdrawal from earnings
        ↓
2. Admin receives notification (socket event: newWithdrawalRequest)
        ↓
3. Admin reviews withdrawal request
        ↓
4. Admin approves OR rejects with reason
        ↓
5. Provider notified of outcome
        ↓
IF APPROVED:
   - Payout processed
   - Provider balance updated
        ↓
IF REJECTED:
   - Funds returned to provider balance
   - Reason provided
```

### 4.6 Review Moderation Connection
- Customer leaves review for provider after booking
- Admin can moderate (especially flagged) reviews
- Provider can respond to their reviews
- Admin resolution: approve, reject, hide, or delete

### 4.7 Socket Events Summary
**Events Admin Listens For**:
- `newProviderSubmission` - New provider verification application
- `newServicePending` - New service awaiting approval
- `newDispute` - New dispute opened
- `newWithdrawalRequest` - New withdrawal request

**Events Provider Listens For**:
- `providerApproved` - Verification approved
- `providerRejected` - Verification rejected (includes canAppeal flag)
- `serviceApproved` - Service approved
- `serviceRejected` - Service rejected (includes reason)
- `bookingStatusChanged` - Booking status updated

---

## 5. KEY DATA MODELS

### User Model
```typescript
{
  _id: ObjectId,
  email: string,
  password: string,
  name: string,
  phone: string,
  role: 'customer' | 'provider' | 'admin',
  status: 'active' | 'suspended' | 'pending_verification' | 'deactivated',
  avatar: string,
  adminInviteAcceptedAt: Date,
  invitedBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

### ProviderProfile Model
```typescript
{
  _id: ObjectId,
  userId: ObjectId,
  businessInfo: {
    businessName: string,
    businessType: string,
    description: string,
    tagline: string,
    serviceRadius: number,
    instantBooking: boolean,
    advanceBookingDays: number,
    businessHours: object
  },
  instagramStyleProfile: {
    profilePhoto: string,
    bio: string,
    isVerified: boolean,
    verificationBadges: string[],
    highlights: string[],
    followersCount: number,
    engagementRate: number
  },
  locationInfo: {
    primaryAddress: {
      street: string,
      city: string,
      state: string,
      zipCode: string,
      coordinates: { lat: number, lng: number }
    },
    mobileService: boolean,
    hasFixedLocation: boolean,
    serviceAreas: string[]
  },
  services: [embedded service objects],
  verificationStatus: {
    overall: 'pending' | 'approved' | 'rejected',
    identity: { status: string, documents: string[] },
    business: { status: string, documents: string[] },
    insurance: { status: string, documents: string[] },
    background: { status: string },
    adminNotes: string
  },
  portfolio: {
    featured: string[],
    certifications: string[],
    awards: string[]
  },
  settings: {
    autoAcceptBookings: boolean,
    privacySettings: object
  },
  earnings: {
    totalEarned: number,
    availableBalance: number,
    pendingBalance: number
  },
  ratings: {
    average: number,
    count: number
  },
  analytics: {
    profileViews: number,
    totalBookings: number,
    repeatCustomers: number
  },
  completionPercentage: number,
  isActive: boolean
}
```

### Service Model
```typescript
{
  _id: ObjectId,
  providerId: ObjectId,
  name: string,
  category: string,
  subcategory: string,
  description: string,
  duration: {
    value: number,
    unit: string
  },
  price: {
    amount: number,
    currency: string,
    type: 'fixed' | 'hourly' | 'starting_from',
    discounts: object[]
  },
  location: {
    address: string,
    coordinates: { lat: number, lng: number },
    serviceArea: { radius: number, cities: string[] }
  },
  availability: {
    schedule: object,
    exceptions: object[],
    bufferTime: number,
    instantBooking: boolean,
    advanceBookingDays: number
  },
  rating: {
    average: number,
    count: number,
    distribution: object
  },
  searchMetadata: {
    searchCount: number,
    clickCount: number,
    bookingCount: number,
    popularityScore: number
  },
  status: 'draft' | 'active' | 'inactive' | 'pending_review',
  isActive: boolean,
  isFeatured: boolean,
  isPopular: boolean,
  tags: string[],
  requirements: string[],
  includedItems: string[],
  addOns: object[]
}
```

### Booking Model
```typescript
{
  _id: ObjectId,
  customerId: ObjectId,
  providerId: ObjectId,
  serviceId: ObjectId,
  status: string, // pending, confirmed, in_progress, completed, cancelled
  scheduledDate: Date,
  scheduledTime: string,
  address: object,
  totalAmount: number,
  paymentStatus: string,
  // ... additional fields
}
```

### Dispute Model
```typescript
{
  _id: ObjectId,
  bookingId: ObjectId,
  customerId: ObjectId,
  providerId: ObjectId,
  reason: string,
  status: 'open' | 'under_review' | 'escalated' | 'resolved' | 'closed',
  resolution: {
    type: 'no_action' | 'refund' | 'partial_refund' | 'provider_warning' | 'provider_suspended',
    amount: number,
    notes: string
  },
  messages: [{
    senderId: ObjectId,
    senderRole: string,
    message: string,
    createdAt: Date
  }],
  evidence: [{
    uploadedBy: ObjectId,
    type: string,
    url: string,
    description: string,
    createdAt: Date
  }],
  assignedTo: ObjectId,
  timeline: [{
    action: string,
    performedBy: ObjectId,
    createdAt: Date
  }]
}
```

---

## 6. FEATURE MATRIX

| Feature Area | Admin Can Do | Provider Can Do |
|--------------|--------------|-----------------|
| **Users** | View all, suspend, ban, delete | View own profile |
| **Providers** | Approve/reject, view pending, suspend, delete | View own profile, update info, upload documents |
| **Services** | View all, approve/reject, activate/deactivate, delete | Create, update, delete own services |
| **Bookings** | View all, override status, cancel, refund | View own, accept/decline, update status |
| **Categories** | Create, update, delete, feature | View available |
| **Reviews** | Moderate (approve/reject/hide/delete) all | View own, respond to reviews |
| **Disputes** | View all, assign, message, resolve | View own disputes, add evidence/messages |
| **Withdrawals** | View all, approve/reject | Request withdrawal |
| **Settings** | Platform settings, maintenance mode | Business settings, privacy |
| **Analytics** | Platform-wide analytics | Own analytics and insights |
| **Permissions** | Create/manage roles and permissions | No |
| **Reports** | All admin reports | No |
| **Categories** | Full CRUD | Read-only |

---

## 7. COMMON WORKFLOWS

### Workflow 1: New Provider Joins Platform
1. User signs up with `role: 'provider'`
2. User creates ProviderProfile with business info
3. User uploads verification documents (identity, business, insurance)
4. User submits for verification
5. Admin receives `newProviderSubmission` event
6. Admin reviews in Provider Management
7. Admin approves or rejects with reason
8. Provider receives `providerApproved` or `providerRejected` event

### Workflow 2: Provider Creates New Service
1. Provider creates service via API
2. Service created with `status: 'pending_review'`
3. Admin sees pending service
4. Admin approves or rejects
5. Provider notified of decision
6. If approved, service becomes `active` and searchable

### Workflow 3: Customer Books, Dispute Arises
1. Customer books service
2. Provider accepts booking
3. Service is performed
4. Customer initiates dispute
5. Admin receives `newDispute` event
6. Admin reviews evidence from both parties
7. Admin assigns and communicates
8. Admin resolves with appropriate action
9. System executes resolution (refunds if applicable)

### Workflow 4: Provider Requests Payout
1. Provider accumulates earnings
2. Provider requests withdrawal
3. Admin receives `newWithdrawalRequest` event
4. Admin reviews in Payout Management
5. Admin approves or rejects with reason
6. If approved, payout processed
7. Provider notified of outcome

---

## 8. NOTIFICATION METHODS

Both Admin and Provider receive notifications via:
- **Socket Events**: Real-time WebSocket notifications
- **In-App Notifications**: Platform notification system
- **Email**: For important events (approvals, rejections)

---

## 9. SECURITY CONSIDERATIONS

- **Route Protection**: All routes protected by role-based middleware
- **Token Invalidation**: Tokens invalidated on account suspension/rejection
- **Permission System**: Granular permissions via RBAC
- **Audit Trail**: Timeline tracking on disputes and admin actions
- **Verification Requirements**: Multiple document verification for providers
