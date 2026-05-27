# NILIN Architecture Overview

## System Architecture

NILIN is a full-stack home services marketplace with:
- **Frontend**: React SPA with Capacitor mobile
- **Backend**: Node.js Express REST API
- **Database**: MongoDB with Redis cache
- **Storage**: Cloudinary for media
- **Payments**: Stripe

## Architecture Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Web App   │────▶│   Backend   │────▶│   MongoDB   │
└─────────────┘     └──────┬──────┘     └─────────────┘
      │                    │
      │                    ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Mobile App  │────▶│    Redis    │     │  Cloudinary │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   Stripe    │
                    └─────────────┘
```

## API Architecture

### RESTful Design
- `GET /api/resources` - List
- `GET /api/resources/:id` - Get single
- `POST /api/resources` - Create
- `PATCH /api/resources/:id` - Update
- `DELETE /api/resources/:id` - Delete

### Authentication
- JWT access tokens (15 min expiry)
- JWT refresh tokens (7 day expiry)
- 2FA support

### Rate Limiting
- Auth endpoints: 5 requests/minute
- General API: 100 requests/minute
- Search: 30 requests/minute

## Data Flow

### Booking Flow
1. Customer selects service
2. Selects provider and time
3. Creates booking (status: pending)
4. Provider accepts (status: confirmed)
5. Service completes (status: completed)
6. Provider marks complete
7. Payment released to provider

### Caching Strategy
| Data | Cache Duration |
|------|--------------|
| User session | 15 minutes |
| Categories | 1 hour |
| Provider list | 30 minutes |
| Analytics | 5 minutes |

## Security

- Helmet.js for HTTP headers
- Rate limiting
- Input validation
- XSS prevention
- CSRF protection
- SQL injection prevention (MongoDB sanitization)

## Scalability

- Horizontal scaling via container orchestration
- Redis for session storage
- CDN for static assets
- Database indexing for performance
- Queue-based job processing
