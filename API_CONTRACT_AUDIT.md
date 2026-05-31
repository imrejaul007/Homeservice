# API CONTRACT AUDIT REPORT

## API Integrity Score: 52/100

---

## CRITICAL FIELD MISMATCHES

### 1. Booking Pricing Field
| Frontend Expects | Backend Returns | Impact |
|-------------------|-----------------|--------|
| `booking.pricing.taxes` | `booking.pricing.tax` | Runtime crash - undefined access |

### 2. Booking Duration Field
| Frontend Expects | Backend Returns | Impact |
|-------------------|-----------------|--------|
| `booking.estimatedDuration` | `booking.duration` | Runtime crash - undefined |

### 3. Provider Nested Field
| Frontend Expects | Backend Returns | Impact |
|-------------------|-----------------|--------|
| `booking.provider.businessName` | `booking.provider.businessInfo.businessName` | Shows "undefined" |

### 4. Lead Customer Name
| Frontend Expects | Backend Returns | Impact |
|-------------------|-----------------|--------|
| `lead.customerName` | `lead.name` | Shows "undefined" |

### 5. Search Coordinates
| Frontend Sends | Backend Expects | Impact |
|----------------|----------------|--------|
| `{lat, lng}` | GeoJSON `[lng, lat]` | Wrong search results |

---

## MISSING BACKEND ROUTES

| Frontend Route | Backend Route | Status |
|----------------|---------------|--------|
| `POST /notifications/whatsapp/enable` | Not defined | MISSING |
| `POST /notifications/whatsapp/disable` | Not defined | MISSING |
| `GET /notifications/whatsapp/status` | Not defined | MISSING |
| `POST /notifications/push/subscribe` | Not defined | MISSING |
| `POST /notifications/push/unsubscribe` | Not defined | MISSING |
| `GET /notifications/push/status` | Not defined | MISSING |
| `GET /notifications/telegram/link` | Not defined | MISSING |
| `POST /notifications/telegram/unlink` | Not defined | MISSING |
| `GET /notifications/digest/preferences` | Not defined | MISSING |
| `PATCH /notifications/digest/preferences` | Not defined | MISSING |

---

## POTENTIAL CRASH POINTS

| API | Field Access | Risk | Fix |
|-----|-------------|------|-----|
| Booking | `booking.pricing.taxes` | HIGH | Change to `pricing.tax` |
| Booking | `booking.estimatedDuration` | HIGH | Change to `booking.duration` |
| Booking | `booking.provider.businessName` | HIGH | Access `businessInfo?.businessName` |
| Booking | `booking.pricing.addOns[0].description` | HIGH | Backend doesn't return description |
| Lead | `lead.budget.min` | HIGH | Check `if (lead.budget)` before access |
| Search | `service.location.coordinates.lat` | HIGH | Use `[1]` for lat, `[0]` for lng |

---

## RESPONSE SHAPE MISMATCHES

| API | Frontend Expects | Backend Returns |
|-----|------------------|-----------------|
| `GET /category/:slug/services` | `{success, data: {services}}` | `{success, data: services}` |
| `GET /offers/my/claims` | `{success, data: {claims}}` | `{success, data: claims}` |

---

## TYPE ISSUES

| API | Field | Expected Type | Actual Type |
|-----|-------|-------------|-------------|
| Booking | `location.coordinates` | `{lat, lng}` | `[lng, lat]` (GeoJSON) |
| Lead | `assignedTo` | `string` | `User` object |
| Experience | `isFeatured` | `boolean` | `status: 'pending' | 'approved' | 'rejected'` |
