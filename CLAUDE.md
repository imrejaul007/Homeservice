# NILIN Home Service - Claude Code Instructions

## Project Overview

NILIN is a home service booking platform with:
- **Frontend**: React + TypeScript + Tailwind CSS (frontend/src/)
- **Backend**: Node.js + Express + TypeScript (backend/src/)
- **Database**: MongoDB with Mongoose ODM

## Critical Patterns & Common Issues

### 🔴 COLLECTION MISMATCH BUG (Most Common!)

**The Problem**: "Packages" data is stored in the **Bundle** collection, NOT the Service collection. Many functions incorrectly query Service for package data.

**How to Detect**:
```typescript
// ❌ WRONG - Service model for packages
const service = await Service.findOne({ _id: packageId });

// ✅ CORRECT - Bundle model for packages
const bundle = await Bundle.findOne({ _id: packageId });
```

**Files to Check for this bug**:
- `packageBooking.controller.ts`
- `packageComparison.controller.ts`
- `customerDashboard.controller.ts`
- `packages.public.routes.ts`

**Bundle vs Service Fields**:
| Data | Bundle (Package) | Service (Individual) |
|------|-----------------|---------------------|
| Price | `basePrice`, `bundlePrice`, `discountedPrice` | `price.amount` |
| Services | `services[]` (array with serviceName, originalPrice) | N/A |
| Provider | `providerId` | `providerId` |

### 🔴 DATA FORMAT MISMATCH (Frontend ↔ Backend)

**Common Field Name Mismatches**:
```typescript
// Backend returns:
{
  serviceId: "abc123",
  serviceName: "Haircut",
  originalPrice: 100,
  duration: 60  // Often MISSING from bundle services!
}

// Frontend expects:
{
  _id: "abc123",
  name: "Haircut",
  price: 100,
  duration: 60
}
```

**Fix**: Either transform in backend OR normalize in frontend:
```typescript
// Backend: Transform when returning
services: bundle.services.map(s => ({
  _id: s.serviceId,
  name: s.serviceName,
  price: s.originalPrice,
  duration: s.duration || 60
}))

// Frontend: Normalize on receipt
const normalizeService = (s) => ({
  _id: s._id || s.serviceId,
  name: s.name || s.serviceName,
  price: typeof s.price === 'number' ? s.price : s.price?.amount,
  duration: s.duration || 60
});
```

### 🔴 ROUTE ORDER ISSUES (Express Router)

**The Problem**: `/:id` matches before `/:id/print` because Express matches in definition order.

```typescript
// ❌ WRONG - /:id comes first
router.get('/:id', handler1);      // This matches "/print" as an id!
router.get('/:id/print', handler2); // Never reached!

// ✅ CORRECT - More specific routes first
router.get('/:id/print', handler2); // This is checked first
router.get('/:id', handler1);       // Generic fallback
```

**Rule**: Always define more specific routes BEFORE parameterized routes.

### 🔴 PROVIDER AVAILABILITY SCHEDULE ISSUES

**Common Problems**:
1. `workingHours` NOT SET in provider profile
2. Time slots are large blocks (3h, 5h) instead of 30-min intervals
3. Provider has 0 services assigned

**Correct Slot Structure**:
```javascript
// ❌ WRONG - Large blocks
timeSlots: [
  { startTime: "09:00", endTime: "12:00", ... },  // 3 hours!
  { startTime: "13:00", endTime: "18:00", ... }   // 5 hours!
]

// ✅ CORRECT - Individual 30-min slots
timeSlots: [
  { startTime: "09:00", endTime: "09:30", ... },
  { startTime: "09:30", endTime: "10:00", ... },
  { startTime: "10:00", endTime: "10:30", ... },
  // ... continues
]
```

### 🟡 API REQUEST/RESPONSE MISMATCH

**Frontend sends**:
```javascript
navigate('/book-package', {
  state: { packageId, packageName, isFromPackage: true }
});
```

**Backend expects** (in request body):
```javascript
{
  scheduledDate: "2024-01-15",
  scheduledTime: "10:00",
  location: { type: "customer_address", address: {...} },
  customerInfo: { name: "...", email: "...", phone: "..." },
  paymentMethod: "cash"  // NOT "credit_card"!
}
```

**Rule**: Always check Joi validation schemas match frontend payloads!

## Page Audit Workflow

Use `/audit-page [url]` to comprehensively audit any page:

1. **Discovery** - Find all related files
2. **Route Analysis** - Verify routes exist
3. **API Contract Check** - Frontend ↔ Backend data mapping
4. **Database Check** - Collection/model mismatches
5. **Availability Check** - Provider schedule setup
6. **Fix Issues** - Automatically fix all problems
7. **Report** - Summary of fixes

## Migration Script Template

When database data needs fixing, create migration scripts in `backend/src/scripts/`:

```typescript
// src/scripts/fix-provider-schedule.ts
import mongoose from 'mongoose';
import ProviderProfile from '../models/providerProfile.model';

function create30MinSlots(startHour: number, endHour: number) {
  const slots = [];
  for (let hour = startHour; hour < endHour; hour++) {
    for (let min = 0; min < 60; min += 30) {
      slots.push({
        startTime: `${hour.toString().padStart(2,'0')}:${min.toString().padStart(2,'0')}`,
        endTime: `${(hour + Math.floor((min + 30) / 60)).toString().padStart(2,'0')}:${((min + 30) % 60).toString().padStart(2,'0')}`,
        isBooked: false,
        maxBookings: 2,
        currentBookings: 0
      });
    }
  }
  return slots;
}

async function fix() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  // Use updateOne with runValidators: false to bypass schema validation
  await ProviderProfile.updateOne(
    { _id: 'provider-id' },
    { $set: { 'availability.schedule': {
      monday: { isAvailable: true, timeSlots: create30MinSlots(9, 20) },
      // ... other days
    }}},
    { runValidators: false }
  );
  
  console.log('Fixed!');
  await mongoose.disconnect();
}

fix();
```

## Quick Debugging Commands

```bash
# Check MongoDB directly
cd backend
node -e "
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const ProviderProfile = require('./dist/models/providerProfile.model').default;
  const profile = await ProviderProfile.findOne({...}).lean();
  console.log(JSON.stringify(profile.availability.schedule.monday.timeSlots, null, 2));
  await mongoose.disconnect();
});
"

# Test API endpoint
curl -X GET "http://localhost:5000/api/packages/6a2292c96511012b7d4e637b"

# Check compiled routes order
grep "router.get" dist/routes/packages.public.routes.js
```

## Always Check

1. **Collection**: Service vs Bundle for package data
2. **Field Names**: serviceId vs _id, serviceName vs name
3. **Route Order**: Specific routes before /:id
4. **Availability Schedule**: Individual 30-min slots, not blocks
5. **API Schema**: Frontend payload matches Joi validation
