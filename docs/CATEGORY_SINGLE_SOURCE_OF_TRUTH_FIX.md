# Category Single Source of Truth Fix

## Executive Summary

**Problem:** Categories are defined in 2 completely different places causing data inconsistencies.

**Impact:** Services created through provider dashboard have WRONG categories and don't appear in searches.

**Solution:** Single source of truth - everything fetches from database API.

---

## Current State (BROKEN)

```
DATABASE (Source of Truth)          FRONTEND CONSTANTS (Wrong!)
═══════════════════════════         ════════════════════════════
Beauty & Wellness                   Cleaning
Fitness & Personal Health           Home Repair
Mobile Medical Care                 Plumbing
Education & Personal Development    Electrical
Corporate Services                  Painting
Home & Maintenance                  Beauty (different from DB!)
                                    Fitness (different from DB!)
                                    Pet Care
                                    ... etc
```

### What Uses What

| Component | Source | Correct? |
|-----------|--------|----------|
| ProviderRegistration.tsx | `useCategories` hook (API) | ✅ |
| CategoryPage.tsx | `useCategory` hook (API) | ✅ |
| SubcategoryServicePage.tsx | `useCategory` hook (API) | ✅ |
| **AddServiceModal.tsx** | `CATEGORY_LIST` constant | ❌ WRONG |
| **EditServiceModal.tsx** | `CATEGORY_LIST` constant | ❌ WRONG |
| auth.controller.ts | No validation | ❌ ACCEPTS ANYTHING |
| provider.controller.ts | No validation | ❌ ACCEPTS ANYTHING |

---

## What Will Break After Fix?

### Intentional Breaks (Good)
1. **API calls with invalid categories** → Will get clear validation error
2. **Provider dashboard shows different categories** → Will show correct DB categories

### Needs Migration
1. **Services with wrong category "Beauty"** → Need to map to "Beauty & Wellness"
2. **Services with wrong subcategory "Hair Services"** → Need to map to "Hair"

### Won't Break
1. Seeded providers (already have correct categories)
2. Frontend pages displaying categories (already use API)
3. Search functionality (already uses DB)
4. Customer-facing category browsing (already correct)

---

## Implementation Phases

### Phase 1: Add Backend Validation (auth.controller.ts)

**Location:** `registerProvider` function, before creating Service documents

```typescript
import ServiceCategory from '../models/serviceCategory.model';

// In registerProvider, before creating services:
const validateCategoryAndSubcategory = async (services: any[]) => {
  // Fetch all categories from database
  const allCategories = await ServiceCategory.find({ isActive: true }).lean();

  // Build lookup maps
  const categoryMap = new Map<string, {
    exactName: string,
    subcategoryMap: Map<string, string>
  }>();

  for (const cat of allCategories) {
    const subcatMap = new Map<string, string>();
    for (const sub of (cat.subcategories || [])) {
      if (sub.isActive !== false) {
        subcatMap.set(sub.name.toLowerCase(), sub.name);
      }
    }
    categoryMap.set(cat.name.toLowerCase(), {
      exactName: cat.name,
      subcategoryMap: subcatMap
    });
  }

  // Validate and normalize each service
  for (const service of services) {
    const catLower = service.category?.toLowerCase();
    const catData = categoryMap.get(catLower);

    if (!catData) {
      const validCats = Array.from(categoryMap.values()).map(c => c.exactName);
      throw new ApiError(400,
        `Invalid category "${service.category}". Valid categories: ${validCats.join(', ')}`
      );
    }

    // Normalize category name to exact DB value
    service.category = catData.exactName;

    // Validate and normalize subcategory if provided
    if (service.subcategory) {
      const subLower = service.subcategory.toLowerCase();
      const exactSubcat = catData.subcategoryMap.get(subLower);

      if (!exactSubcat) {
        const validSubs = Array.from(catData.subcategoryMap.values());
        throw new ApiError(400,
          `Invalid subcategory "${service.subcategory}" for category "${catData.exactName}". ` +
          `Valid subcategories: ${validSubs.join(', ')}`
        );
      }

      // Normalize subcategory name to exact DB value
      service.subcategory = exactSubcat;
    }
  }
};

// Call before creating services
await validateCategoryAndSubcategory(services);
```

### Phase 2: Add Backend Validation (provider.controller.ts)

Same validation logic in `createService` and `updateService` functions.

### Phase 3: Update AddServiceModal.tsx

**Current (WRONG):**
```typescript
import { CATEGORY_LIST } from '../../constants/categories';
// Uses hardcoded CATEGORY_LIST with wrong categories
```

**Fixed:**
```typescript
import { useCategories } from '../../hooks/useCategories';

const AddServiceModal = () => {
  const { categories, isLoading } = useCategories();

  // Transform for dropdown
  const categoryOptions = categories.map(cat => ({
    value: cat.name,
    label: cat.name,
    subcategories: cat.subcategories?.map(sub => sub.name) || []
  }));

  // Use categoryOptions in the dropdown instead of CATEGORY_LIST
};
```

### Phase 4: Update EditServiceModal.tsx

Same changes as AddServiceModal - use `useCategories` hook instead of `CATEGORY_LIST`.

### Phase 5: Delete Constants File

**File to delete:** `frontend/src/constants/categories.ts`

This file should NOT exist. It's a duplicate source of truth with completely wrong data.

### Phase 6: Data Migration Script

Fix existing services with wrong categories/subcategories:

```typescript
// scripts/migrateCategoryNames.ts

const CATEGORY_MAPPING: Record<string, string> = {
  'beauty': 'Beauty & Wellness',
  'fitness': 'Fitness & Personal Health',
  'cleaning': 'Home & Maintenance',
  'plumbing': 'Home & Maintenance',
  'electrical': 'Home & Maintenance',
  'tutoring': 'Education & Personal Development',
};

const SUBCATEGORY_MAPPING: Record<string, string> = {
  'hair services': 'Hair',
  'makeup & beauty': 'Makeup',
};

async function migrateCategories() {
  for (const [oldCat, newCat] of Object.entries(CATEGORY_MAPPING)) {
    const result = await Service.updateMany(
      { category: { $regex: new RegExp(`^${oldCat}$`, 'i') } },
      { $set: { category: newCat } }
    );
    console.log(`Migrated ${result.modifiedCount} services: ${oldCat} → ${newCat}`);
  }

  for (const [oldSub, newSub] of Object.entries(SUBCATEGORY_MAPPING)) {
    const result = await Service.updateMany(
      { subcategory: { $regex: new RegExp(`^${oldSub}$`, 'i') } },
      { $set: { subcategory: newSub } }
    );
    console.log(`Migrated ${result.modifiedCount} services: ${oldSub} → ${newSub}`);
  }
}
```

---

## Implementation Order

| Order | Phase | Risk | Impact |
|-------|-------|------|--------|
| 1 | Phase 1-2: Backend validation | Low | New services will be validated |
| 2 | Phase 3-4: Fix modals | Medium | Provider dashboard shows correct categories |
| 3 | Phase 6: Data migration | Medium | Fix existing bad data |
| 4 | Phase 5: Delete constants | Low | Cleanup |

---

## Files to Modify

```
FRONTEND:
├── src/constants/categories.ts              → DELETE
├── src/components/provider/AddServiceModal.tsx  → Use useCategories hook
├── src/components/provider/EditServiceModal.tsx → Use useCategories hook

BACKEND:
├── src/controllers/auth.controller.ts       → Add validation
├── src/controllers/provider.controller.ts   → Add validation
├── src/scripts/migrateCategoryNames.ts      → NEW: Migration script
```

---

## Will This Make Everything Consistent?

### YES - After implementing all phases:

1. **Database** = Single source of truth for categories
2. **Frontend forms** = All fetch from API, show same categories
3. **Backend validation** = Rejects invalid categories, normalizes names
4. **Existing data** = Migrated to correct category names
5. **Search** = All services findable by correct category

### Data Flow After Fix:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        FIXED ARCHITECTURE                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  SINGLE SOURCE OF TRUTH: Database (servicecategories collection)                │
│  ════════════════════════════════════════════════════════════════               │
│                                                                                  │
│           ┌──────────────────────────────────────────┐                          │
│           │         GET /api/categories               │                          │
│           │   Returns: Beauty & Wellness,             │                          │
│           │   Fitness & Personal Health, etc.         │                          │
│           └──────────────────┬───────────────────────┘                          │
│                              │                                                   │
│      ┌───────────────────────┼───────────────────────┐                          │
│      │                       │                       │                          │
│      ▼                       ▼                       ▼                          │
│ ┌─────────────┐       ┌─────────────┐       ┌─────────────┐                     │
│ │ Registration│       │ Add Service │       │ Edit Service│                     │
│ │ Form        │       │ Modal       │       │ Modal       │                     │
│ │ useCategories│      │ useCategories│      │ useCategories│                    │
│ └──────┬──────┘       └──────┬──────┘       └──────┬──────┘                     │
│        │                     │                     │                            │
│        └─────────────────────┼─────────────────────┘                            │
│                              │                                                   │
│                              ▼                                                   │
│                    ┌─────────────────┐                                          │
│                    │ BACKEND         │                                          │
│                    │ Validates       │                                          │
│                    │ against DB      │                                          │
│                    │ Normalizes names│                                          │
│                    └────────┬────────┘                                          │
│                             │                                                    │
│                             ▼                                                    │
│                    ┌─────────────────┐                                          │
│                    │ Services        │                                          │
│                    │ Collection      │                                          │
│                    │ ✅ Correct      │                                          │
│                    │ category names  │                                          │
│                    └─────────────────┘                                          │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Testing Checklist

After implementation:
- [ ] AddServiceModal shows correct categories (Beauty & Wellness, etc.)
- [ ] EditServiceModal shows correct categories
- [ ] Creating service with invalid category returns validation error
- [ ] Creating service with valid category normalizes name (e.g., "beauty" → "Beauty & Wellness")
- [ ] Creating service with invalid subcategory returns validation error
- [ ] Existing services with wrong categories are migrated
- [ ] Search by category finds all services correctly
- [ ] Provider registration still works with validation
- [ ] Category pages show correct providers
- [ ] Subcategory pages show correct services

---

## Summary

| Question | Answer |
|----------|--------|
| Will this break existing functionality? | Only invalid data paths (intended) |
| Will all categories be consistent? | Yes, single source from database |
| Will providers see correct categories? | Yes, all forms use API |
| Will search work correctly? | Yes, all services have correct names |
| Is there data migration needed? | Yes, for existing invalid services |
