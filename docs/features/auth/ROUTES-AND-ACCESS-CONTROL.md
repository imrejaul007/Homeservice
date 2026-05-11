# 🛣️ Routes and Access Control - Complete Specification

## 📋 Table of Contents
1. [API Routes Structure](#api-routes-structure)
2. [Frontend Routes](#frontend-routes)
3. [Role-Based Access Matrix](#role-based-access-matrix)
4. [Post-Login Dashboard Routing](#post-login-dashboard-routing)
5. [Route Protection Implementation](#route-protection-implementation)
6. [API Permissions Matrix](#api-permissions-matrix)

---

## 🔗 API Routes Structure

### **Authentication Routes (Public)**
| Method | Route | Description | Access Level |
|--------|-------|-------------|--------------|
| `POST` | `/api/auth/register/customer` | Customer registration | Public |
| `POST` | `/api/auth/register/provider` | Provider registration | Public |
| `POST` | `/api/auth/register/admin` | Admin creation | Admin only |
| `POST` | `/api/auth/login` | Universal login | Public |
| `POST` | `/api/auth/logout` | Logout current session | Authenticated |
| `POST` | `/api/auth/logout-all` | Logout all sessions | Authenticated |
| `POST` | `/api/auth/refresh-token` | Refresh access token | Authenticated |
| `GET` | `/api/auth/me` | Get current user info | Authenticated |
| `POST` | `/api/auth/forgot-password` | Request password reset | Public |
| `POST` | `/api/auth/reset-password` | Reset password | Public |
| `POST` | `/api/auth/change-password` | Change password | Authenticated |
| `POST` | `/api/auth/verify-email` | Verify email address | Public |
| `POST` | `/api/auth/resend-verification` | Resend verification email | Public |

### **Customer API Routes**
| Method | Route | Description | Access Level |
|--------|-------|-------------|--------------|
| `GET` | `/api/customers/profile` | Get customer profile | Customer |
| `PUT` | `/api/customers/profile` | Update customer profile | Customer |
| `GET` | `/api/customers/dashboard` | Dashboard data | Customer |
| `GET` | `/api/customers/bookings` | List all bookings | Customer |
| `GET` | `/api/customers/bookings/:id` | Get booking details | Customer (own) |
| `POST` | `/api/customers/bookings` | Create new booking | Customer |
| `PATCH` | `/api/customers/bookings/:id/cancel` | Cancel booking | Customer (own) |
| `GET` | `/api/customers/favorites` | Get favorite providers | Customer |
| `POST` | `/api/customers/favorites` | Add to favorites | Customer |
| `DELETE` | `/api/customers/favorites/:id` | Remove from favorites | Customer |
| `GET` | `/api/customers/addresses` | Get saved addresses | Customer |
| `POST` | `/api/customers/addresses` | Add new address | Customer |
| `PUT` | `/api/customers/addresses/:id` | Update address | Customer |
| `DELETE` | `/api/customers/addresses/:id` | Delete address | Customer |
| `GET` | `/api/customers/payment-methods` | Get payment methods | Customer |
| `POST` | `/api/customers/payment-methods` | Add payment method | Customer |
| `DELETE` | `/api/customers/payment-methods/:id` | Remove payment method | Customer |
| `GET` | `/api/customers/reviews` | Get customer reviews | Customer |
| `POST` | `/api/customers/reviews` | Write review | Customer |
| `GET` | `/api/customers/loyalty` | Get loyalty points | Customer |

### **Provider API Routes**
| Method | Route | Description | Access Level |
|--------|-------|-------------|--------------|
| `GET` | `/api/providers/profile` | Get provider profile | Provider |
| `PUT` | `/api/providers/profile` | Update provider profile | Provider |
| `GET` | `/api/providers/dashboard` | Dashboard data | Provider |
| `GET` | `/api/providers/bookings` | List provider bookings | Provider |
| `GET` | `/api/providers/bookings/:id` | Get booking details | Provider (own) |
| `PATCH` | `/api/providers/bookings/:id/accept` | Accept booking | Provider (own) |
| `PATCH` | `/api/providers/bookings/:id/reject` | Reject booking | Provider (own) |
| `PATCH` | `/api/providers/bookings/:id/complete` | Mark complete | Provider (own) |
| `GET` | `/api/providers/services` | List provider services | Provider |
| `POST` | `/api/providers/services` | Create new service | Provider |
| `PUT` | `/api/providers/services/:id` | Update service | Provider (own) |
| `DELETE` | `/api/providers/services/:id` | Delete service | Provider (own) |
| `GET` | `/api/providers/availability` | Get availability | Provider |
| `POST` | `/api/providers/availability` | Set availability | Provider |
| `PUT` | `/api/providers/availability/:id` | Update availability | Provider |
| `GET` | `/api/providers/earnings` | Get earnings data | Provider |
| `POST` | `/api/providers/withdraw` | Request withdrawal | Provider |
| `GET` | `/api/providers/analytics` | Get analytics data | Provider |
| `POST` | `/api/providers/portfolio` | Upload portfolio | Provider |
| `DELETE` | `/api/providers/portfolio/:id` | Delete portfolio item | Provider |
| `GET` | `/api/providers/reviews` | Get provider reviews | Provider |

### **Admin API Routes**
| Method | Route | Description | Access Level |
|--------|-------|-------------|--------------|
| `GET` | `/api/admin/dashboard` | Admin dashboard data | Admin |
| `GET` | `/api/admin/users` | List all users | Admin |
| `GET` | `/api/admin/users/:id` | Get user details | Admin |
| `PUT` | `/api/admin/users/:id` | Update user | Admin |
| `DELETE` | `/api/admin/users/:id` | Delete user | Admin |
| `PATCH` | `/api/admin/users/:id/ban` | Ban user | Admin |
| `PATCH` | `/api/admin/users/:id/unban` | Unban user | Admin |
| `GET` | `/api/admin/providers` | List all providers | Admin |
| `GET` | `/api/admin/providers/:id` | Get provider details | Admin |
| `PATCH` | `/api/admin/providers/:id/verify` | Verify provider | Admin |
| `PATCH` | `/api/admin/providers/:id/reject` | Reject provider | Admin |
| `GET` | `/api/admin/services` | List all services | Admin |
| `PUT` | `/api/admin/services/:id` | Update any service | Admin |
| `DELETE` | `/api/admin/services/:id` | Delete any service | Admin |
| `GET` | `/api/admin/categories` | List categories | Admin |
| `POST` | `/api/admin/categories` | Create category | Admin |
| `PUT` | `/api/admin/categories/:id` | Update category | Admin |
| `DELETE` | `/api/admin/categories/:id` | Delete category | Admin |
| `GET` | `/api/admin/bookings` | List all bookings | Admin |
| `GET` | `/api/admin/transactions` | List all transactions | Admin |
| `POST` | `/api/admin/refunds` | Process refund | Admin |
| `GET` | `/api/admin/analytics` | Platform analytics | Admin |
| `GET` | `/api/admin/reports` | Generate reports | Admin |
| `PUT` | `/api/admin/settings` | Update platform settings | Admin |

### **Public API Routes**
| Method | Route | Description | Access Level |
|--------|-------|-------------|--------------|
| `GET` | `/api/services` | List all services | Public |
| `GET` | `/api/services/search` | Search services | Public |
| `GET` | `/api/services/categories` | List categories | Public |
| `GET` | `/api/services/:id` | Get service details | Public |
| `GET` | `/api/providers` | List providers | Public |
| `GET` | `/api/providers/:id` | Get provider profile | Public |
| `GET` | `/api/providers/:id/services` | Get provider services | Public |
| `GET` | `/api/providers/:id/reviews` | Get provider reviews | Public |
| `GET` | `/api/providers/:id/availability` | Check availability | Public |

---

## 🎨 Frontend Routes

### **Public Routes (No Authentication)**
```typescript
const publicRoutes = [
  // Landing & Info Pages
  { path: '/', component: 'HomePage' },
  { path: '/about', component: 'AboutPage' },
  { path: '/contact', component: 'ContactPage' },
  { path: '/terms', component: 'TermsPage' },
  { path: '/privacy', component: 'PrivacyPage' },
  
  // Service Discovery
  { path: '/services', component: 'ServicesPage' },
  { path: '/services/:category', component: 'CategoryPage' },
  { path: '/providers/:id', component: 'PublicProviderPage' },
  
  // Authentication
  { path: '/login', component: 'LoginPage' },
  { path: '/register', component: 'RegisterSelectionPage' },
  { path: '/register/customer', component: 'CustomerRegisterPage' },
  { path: '/register/provider', component: 'ProviderRegisterPage' },
  { path: '/forgot-password', component: 'ForgotPasswordPage' },
  { path: '/reset-password/:token', component: 'ResetPasswordPage' },
  { path: '/verify-email/:token', component: 'EmailVerificationPage' },
];
```

### **Customer Routes (Customer Role Required)**
```typescript
const customerRoutes = [
  // Dashboard Area
  { path: '/customer/dashboard', component: 'CustomerDashboard' },
  { path: '/customer/search', component: 'ServiceSearchPage' },
  { path: '/customer/providers/:id/book', component: 'BookingPage' },
  { path: '/customer/checkout', component: 'CheckoutPage' },
  
  // Booking Management
  { path: '/customer/bookings', component: 'BookingListPage' },
  { path: '/customer/bookings/:id', component: 'BookingDetailsPage' },
  
  // Profile & Settings
  { path: '/customer/profile', component: 'CustomerProfilePage' },
  { path: '/customer/addresses', component: 'AddressesPage' },
  { path: '/customer/payment-methods', component: 'PaymentMethodsPage' },
  
  // Social Features
  { path: '/customer/favorites', component: 'FavoritesPage' },
  { path: '/customer/reviews', component: 'ReviewsPage' },
  { path: '/customer/loyalty', component: 'LoyaltyPage' },
  
  // Support & Settings
  { path: '/customer/notifications', component: 'NotificationsPage' },
  { path: '/customer/settings', component: 'CustomerSettingsPage' },
  { path: '/customer/support', component: 'SupportPage' },
];
```

### **Provider Routes (Provider Role Required)**
```typescript
const providerRoutes = [
  // Dashboard Area
  { path: '/provider/dashboard', component: 'ProviderDashboard' },
  { path: '/provider/calendar', component: 'CalendarPage' },
  
  // Booking Management
  { path: '/provider/bookings', component: 'ProviderBookingListPage' },
  { path: '/provider/bookings/:id', component: 'ProviderBookingDetailsPage' },
  
  // Business Management
  { path: '/provider/profile', component: 'ProviderProfilePage' },
  { path: '/provider/services', component: 'ServicesManagePage' },
  { path: '/provider/services/add', component: 'AddServicePage' },
  { path: '/provider/services/:id/edit', component: 'EditServicePage' },
  
  // Business Tools
  { path: '/provider/availability', component: 'AvailabilityPage' },
  { path: '/provider/portfolio', component: 'PortfolioPage' },
  { path: '/provider/pricing', component: 'PricingPage' },
  { path: '/provider/team', component: 'TeamManagePage' },
  
  // Analytics & Earnings
  { path: '/provider/analytics', component: 'AnalyticsPage' },
  { path: '/provider/earnings', component: 'EarningsPage' },
  { path: '/provider/withdraw', component: 'WithdrawPage' },
  
  // Settings & Support
  { path: '/provider/reviews', component: 'ProviderReviewsPage' },
  { path: '/provider/settings', component: 'ProviderSettingsPage' },
  { path: '/provider/support', component: 'ProviderSupportPage' },
  { path: '/provider/documents', component: 'DocumentsPage' },
];
```

### **Admin Routes (Admin Role Required)**
```typescript
const adminRoutes = [
  // Dashboard & Overview
  { path: '/admin/dashboard', component: 'AdminDashboard' },
  { path: '/admin/analytics', component: 'AdminAnalyticsPage' },
  
  // User Management
  { path: '/admin/users', component: 'UserManagePage' },
  { path: '/admin/users/:id', component: 'UserDetailsPage' },
  { path: '/admin/customers', component: 'CustomerManagePage' },
  { path: '/admin/providers', component: 'ProviderManagePage' },
  { path: '/admin/providers/:id/verify', component: 'ProviderVerificationPage' },
  
  // Content Management
  { path: '/admin/services', component: 'ServiceManagePage' },
  { path: '/admin/categories', component: 'CategoryManagePage' },
  { path: '/admin/reviews', component: 'ReviewModerationPage' },
  
  // Financial Management
  { path: '/admin/transactions', component: 'TransactionManagePage' },
  { path: '/admin/payouts', component: 'PayoutManagePage' },
  { path: '/admin/refunds', component: 'RefundManagePage' },
  
  // Platform Management
  { path: '/admin/reports', component: 'ReportsPage' },
  { path: '/admin/settings', component: 'PlatformSettingsPage' },
  { path: '/admin/support', component: 'SupportManagePage' },
  { path: '/admin/notifications', component: 'NotificationManagePage' },
];
```

---

## 🛡️ Role-Based Access Matrix

### **Route Protection Logic**
```typescript
interface RouteAccess {
  path: string;
  allowedRoles: UserRole[];
  requireEmailVerified?: boolean;
  requireActive?: boolean;
  additionalChecks?: string[];
}

const routeAccessMatrix: RouteAccess[] = [
  // Public routes
  { path: '/', allowedRoles: ['guest', 'customer', 'provider', 'admin'] },
  { path: '/services', allowedRoles: ['guest', 'customer', 'provider', 'admin'] },
  { path: '/login', allowedRoles: ['guest'] },
  
  // Customer routes
  { 
    path: '/customer/*', 
    allowedRoles: ['customer'], 
    requireEmailVerified: true,
    requireActive: true 
  },
  
  // Provider routes
  { 
    path: '/provider/*', 
    allowedRoles: ['provider'], 
    requireEmailVerified: true,
    requireActive: true,
    additionalChecks: ['profile_completed'] 
  },
  
  // Admin routes
  { 
    path: '/admin/*', 
    allowedRoles: ['admin'], 
    requireEmailVerified: true,
    requireActive: true 
  },
];
```

### **API Endpoint Access Control**
```typescript
// Middleware usage examples
router.get('/api/customers/profile', 
  authenticate,                    // Verify JWT token
  requireRole(['customer']),       // Check user role
  requireEmailVerified,            // Check email verification
  requireActive,                   // Check account status
  getCustomerProfile               // Route handler
);

router.post('/api/providers/services',
  authenticate,
  requireRole(['provider']),
  requireEmailVerified,
  requireProviderApproval,         // Additional provider check
  createService
);

router.get('/api/admin/users',
  authenticate,
  requireRole(['admin']),
  requireEmailVerified,
  getAllUsers
);
```

---

## 🎯 Post-Login Dashboard Routing

### **Dashboard Routing Logic**
```typescript
const postLoginRedirect = (user: IUser) => {
  // Check account status first
  if (!user.isActive) {
    return '/account-suspended';
  }
  
  if (!user.isEmailVerified) {
    return '/verify-email-required';
  }
  
  // Role-based routing
  switch (user.role) {
    case 'customer':
      return '/customer/dashboard';
    
    case 'provider':
      // Check if provider profile is complete
      if (!user.providerProfile?.isProfileComplete) {
        return '/provider/complete-profile';
      }
      if (user.providerProfile?.verificationStatus === 'pending') {
        return '/provider/verification-pending';
      }
      return '/provider/dashboard';
    
    case 'admin':
      return '/admin/dashboard';
    
    default:
      return '/login';
  }
};
```

### **Dashboard Features by Role**

#### **Customer Dashboard**
```typescript
const customerDashboard = {
  route: '/customer/dashboard',
  components: [
    'UpcomingBookingsWidget',
    'RecommendedServicesWidget',
    'FavoriteProvidersWidget',
    'LoyaltyPointsWidget',
    'QuickBookingWidget'
  ],
  quickActions: [
    { label: 'Book a Service', route: '/customer/search' },
    { label: 'View Bookings', route: '/customer/bookings' },
    { label: 'Find Providers', route: '/services' },
    { label: 'My Reviews', route: '/customer/reviews' }
  ]
};
```

#### **Provider Dashboard**
```typescript
const providerDashboard = {
  route: '/provider/dashboard',
  components: [
    'TodayScheduleWidget',
    'EarningsWidget',
    'BookingRequestsWidget',
    'ReviewSummaryWidget',
    'AnalyticsOverviewWidget'
  ],
  quickActions: [
    { label: 'Manage Calendar', route: '/provider/calendar' },
    { label: 'View Bookings', route: '/provider/bookings' },
    { label: 'Add Service', route: '/provider/services/add' },
    { label: 'View Analytics', route: '/provider/analytics' }
  ]
};
```

#### **Admin Dashboard**
```typescript
const adminDashboard = {
  route: '/admin/dashboard',
  components: [
    'PlatformKPIsWidget',
    'UserGrowthWidget',
    'RevenueWidget',
    'PendingApprovalsWidget',
    'SystemHealthWidget'
  ],
  quickActions: [
    { label: 'User Management', route: '/admin/users' },
    { label: 'Provider Approvals', route: '/admin/providers' },
    { label: 'Platform Analytics', route: '/admin/analytics' },
    { label: 'System Reports', route: '/admin/reports' }
  ]
};
```

---

## 🔐 Route Protection Implementation

### **Frontend Route Guards**
```typescript
// ProtectedRoute Component
const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  allowedRoles: UserRole[];
  requireEmailVerified?: boolean;
}> = ({ children, allowedRoles, requireEmailVerified = false }) => {
  const { user, isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }
  
  if (requireEmailVerified && !user.isEmailVerified) {
    return <Navigate to="/verify-email-required" replace />;
  }
  
  return <>{children}</>;
};

// Usage in routes
<Route path="/customer/dashboard" element={
  <ProtectedRoute allowedRoles={['customer']} requireEmailVerified={true}>
    <CustomerDashboard />
  </ProtectedRoute>
} />
```

### **Backend Middleware Stack**
```typescript
// Authentication middleware
const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    const user = await User.findById(decoded.id);
    
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Role-based authorization
const requireRole = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// Email verification requirement
const requireEmailVerified = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user.isEmailVerified) {
    return res.status(403).json({ error: 'Email verification required' });
  }
  next();
};
```

---

## 📊 API Permissions Matrix

| Endpoint | Guest | Customer | Provider | Admin | Notes |
|----------|-------|----------|----------|-------|-------|
| `GET /api/services` | ✅ | ✅ | ✅ | ✅ | Public service listing |
| `POST /api/customers/bookings` | ❌ | ✅ | ❌ | ✅ | Customers book, admins can book for users |
| `GET /api/providers/earnings` | ❌ | ❌ | ✅ (own) | ✅ (all) | Provider sees own, admin sees all |
| `POST /api/providers/services` | ❌ | ❌ | ✅ | ✅ | Create services |
| `DELETE /api/admin/users/:id` | ❌ | ❌ | ❌ | ✅ | Admin only |
| `GET /api/customers/profile` | ❌ | ✅ (own) | ❌ | ✅ (any) | Own profile or admin |
| `PATCH /api/providers/bookings/:id/accept` | ❌ | ❌ | ✅ (own) | ✅ | Provider accepts own bookings |

### **Ownership-Based Access Control**
```typescript
// Example: Provider can only access their own bookings
const getProviderBookings = async (req: Request, res: Response) => {
  const { user } = req;
  
  let query = { providerId: user._id };
  
  // Admin can see all bookings if they provide providerId param
  if (user.role === 'admin' && req.query.providerId) {
    query.providerId = req.query.providerId;
  }
  
  const bookings = await Booking.find(query);
  res.json(bookings);
};

// Usage with middleware
router.get('/api/providers/bookings',
  authenticate,
  requireRole(['provider', 'admin']),
  getProviderBookings
);
```

---

This comprehensive routes and access control specification ensures that every endpoint and frontend route has proper permission controls, role-based access, and ownership validation where applicable.