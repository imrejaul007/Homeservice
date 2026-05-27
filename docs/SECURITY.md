# NILIN Security Guide

## Overview

This guide covers security measures, best practices, and compliance requirements for NILIN.

## Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        WAF Layer                            │
│  (AWS WAF / Cloudflare - Rate limiting, IP blocking)       │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Load Balancer                           │
│  (TLS termination, SSL inspection)                         │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                  API Gateway (Kong/NGINX)                  │
│  - Authentication                                           │
│  - Rate limiting                                           │
│  - Request validation                                      │
│  - IP allow/deny lists                                     │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ API Pods    │  │ Worker Pods │  │ Frontend    │         │
│  │ (RBAC)     │  │ (RBAC)      │  │ (RBAC)      │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                              │
│  Network Policies: Pod-to-pod restrictions                   │
│  Pod Security Policies: Restricted pod specs                │
└─────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
┌────────▼───────┐  ┌────────▼───────┐  ┌────────▼───────┐
│   MongoDB      │  │    Redis       │  │   S3 Storage   │
│ (VPC Private) │  │ (VPC Private)  │  │ (Encrypted)    │
└───────────────┘  └────────────────┘  └────────────────┘
```

## Authentication

### JWT Token Structure
```json
{
  "header": {
    "alg": "RS256",
    "typ": "JWT",
    "kid": "key-2024-01"
  },
  "payload": {
    "sub": "user_123",
    "type": "access",
    "role": "customer",
    "iat": 1705312200,
    "exp": 1705315800,
    "jti": "unique-token-id"
  }
}
```

### Token Lifecycle
- Access token: 1 hour TTL
- Refresh token: 7 days TTL, single use
- Rotation: Refresh on 50% TTL expiry

### Biometric Authentication (Android)
- Use Android Keystore for key storage
- Require biometric for:
  - App unlock
  - Payment confirmation
  - Profile changes

## Authorization (RBAC)

### Roles
| Role | Permissions |
|------|-------------|
| customer | View services, book, pay, review, manage profile |
| provider | Manage bookings, set availability, view earnings |
| admin | Full access, user management, system config |
| super_admin | Admin + provider approval, fraud management |

### Permission Checks
```typescript
// Every API endpoint checks permissions
async function requirePermission(
  req: Request,
  resource: string,
  action: string
): Promise<boolean> {
  const userRole = req.user.role;
  const permissions = ROLE_PERMISSIONS[userRole];
  return permissions.includes(`${resource}:${action}`);
}
```

## Data Protection

### Encryption at Rest
- Database: AES-256 encryption (MongoDB native)
- Redis: TLS + encryption
- File storage: S3 SSE-KMS
- Backups: Encrypted tarballs

### Encryption in Transit
- TLS 1.3 for all connections
- Certificate pinning for mobile apps
- mTLS for service-to-service communication

### Sensitive Data Handling
```typescript
// PII fields that must be encrypted
const PII_FIELDS = [
  'phone',
  'email',
  'address',
  'fullName',
  'idDocument',
  'paymentMethod'
];

// Encryption service
class EncryptionService {
  encryptPII(data: string): string {
    return this.aes.encrypt(data, this.encryptionKey);
  }

  decryptPII(encrypted: string): string {
    return this.aes.decrypt(encrypted, this.encryptionKey);
  }
}
```

## API Security

### Rate Limiting
| Endpoint | Limit | Window |
|----------|-------|--------|
| Auth endpoints | 10 | per minute |
| Booking creation | 5 | per minute |
| General API | 100 | per minute |
| File upload | 20 | per hour |

### Request Validation
```typescript
// All inputs validated with Zod
const CreateBookingSchema = z.object({
  serviceId: z.string().uuid(),
  providerId: z.string().uuid(),
  dateTime: z.string().datetime(),
  addressId: z.string().uuid(),
  paymentMethodId: z.string().optional(),
  couponCode: z.string().max(20).optional(),
  notes: z.string().max(500).optional()
});
```

### Security Headers
```typescript
res.setHeader('X-Content-Type-Options', 'nosniff');
res.setHeader('X-Frame-Options', 'DENY');
res.setHeader('X-XSS-Protection', '1; mode=block');
res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
res.setHeader('Content-Security-Policy', "default-src 'self'");
```

## Fraud Prevention

### Booking Fraud
- Velocity checks (max bookings per hour)
- Unusual booking patterns
- Address validation
- Device fingerprinting

### Payment Fraud
- Stripe Radar integration
- CVV/AVS checks
- 3D Secure for high-risk transactions
- Velocity limits by amount

### Coupon/Loyalty Abuse
- One-time use codes
- Account-based limits
- Device fingerprinting
- IP-based throttling

## Security Monitoring

### Logged Events
- All authentication attempts
- Authorization failures
- Payment attempts (success/failure)
- Admin actions
- Configuration changes
- Suspicious patterns

### Alerts
```yaml
# Brute force detection
- alert: BruteForceAttempt
  expr: rate(auth_failures_total[5m]) > 10
  for: 2m
  severity: high

# Payment fraud signals
- alert: PaymentFraudDetected
  expr: rate(fraud_signals_total{type="high_risk"}[5m]) > 5
  for: 1m
  severity: critical

# Data exfiltration
- alert: UnusualDataAccess
  expr: rate(data_access_total[5m]) > 1000
  for: 10m
  severity: medium
```

## Compliance

### GDPR Compliance
- Data minimization
- Right to deletion
- Data portability
- Consent management
- Privacy by design

### PCI-DSS Compliance
- Card data never stored
- PCI-compliant payment processor
- Regular security audits
- Encrypted data transmission

### CCPA Compliance
- Data disclosure rights
- Opt-out mechanisms
- Non-discrimination

## Security Checklist

### Pre-Launch
- [ ] Penetration testing completed
- [ ] Vulnerability scanning passed
- [ ] Security review completed
- [ ] Incident response plan tested
- [ ] Compliance audit passed

### Infrastructure
- [ ] TLS configured on all endpoints
- [ ] Secrets rotated and secure
- [ ] Firewalls configured
- [ ] DDoS protection enabled
- [ ] Backup encryption verified

### Application
- [ ] Input validation on all endpoints
- [ ] SQL/NoSQL injection prevention
- [ ] XSS protection enabled
- [ ] CSRF tokens implemented
- [ ] Rate limiting configured
- [ ] Logging and monitoring active

### Mobile
- [ ] Certificate pinning implemented
- [ ] Biometric auth integrated
- [ ] Secure storage for tokens
- [ ] APK/Release signing configured
- [ ] ProGuard/R8 obfuscation enabled

## Incident Response

### Reporting Security Issues
security@nilin.app

### Response SLA
- Critical: 1 hour
- High: 4 hours
- Medium: 24 hours
- Low: 72 hours

### Investigation Process
1. Containment (stop the bleeding)
2. Analysis (understand the scope)
3. Eradication (remove the threat)
4. Recovery (restore normal operations)
5. Lessons learned (prevent recurrence)
