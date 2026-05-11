# NILIN Category Architecture Analysis

## Executive Summary

This document analyzes the current category/service architecture vs. the required NILIN document structure and provides a detailed implementation plan to align the platform with the NILIN specification.

---

## Current Architecture Analysis

### 1. Frontend Categories (`frontend/src/constants/categories.ts`)

**Current State:** 15 flat categories hardcoded as strings

```
Cleaning, Home Repair, Plumbing, Electrical, Painting, Landscaping,
Pet Care, Tutoring, Fitness, Beauty, Moving, Assembly, Technology,
Automotive, Other
```

**Issues:**
- Categories are NOT fetched from API - completely hardcoded
- No master/subcategory hierarchy aligned with NILIN
- Each category has hardcoded subcategories in `CATEGORY_LIST`
- No admin control over categories

### 2. Backend Constants (`backend/src/constants/categories.ts`)

**Current State:** Same 15 flat categories mirrored from frontend

**Issues:**
- Duplicates frontend constants (should be single source of truth)
- Used for validation but not aligned with database model

### 3. Service Model (`backend/src/models/service.model.ts`)

**Current Schema:**
```typescript
category: String        // Free-text category string
subcategory?: String    // Optional free-text subcategory
```

**Issues:**
- Category is a string, not a reference to ServiceCategory model
- Provider can enter ANY category string (no validation against master list)
- No relational integrity between Services and ServiceCategory collection

### 4. ServiceCategory Model (`backend/src/models/serviceCategory.model.ts`)

**Current State:** A properly designed model exists with:
- Master categories with subcategories array
- Metadata, SEO fields, sortOrder
- isActive, isFeatured flags

**Issues:**
- Model exists but is NOT used by Service model
- Frontend doesn't fetch from this model
- Seeder has different categories than frontend constants

### 5. Categories Seeder (`backend/src/seeders/categories.seeder.ts`)

**Current Seeded Categories (5):**
1. Beauty & Personal Care
2. Health & Wellness
3. Fitness & Training
4. Home Services
5. Education & Tutoring

**Issues:**
- Different from frontend constants (15 categories)
- Missing NILIN categories: Mobile Medical Care, Corporate Services
- Seeder exists but may not have been run or categories not used

### 6. Search Controller Flow

```
Frontend → searchApi.searchServices({ category: "Cleaning" })
         → Backend queries Service.find({ category: "Cleaning" })
         → Returns services with matching string category
```

**Issues:**
- Searches by string match, not ObjectId reference
- No validation that category exists in ServiceCategory collection

---

## Required Architecture (NILIN Document)

### Master Categories (6)

| # | Master Category | Subcategories |
|---|----------------|---------------|
| 1 | **Beauty & Wellness** | Hair, Makeup, Nails, Skin & Aesthetics, Massage & Body Treatment, Personal Care |
| 2 | **Fitness & Personal Health** | Personal Training, Group Classes, Yoga & Meditation, Nutrition & Dietetics, Rehabilitation & Physiotherapy, Wellness Coaching |
| 3 | **Mobile Medical Care** | Home Consultations, Nurse Services, Diagnostic Services, Vaccination & Preventive Care, Telemedicine, Emergency Triage |
| 4 | **Education & Personal Development** | Academic Tutoring, Language Lessons, Professional Skills, Creative Skills, Career Coaching |
| 5 | **Corporate Services** | Employee Wellness, Facility Maintenance, Medical Programs, Hospitality & Events, Managed Services |
| 6 | **Home & Maintenance** | Cleaning, Plumbing, Electrical, HVAC & AC, Carpentry & Renovation, Smart Home & Appliances |

### Business Rules (from requirement)

1. **Homepage:** Only master category names should be visible
2. **Provider Registration:** Providers can only create services under master categories
3. **Subcategory Creation:** Providers can create/suggest subcategories under master categories only
4. **Admin Control:** Master categories are admin-controlled, cannot be created by providers

---

## Data Flow Comparison

### Current Flow (Problematic)
```
┌─────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│  Frontend   │     │    Backend API      │     │    MongoDB      │
│  Constants  │────►│  String Matching    │────►│ Service.category│
│  (15 cats)  │     │  No Validation      │     │ = "Cleaning"    │
└─────────────┘     └─────────────────────┘     └─────────────────┘
                            │
              ServiceCategory Model (UNUSED)
```

### Required Flow (NILIN Compliant)
```
┌─────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│  Frontend   │     │    Backend API      │     │      MongoDB        │
│  Fetches    │◄───►│  GET /api/categories│◄───►│  ServiceCategory    │
│  from API   │     │  Validates against  │     │  (6 master cats)    │
└─────────────┘     │  ServiceCategory    │     └─────────────────────┘
                    └─────────────────────┘              │
                              │                          ▼
                              ▼                   ┌─────────────────┐
                    ┌─────────────────────┐      │    Service      │
                    │ Provider Creates    │─────►│ categoryId: ref │
                    │ Service             │      │ subcategory: str│
                    └─────────────────────┘      └─────────────────┘
```

---

## Implementation Plan

### Phase 1: Database Schema Updates

#### 1.1 Update ServiceCategory Seeder

Replace current 5 categories with NILIN's 6 master categories:

```typescript
// backend/src/seeders/categories.seeder.ts
const NILIN_CATEGORIES = [
  {
    name: 'Beauty & Wellness',
    slug: 'beauty-wellness',
    description: 'Professional beauty and wellness services',
    icon: 'beauty',
    color: '#FF6B9D',
    sortOrder: 1,
    isFeatured: true,
    subcategories: [
      { name: 'Hair', slug: 'hair', description: 'Hair cutting, styling, coloring, treatments' },
      { name: 'Makeup', slug: 'makeup', description: 'Bridal, event, daily glam makeup' },
      { name: 'Nails', slug: 'nails', description: 'Manicure, pedicure, nail art' },
      { name: 'Skin & Aesthetics', slug: 'skin-aesthetics', description: 'Facials, peels, LED therapy' },
      { name: 'Massage & Body Treatment', slug: 'massage-body', description: 'Swedish, deep tissue, hot stone' },
      { name: 'Personal Care', slug: 'personal-care', description: 'Waxing, threading, eyebrow shaping' }
    ]
  },
  {
    name: 'Fitness & Personal Health',
    slug: 'fitness-personal-health',
    // ... subcategories
  },
  {
    name: 'Mobile Medical Care',
    slug: 'mobile-medical-care',
    // ... subcategories
  },
  {
    name: 'Education & Personal Development',
    slug: 'education-personal-development',
    // ... subcategories
  },
  {
    name: 'Corporate Services',
    slug: 'corporate-services',
    // ... subcategories
  },
  {
    name: 'Home & Maintenance',
    slug: 'home-maintenance',
    // ... subcategories
  }
];
```

#### 1.2 Update Service Model

Option A: Reference-based (Recommended)
```typescript
// backend/src/models/service.model.ts
categoryId: {
  type: Schema.Types.ObjectId,
  ref: 'ServiceCategory',
  required: true,
  index: true
},
subcategory: {
  type: String,
  required: true,
  index: true
}
```

Option B: String-based with validation (Simpler migration)
```typescript
category: {
  type: String,
  required: true,
  validate: {
    validator: async function(v: string) {
      const exists = await ServiceCategory.findOne({ name: v, isActive: true });
      return !!exists;
    },
    message: 'Category must be a valid master category'
  }
}
```

### Phase 2: API Endpoints

#### 2.1 Create Category Routes

```typescript
// backend/src/routes/category.routes.ts

// Public routes
GET  /api/categories                    // Get all master categories (for homepage)
GET  /api/categories/:slug              // Get category with subcategories
GET  /api/categories/:slug/services     // Get services under a category

// Provider routes (authenticated)
POST /api/categories/:slug/subcategories/suggest  // Suggest new subcategory

// Admin routes
POST   /api/admin/categories            // Create master category
PUT    /api/admin/categories/:id        // Update category
DELETE /api/admin/categories/:id        // Delete category
POST   /api/admin/categories/:id/subcategories           // Add subcategory
PUT    /api/admin/categories/:id/subcategories/:subId    // Update subcategory
DELETE /api/admin/categories/:id/subcategories/:subId    // Remove subcategory
POST   /api/admin/subcategories/approve/:suggestionId    // Approve suggested subcategory
```

#### 2.2 Category Controller

```typescript
// backend/src/controllers/category.controller.ts

// Get all master categories (homepage)
export const getMasterCategories = asyncHandler(async (req, res) => {
  const categories = await ServiceCategory.find({ isActive: true })
    .select('name slug icon color imageUrl description sortOrder')
    .sort({ sortOrder: 1 });

  res.json({ success: true, data: { categories } });
});

// Get category with subcategories
export const getCategoryBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const category = await ServiceCategory.findOne({ slug, isActive: true });

  if (!category) {
    throw new ApiError(404, 'Category not found');
  }

  res.json({ success: true, data: { category } });
});
```

### Phase 3: Frontend Updates

#### 3.1 Create Category Service

```typescript
// frontend/src/services/categoryApi.ts

export const categoryApi = {
  // Get all master categories
  getMasterCategories: async () => {
    const response = await api.get('/categories');
    return response.data;
  },

  // Get category with subcategories
  getCategory: async (slug: string) => {
    const response = await api.get(`/categories/${slug}`);
    return response.data;
  }
};
```

#### 3.2 Update HomePage to Fetch Categories

```typescript
// frontend/src/pages/HomePage.tsx

const [categories, setCategories] = useState<Category[]>([]);

useEffect(() => {
  const fetchCategories = async () => {
    const response = await categoryApi.getMasterCategories();
    setCategories(response.data.categories);
  };
  fetchCategories();
}, []);

// Render master categories only (no subcategories on homepage)
{categories.map(category => (
  <CategoryCard
    key={category.slug}
    name={category.name}
    icon={category.icon}
    onClick={() => navigate(`/search?category=${category.slug}`)}
  />
))}
```

#### 3.3 Update Category Constants (Deprecate)

```typescript
// frontend/src/constants/categories.ts

// DEPRECATED: Categories now fetched from API
// Keep for backwards compatibility during migration
export const SERVICE_CATEGORIES = [...] // Mark as deprecated

// New approach: use categoryApi.getMasterCategories()
```

### Phase 4: Provider Service Creation Flow

#### 4.1 Service Creation Form

```typescript
// When provider creates service:
1. Fetch master categories from API
2. Provider selects master category (dropdown)
3. Fetch subcategories for selected category
4. Provider selects existing subcategory OR suggests new one
5. If new subcategory suggested → goes to admin approval queue
6. Service created with:
   - categoryId: ObjectId of master category
   - subcategory: string (selected or approved suggestion)
```

#### 4.2 Subcategory Suggestion Model

```typescript
// backend/src/models/subcategorySuggestion.model.ts
const subcategorySuggestionSchema = new Schema({
  categoryId: { type: ObjectId, ref: 'ServiceCategory', required: true },
  suggestedBy: { type: ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  reviewedBy: { type: ObjectId, ref: 'User' },
  reviewedAt: Date,
  rejectionReason: String
}, { timestamps: true });
```

### Phase 5: Migration Strategy

#### 5.1 Data Migration Script

```typescript
// backend/src/scripts/migrate-categories.ts

async function migrateServiceCategories() {
  // 1. Seed new NILIN categories
  await seedNilinCategories();

  // 2. Create mapping from old categories to new
  const categoryMapping = {
    'Cleaning': 'home-maintenance',
    'Plumbing': 'home-maintenance',
    'Electrical': 'home-maintenance',
    'Beauty': 'beauty-wellness',
    'Fitness': 'fitness-personal-health',
    'Tutoring': 'education-personal-development',
    // ... etc
  };

  // 3. Update existing services
  for (const [oldCat, newSlug] of Object.entries(categoryMapping)) {
    const newCategory = await ServiceCategory.findOne({ slug: newSlug });
    await Service.updateMany(
      { category: oldCat },
      {
        $set: {
          categoryId: newCategory._id,
          category: newCategory.name  // Keep for backwards compatibility
        }
      }
    );
  }
}
```

---

## Summary: What Needs to Change

### Backend Changes

| Component | Current | Required | Priority |
|-----------|---------|----------|----------|
| `constants/categories.ts` | 15 flat categories | Remove or deprecate | Medium |
| `seeders/categories.seeder.ts` | 5 categories | 6 NILIN categories | High |
| `models/service.model.ts` | category: String | categoryId: ObjectId ref | High |
| New: `routes/category.routes.ts` | N/A | Category CRUD API | High |
| New: `controllers/category.controller.ts` | N/A | Category logic | High |
| `controllers/search.controller.ts` | String match | ObjectId/validated match | Medium |

### Frontend Changes

| Component | Current | Required | Priority |
|-----------|---------|----------|----------|
| `constants/categories.ts` | Hardcoded 15 cats | Fetch from API | High |
| `pages/HomePage.tsx` | Uses constants | Fetch categories API | High |
| New: `services/categoryApi.ts` | N/A | Category API calls | High |
| `pages/SearchPage.tsx` | String category filter | ObjectId/slug filter | Medium |
| Provider service form | Free category input | Dropdown from API | High |

### Database Changes

| Collection | Current | Required |
|------------|---------|----------|
| `servicecategories` | May be empty or have 5 cats | 6 NILIN master categories |
| `services` | category: "Cleaning" | categoryId: ObjectId, subcategory: String |
| New: `subcategorysuggestions` | N/A | Provider suggestion queue |

---

## Files to Create/Modify

### New Files
1. `backend/src/routes/category.routes.ts`
2. `backend/src/controllers/category.controller.ts`
3. `backend/src/models/subcategorySuggestion.model.ts`
4. `backend/src/scripts/migrate-categories.ts`
5. `frontend/src/services/categoryApi.ts`
6. `frontend/src/hooks/useCategories.ts`

### Files to Modify
1. `backend/src/seeders/categories.seeder.ts` - Update with NILIN categories
2. `backend/src/models/service.model.ts` - Add categoryId reference
3. `backend/src/controllers/search.controller.ts` - Update category filtering
4. `backend/src/routes/index.ts` - Add category routes
5. `frontend/src/constants/categories.ts` - Deprecate, add API fetch
6. `frontend/src/pages/HomePage.tsx` - Fetch categories from API
7. `frontend/src/pages/SearchPage.tsx` - Use API categories

---

## Estimated Effort

| Phase | Description | Effort |
|-------|-------------|--------|
| Phase 1 | Database Schema Updates | 2-3 hours |
| Phase 2 | API Endpoints | 3-4 hours |
| Phase 3 | Frontend Updates | 3-4 hours |
| Phase 4 | Provider Flow | 2-3 hours |
| Phase 5 | Migration | 2-3 hours |
| **Total** | | **12-17 hours** |

---

## Next Steps

1. **Immediate:** Run the categories seeder to check current database state
2. **Short-term:** Update seeder with NILIN categories and run migration
3. **Medium-term:** Create category API endpoints
4. **Long-term:** Update frontend to fetch from API

Would you like me to proceed with implementing these changes?
