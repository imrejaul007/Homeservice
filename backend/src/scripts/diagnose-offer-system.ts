/**
 * Offer System Diagnostic Script
 *
 * Analyzes the complete offer system to identify issues with:
 * 1. Offer data integrity
 * 2. Service/category linking
 * 3. API response format
 * 4. Frontend/backend field name mismatches
 * 5. Route configuration issues
 *
 * Run: cd backend && npx ts-node src/scripts/diagnose-offer-system.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Coupon from '../models/coupon.model';
import Service from '../models/service.model';
import ServiceCategory from '../models/serviceCategory.model';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface DiagnosticResult {
  offers: {
    total: number;
    active: number;
    inactive: number;
    expired: number;
    featured: number;
    withServices: number;
    withCategories: number;
    withoutAnyLink: number;
  };
  issues: {
    type: 'error' | 'warning' | 'info';
    location: string;
    description: string;
    recommendation: string;
  }[];
  fieldMappings: {
    backend: string;
    frontend: string;
    notes: string;
  }[];
  routeAnalysis: {
    route: string;
    method: string;
    handler: string;
    issues: string[];
  }[];
}

async function runDiagnostic(): Promise<DiagnosticResult> {
  const mongoUri = process.env.MONGODB_URI || '';
  console.log('🔍 Starting Offer System Diagnostic...\n');
  console.log('═'.repeat(60));

  await mongoose.connect(mongoUri);

  const result: DiagnosticResult = {
    offers: {
      total: 0,
      active: 0,
      inactive: 0,
      expired: 0,
      featured: 0,
      withServices: 0,
      withCategories: 0,
      withoutAnyLink: 0,
    },
    issues: [],
    fieldMappings: [],
    routeAnalysis: [],
  };

  // ============================================
  // 1. ANALYZE OFFER DATA
  // ============================================
  console.log('\n📊 STEP 1: Analyzing Offer Data...\n');

  const offers = await Coupon.find({}).lean();
  result.offers.total = offers.length;

  const now = new Date();

  for (const offer of offers) {
    const o = offer as any;

    // Check status
    if (o.isActive) result.offers.active++;
    else result.offers.inactive++;

    // Check expiration
    const validUntil = new Date(o.validUntil);
    if (validUntil < now) result.offers.expired++;

    // Check featured
    if (o.featured) result.offers.featured++;

    // Check service linking (two possible field names)
    const hasTargetServices = o.targetServices && o.targetServices.length > 0;
    const hasApplicableServices = o.applicableServices && o.applicableServices.length > 0;
    const hasTargetCategories = o.targetCategories && o.targetCategories.length > 0;
    const hasApplicableCategories = o.applicableCategories && o.applicableCategories.length > 0;

    if (hasTargetServices || hasApplicableServices) result.offers.withServices++;
    if (hasTargetCategories || hasApplicableCategories) result.offers.withCategories++;
    if (!hasTargetServices && !hasApplicableServices && !hasTargetCategories && !hasApplicableCategories) {
      result.offers.withoutAnyLink++;
    }

    // Log each offer
    console.log(`  📦 ${o.displayTitle || o.title}`);
    console.log(`     Code: ${o.code}`);
    console.log(`     Type: ${o.type} (${o.value})`);
    console.log(`     Status: ${o.isActive ? '🟢 Active' : '🔴 Inactive'}`);
    if (validUntil < now) console.log(`     ⚠️ EXPIRED (${validUntil.toLocaleDateString()})`);
    console.log(`     Services: ${hasTargetServices ? `targetServices[${o.targetServices.length}]` : hasApplicableServices ? `applicableServices[${o.applicableServices.length}]` : '❌ None'}`);
    console.log(`     Categories: ${hasTargetCategories ? `targetCategories[${o.targetCategories.length}]` : hasApplicableCategories ? `applicableCategories[${o.applicableCategories.length}]` : '❌ None'}`);
    console.log('');
  }

  // ============================================
  // 2. CHECK SERVICE/CATEGORY EXISTENCE
  // ============================================
  console.log('═'.repeat(60));
  console.log('\n📊 STEP 2: Validating Service/Category Links...\n');

  const services = await Service.find({}).select('_id name').lean();
  const categories = await ServiceCategory.find({}).select('_id name').lean();

  const serviceIds = new Set(services.map((s: any) => s._id.toString()));
  const categoryIds = new Set(categories.map((c: any) => c._id.toString()));

  console.log(`  Total services in DB: ${services.length}`);
  console.log(`  Total categories in DB: ${categories.length}`);

  for (const offer of offers) {
    const o = offer as any;

    // Check targetServices
    if (o.targetServices && o.targetServices.length > 0) {
      for (const serviceId of o.targetServices) {
        const idStr = serviceId.toString();
        if (!serviceIds.has(idStr)) {
          result.issues.push({
            type: 'error',
            location: `Offer: ${o.code}`,
            description: `Linked service "${idStr}" does not exist`,
            recommendation: 'Remove invalid service ID or create the service'
          });
          console.log(`  ❌ ${o.code}: Invalid service link "${idStr}"`);
        }
      }
    }

    // Check applicableServices (legacy field)
    if (o.applicableServices && o.applicableServices.length > 0) {
      for (const serviceId of o.applicableServices) {
        if (!serviceIds.has(serviceId.toString())) {
          result.issues.push({
            type: 'warning',
            location: `Offer: ${o.code}`,
            description: `Legacy applicableServices field has invalid ID "${serviceId}"`,
            recommendation: 'Migrate applicableServices to targetServices field'
          });
          console.log(`  ⚠️ ${o.code}: Legacy applicableServices has invalid ID "${serviceId}"`);
        }
      }
    }

    // Check targetCategories
    if (o.targetCategories && o.targetCategories.length > 0) {
      for (const catId of o.targetCategories) {
        if (!categoryIds.has(catId.toString())) {
          result.issues.push({
            type: 'error',
            location: `Offer: ${o.code}`,
            description: `Linked category "${catId}" does not exist`,
            recommendation: 'Remove invalid category ID or create the category'
          });
          console.log(`  ❌ ${o.code}: Invalid category link "${catId}"`);
        }
      }
    }
  }

  // ============================================
  // 3. FIELD MAPPING ANALYSIS
  // ============================================
  console.log('═'.repeat(60));
  console.log('\n📊 STEP 3: Field Mapping Analysis (Backend → Frontend)...\n');

  result.fieldMappings = [
    {
      backend: 'targetServices',
      frontend: 'applicableServices',
      notes: 'Backend uses targetServices, frontend expects applicableServices'
    },
    {
      backend: 'targetCategories',
      frontend: 'applicableCategories',
      notes: 'Backend uses targetCategories, frontend expects applicableCategories'
    },
    {
      backend: 'offer._id',
      frontend: 'offerId',
      notes: 'Claim response uses _id, some code expects offerId'
    },
    {
      backend: 'price.amount',
      frontend: 'service.price',
      notes: 'Service price field structure differs'
    },
    {
      backend: 'services[].serviceName',
      frontend: 'services[].name',
      notes: 'Bundle services use serviceName, frontend expects name'
    }
  ];

  for (const mapping of result.fieldMappings) {
    console.log(`  ${mapping.backend} → ${mapping.frontend}`);
    console.log(`     ${mapping.notes}\n`);
  }

  // ============================================
  // 4. OFFER DETAIL API RESPONSE ANALYSIS
  // ============================================
  console.log('═'.repeat(60));
  console.log('\n📊 STEP 4: Offer Detail Page Flow Analysis...\n');

  // Simulate what getOfferById returns
  const sampleOffer = offers[0] as any;
  if (sampleOffer) {
    console.log(`  Analyzing offer: ${sampleOffer.displayTitle || sampleOffer.title}\n`);

    // Check what the aggregation returns
    const hasTargetServices = sampleOffer.targetServices && sampleOffer.targetServices.length > 0;
    const hasTargetCategories = sampleOffer.targetCategories && sampleOffer.targetCategories.length > 0;

    console.log('  Backend getOfferById returns:');
    console.log('    - applicableServices: (populated service objects from targetServices lookup)');
    console.log('    - applicableCategories: (populated category objects from targetCategories lookup)');
    console.log('    - Does NOT return: code (public endpoint hides it)');

    if (!hasTargetServices && !hasTargetCategories) {
      result.issues.push({
        type: 'info',
        location: 'OfferDetailPage.tsx',
        description: 'Offer has no services or categories linked - will show "Browse all services" message',
        recommendation: 'Link services/categories to the offer to display relevant services'
      });
      console.log('  ⚠️ This offer has no services/categories linked');
      console.log('     Frontend will show "Browse all services" instead of linked services');
    }
  }

  // ============================================
  // 5. ADMIN PANEL FLOW ANALYSIS
  // ============================================
  console.log('═'.repeat(60));
  console.log('\n📊 STEP 5: Admin Panel Service/Category Selector...\n');

  // Check admin API response structure
  console.log('  Admin GET /api/admin/services returns:');
  console.log('    - data.services: Array of service objects');
  console.log('    - Pagination included');

  console.log('\n  Admin GET /api/admin/categories returns:');
  console.log('    - data.categories: Array of category objects');

  // Check if services/categories are actually loaded
  console.log('\n  ⚠️ POTENTIAL ISSUE: If services/categories show as "0" in selector:');
  console.log('     1. Check if admin API is returning correct format');
  console.log('     2. Check if pagination params are correct');
  console.log('     3. Verify JWT token has admin role');

  // ============================================
  // 6. ROUTE CONFIGURATION ANALYSIS
  // ============================================
  console.log('═'.repeat(60));
  console.log('\n📊 STEP 6: Route Order Analysis...\n');

  result.routeAnalysis = [
    {
      route: '/api/offers/:id',
      method: 'GET',
      handler: 'getOfferById',
      issues: []
    },
    {
      route: '/api/offers/:id/view',
      method: 'POST',
      handler: 'incrementViewCount',
      issues: ['⚠️ ROUTE ORDER ISSUE: /:id/print would match /:id before /:id/view!']
    },
    {
      route: '/api/offers/admin/:id',
      method: 'PUT',
      handler: 'updateOffer',
      issues: ['⚠️ ROUTE ORDER ISSUE: /admin/:id/archive defined AFTER /admin/:id']
    }
  ];

  for (const route of result.routeAnalysis) {
    console.log(`  ${route.method} ${route.route}`);
    console.log(`     Handler: ${route.handler}`);
    if (route.issues.length > 0) {
      for (const issue of route.issues) {
        console.log(`     ${issue}`);
      }
    }
    console.log('');
  }

  // ============================================
  // SUMMARY
  // ============================================
  console.log('═'.repeat(60));
  console.log('\n📊 DIAGNOSTIC SUMMARY\n');

  console.log(`  Total Offers: ${result.offers.total}`);
  console.log(`    - Active: ${result.offers.active}`);
  console.log(`    - Inactive: ${result.offers.inactive}`);
  console.log(`    - Expired: ${result.offers.expired}`);
  console.log(`    - Featured: ${result.offers.featured}`);
  console.log(`    - With Services: ${result.offers.withServices}`);
  console.log(`    - With Categories: ${result.offers.withCategories}`);
  console.log(`    - Without Links: ${result.offers.withoutAnyLink}`);

  console.log(`\n  Total Issues Found: ${result.issues.length}`);
  const errors = result.issues.filter(i => i.type === 'error').length;
  const warnings = result.issues.filter(i => i.type === 'warning').length;
  const infos = result.issues.filter(i => i.type === 'info').length;
  console.log(`    - Errors: ${errors}`);
  console.log(`    - Warnings: ${warnings}`);
  console.log(`    - Info: ${infos}`);

  if (result.issues.length > 0) {
    console.log('\n  🔧 Issues Detail:');
    result.issues.forEach((issue, i) => {
      console.log(`\n  ${i + 1}. [${issue.type.toUpperCase()}] ${issue.location}`);
      console.log(`     ${issue.description}`);
      console.log(`     → ${issue.recommendation}`);
    });
  }

  // ============================================
  // QUICK FIX RECOMMENDATIONS
  // ============================================
  console.log('\n' + '═'.repeat(60));
  console.log('\n🔧 QUICK FIX RECOMMENDATIONS\n');

  console.log('1. IF OFFERS SHOW BUT SERVICES DON\'T LOAD:');
  console.log('   - Check browser console for API errors');
  console.log('   - Verify /api/search/services/batch endpoint works');
  console.log('   - Ensure offer has applicableServices or applicableCategories set');

  console.log('\n2. IF COPY CODE BUTTON DOESN\'T WORK:');
  console.log('   - Check browser clipboard API permissions');
  console.log('   - Verify offer.code is returned in API response');
  console.log('   - Public endpoint GET /api/offers/:id DOES NOT return code!');

  console.log('\n3. IF ADMIN SERVICE SELECTOR SHOWS "0 services":');
  console.log('   - Check if /api/admin/services returns data');
  console.log('   - Verify admin token has correct role');
  console.log('   - Check pagination params: ?limit=100&page=1');

  console.log('\n4. IF OFFERS DON\'T APPEAR ON HOMEPAGE:');
  console.log('   - Check isActive = true');
  console.log('   - Check validFrom <= now <= validUntil');
  console.log('   - Check currentUses < maxUses');

  console.log('\n' + '═'.repeat(60));

  await mongoose.disconnect();
  console.log('\n✨ Diagnostic complete!\n');

  return result;
}

// Run diagnostic
runDiagnostic().catch(err => {
  console.error('❌ Diagnostic failed:', err);
  process.exit(1);
});
