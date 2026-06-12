/**
 * Booking Flow Audit Workflow
 *
 * Comprehensive audit of booking functionality including:
 * - Frontend button handlers and navigation
 * - Backend API endpoints and route matching
 * - Database collection/model mismatches
 * - Data format consistency (backend ↔ frontend)
 * - Provider availability and schedule
 * - End-to-end flow testing
 *
 * Usage: /workflow booking-flow-audit.wf.ts [page-path]
 * Example: /workflow booking-flow-audit.wf.ts /packages/6a2292c96511012b7d4e637b
 */

export const meta = {
  name: 'booking-flow-audit',
  description: 'Comprehensive audit of booking flow: buttons, APIs, data mapping, database state',
  phases: [
    'Discover',
    'RouteAnalysis',
    'APICheck',
    'DataMapping',
    'DatabaseCheck',
    'AvailabilityCheck',
    'FixIssues',
    'Report'
  ],
};

// ============================================================
// PHASE 1: Discover - Find all booking-related files
// ============================================================

phase('Discover');

const discoverResult = await agent(`
Find ALL files related to the booking flow being audited.

Priority search areas:
1. Package detail pages (PackageDetailPage.tsx, BookPackagePage.tsx)
2. Booking wizard components (PackageBookingWizard.tsx)
3. Booking store (bookingStore.ts)
4. Package API services (packageApi.ts, packageBookingApi.ts)
5. Backend booking routes (booking.routes.ts, packages.public.routes.ts)
6. Booking controllers (packageBooking.controller.ts, availability.controller.ts)
7. Bundle/Service models

For each file, identify:
- Button click handlers (onClick, handleBook, navigate)
- API calls made
- State management
- Data format expectations
- Error handling

Map the complete booking flow:
- User clicks "Book Now" or "Book Entire Package"
- Which function is called?
- What API endpoint is hit?
- What data is sent?
- What response is expected?
- How is the response processed?

Report with a COMPLETE flow diagram showing all steps.
`, {schema: {
  type: 'object',
  properties: {
    files: { type: 'array', items: { type: 'string' } },
    flowSteps: { type: 'array', items: { type: 'object' } },
    buttonHandlers: { type: 'array', items: { type: 'object' } },
    apiEndpoints: { type: 'array', items: { type: 'string' } },
    issues: { type: 'array', items: { type: 'string' } }
  }
}});

// ============================================================
// PHASE 2: Route Analysis - Verify routes exist and match
// ============================================================

phase('RouteAnalysis');

const routeResult = await agent(`
Analyze ALL routes related to the booking flow.

Check:
1. Frontend routes (App.tsx):
   - /book-package/:id
   - /book/:serviceId
   - /packages/:id
   - /track/:bookingNumber

2. Backend routes:
   - POST /api/packages/:id/book-package
   - POST /api/packages/book-package
   - GET /api/packages/:id
   - GET /api/booking/availability/provider/:providerId/slots

3. Verify route handlers exist and are properly exported

4. Check for route matching issues:
   - Specific routes before parameterized routes (/:id/print before /:id)
   - Correct HTTP methods (GET, POST, PUT, DELETE)
   - Middleware order (auth before validation)

Report any missing routes, wrong methods, or matching issues.
`, {schema: {
  type: 'object',
  properties: {
    frontendRoutes: { type: 'array' },
    backendRoutes: { type: 'array' },
    issues: { type: 'array' }
  }
}});

// ============================================================
// PHASE 3: API Contract Check - Frontend ↔ Backend data mapping
// ============================================================

phase('APICheck');

const apiResult = await agent(`
Compare frontend API calls with backend API responses.

For each API endpoint in the booking flow:

1. Frontend Request:
   - What fields are sent?
   - What types are expected?
   - Field names (camelCase vs snake_case)

2. Backend Request Validation (Joi schema):
   - What fields are required?
   - What fields are optional?
   - Validation rules

3. Backend Response:
   - What fields are returned?
   - Field names (camelCase vs snake_case)
   - Nested objects vs flat structures

4. Common mismatches to check:
   - serviceId vs _id
   - serviceName vs name
   - originalPrice vs price (number vs { amount: number })
   - duration missing or in wrong place
   - providerId vs provider._id

Check these specific endpoints:
- GET /api/packages/:id (getPackageById)
- POST /api/packages/:id/book-package (bookPackage)
- POST /api/packages/book-package
- GET /api/booking/availability/provider/:providerId/slots

Report all data format mismatches between frontend and backend.
`, {schema: {
  type: 'object',
  properties: {
    mismatches: { type: 'array', items: { type: 'object' } },
    frontendTypes: { type: 'object' },
    backendTypes: { type: 'object' }
  }
}});

// ============================================================
// PHASE 4: Database Collection Check - Service vs Bundle
// ============================================================

phase('DataMapping');

const dbResult = await agent(`
Check for Collection/Model mismatches in the booking flow.

The bug: "packages" data is stored in the BUNDLE collection, but some code incorrectly queries the SERVICE collection.

Search for:
1. Controllers that query Service model for package data:
   - packageBooking.controller.ts
   - packageComparison.controller.ts
   - customerDashboard.controller.ts

2. Functions that have "package" in their name but query Service:
   - getPackageById
   - printPackageDetails
   - bookPackage
   - comparePackages

3. Check if these fields exist in Service vs Bundle model:
   - basePrice / bundlePrice / discountedPrice
   - services[] (array of service references)
   - providerId (direct reference)

4. Verify the correct model is used:
   - Packages/Bundles → Bundle model
   - Individual services → Service model

Report all Collection mismatches with file paths and line numbers.
`, {schema: {
  type: 'object',
  properties: {
    mismatches: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          function: { type: 'string' },
          line: { type: 'number' },
          issue: { type: 'string' },
          fix: { type: 'string' }
        }
      }
    }
  }
}});

// ============================================================
// PHASE 5: Database State Check - Provider availability
// ============================================================

phase('DatabaseCheck');

const dbStateResult = await agent(`
Check MongoDB for data consistency issues.

1. Find provider for a test package:
   - Query Bundle collection for the package
   - Get providerId from bundle
   - Get provider user details

2. Check provider profile for availability:
   - Query ProviderProfile collection
   - Check 'availability.schedule' exists
   - Check time slots are set up correctly (individual 30-min slots)
   - Check provider has services assigned

3. Check for common issues:
   - workingHours/availability.schedule NOT SET
   - Time slots are large blocks (3+ hours) instead of 30-min slots
   - Provider has 0 services
   - Provider isActive = false

4. Check Bundle/Service relationship:
   - Bundle has services[] array
   - Each service has serviceName, originalPrice
   - Duration is set (default to 60 if missing)

Run diagnostic queries against MongoDB and report findings.
`, {schema: {
  type: 'object',
  properties: {
    provider: { type: 'object' },
    availability: { type: 'object' },
    issues: { type: 'array' },
    migrations: { type: 'array' }
  }
}});

// ============================================================
// PHASE 6: Availability System Check
// ============================================================

phase('AvailabilityCheck');

const availabilityResult = await agent(`
Analyze the availability calculation system.

1. Check availability.controller.ts:
   - How are time slots calculated?
   - How is slot availability determined?
   - What happens when duration > available slots?

2. Check the slot calculation logic:
   - For a 240-min package (4 hours), how many 30-min slots needed? (8 slots)
   - Are there enough contiguous free slots?
   - Is the provider's schedule set up for this?

3. Check for common issues:
   - Large time slot blocks (3h, 5h) instead of 30-min slots
   - No buffer time between bookings
   - minBookingAdvanceHours blocking all slots
   - Date being validated incorrectly (timezone issues)

4. Verify slot structure:
   - Each slot should be 30 minutes
   - Each slot should have: startTime, endTime, isBooked, maxBookings
   - Slots should be contiguous (09:00-09:30, 09:30-10:00, etc.)

Report availability calculation issues and suggest fixes.
`, {schema: {
  type: 'object',
  properties: {
    issues: { type: 'array' },
    recommendations: { type: 'array' }
  }
}});

// ============================================================
// PHASE 7: Fix Issues (Parallel by Priority)
// ============================================================

phase('FixIssues');

// Fix critical issues first
const criticalFetches = [];

// Fix Collection mismatches
for (const mismatch of dbResult.mismatches || []) {
  criticalFetches.push(
    agent(`Fix Collection mismatch in ${mismatch.file}

    Function: ${mismatch.function}
    Line: approximately ${mismatch.line}

    Issue: ${mismatch.issue}

    Fix: ${mismatch.fix}

    Make the necessary code changes to use Bundle model instead of Service model
    for package-related queries.`, {schema: { type: 'object' }})
  );
}

// Fix API data mapping issues
for (const mismatch of apiResult.mismatches || []) {
  criticalFetches.push(
    agent(`Fix API data mapping mismatch: ${mismatch.endpoint}

    Issue: ${mismatch.description}

    Fix the code to properly map between frontend and backend data formats.
    Either update the backend to return consistent field names, or update
    the frontend to handle both formats.`, {schema: { type: 'object' }})
  );
}

// Run all critical fixes in parallel
const criticalFixes = await parallel(...criticalFetches);

// Generate migration scripts for database issues
const migrationScripts = [];

if (dbStateResult.issues?.includes('time_slots_large_blocks')) {
  migrationScripts.push(`
  Create a migration script that:
  1. Finds all providers with large time slot blocks
  2. Replaces them with individual 30-minute slots
  3. Runs updateOne with { runValidators: false } to bypass validation
  4. Verifies the fix
  `);
}

if (dbStateResult.issues?.includes('missing_services')) {
  migrationScripts.push(`
  Create a migration script that:
  1. Finds all providers without assigned services
  2. Assigns services from the Service collection
  3. Updates the provider profile
  `);
}

// ============================================================
// PHASE 8: Report
// ============================================================

phase('Report');

const report = {
  summary: {
    filesAnalyzed: discoverResult.files?.length || 0,
    flowStepsTraced: discoverResult.flowSteps?.length || 0,
    issuesFound: [
      ...(dbResult.mismatches || []),
      ...(apiResult.mismatches || []),
      ...(dbStateResult.issues || []),
      ...(availabilityResult.issues || [])
    ].length,
    issuesFixed: criticalFixes.length,
    migrationsCreated: migrationScripts.length
  },

  criticalIssues: {
    collectionMismatches: dbResult.mismatches || [],
    apiMismatches: apiResult.mismatches || []
  },

  databaseIssues: {
    providerAvailability: dbStateResult.issues || [],
    dataConsistency: []
  },

  availabilityIssues: availabilityResult.issues || [],

  fixes: criticalFixes,

  migrations: migrationScripts,

  recommendations: [
    ...(availabilityResult.recommendations || []),
    "Ensure all providers have working hours set up",
    "Ensure time slots are individual 30-minute intervals",
    "Ensure packages (bundles) have duration set for each service",
    "Keep field naming consistent: serviceId/_id, serviceName/name"
  ]
};

return report;
