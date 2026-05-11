/**
 * Manual Booking System API Testing Script
 * Run this with: node manual-booking-tests.js
 *
 * Make sure your server is running on localhost:3000
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:5000/api';
const TEST_EMAIL_CUSTOMER = 'test-customer@example.com';
const TEST_EMAIL_PROVIDER = 'test-provider@example.com';

let customerToken = '';
let providerToken = '';
let testServiceId = '';
let testProviderId = '';
let testBookingId = '';

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, success, details = '') {
  const status = success ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${name}`);
  if (details) console.log(`   ${details}`);

  results.tests.push({ name, success, details });
  if (success) results.passed++;
  else results.failed++;
}

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===================================
// AUTHENTICATION SETUP
// ===================================

async function setupTestUsers() {
  console.log('\n🔧 Logging in with existing test users...');

  try {
    // Login customer
    const customerLogin = await axios.post(`${BASE_URL}/auth/login`, {
      email: TEST_EMAIL_CUSTOMER,
      password: 'TestPass123!'
    });

    if (customerLogin.data.success) {
      customerToken = customerLogin.data.data.token;
      logTest('Customer Login', true);
    } else {
      logTest('Customer Login', false, 'No token received');
    }

    // Login provider
    const providerLogin = await axios.post(`${BASE_URL}/auth/login`, {
      email: TEST_EMAIL_PROVIDER,
      password: 'TestPass123!'
    });

    if (providerLogin.data.success) {
      providerToken = providerLogin.data.data.token;
      testProviderId = providerLogin.data.data.user._id;
      logTest('Provider Login', true);
    } else {
      logTest('Provider Login', false, 'No token received');
    }

  } catch (error) {
    logTest('Authentication Setup', false, `Could not authenticate users: ${error.response?.data?.message || error.message}`);
    return false;
  }

  return true;
}

// ===================================
// AVAILABILITY TESTS
// ===================================

async function testAvailabilitySystem() {
  console.log('\n📅 Testing Availability System...');

  try {
    // Get provider availability
    const getAvailability = await axios.get(`${BASE_URL}/availability`, {
      headers: { Authorization: `Bearer ${providerToken}` }
    });

    logTest('Get Provider Availability', getAvailability.data.success);

    // Update weekly schedule
    const updateSchedule = await axios.put(`${BASE_URL}/availability/schedule`, {
      weeklySchedule: {
        monday: {
          isAvailable: true,
          timeSlots: [
            { start: '09:00', end: '12:00', isActive: true },
            { start: '14:00', end: '18:00', isActive: true }
          ]
        },
        tuesday: {
          isAvailable: true,
          timeSlots: [{ start: '09:00', end: '17:00', isActive: true }]
        },
        wednesday: {
          isAvailable: true,
          timeSlots: [{ start: '09:00', end: '17:00', isActive: true }]
        },
        thursday: {
          isAvailable: true,
          timeSlots: [{ start: '09:00', end: '17:00', isActive: true }]
        },
        friday: {
          isAvailable: true,
          timeSlots: [{ start: '09:00', end: '17:00', isActive: true }]
        },
        saturday: { isAvailable: false, timeSlots: [] },
        sunday: { isAvailable: false, timeSlots: [] }
      }
    }, {
      headers: { Authorization: `Bearer ${providerToken}` }
    });

    logTest('Update Weekly Schedule', updateSchedule.data.success);

    // Add date override
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const addOverride = await axios.post(`${BASE_URL}/availability/override`, {
      date: tomorrow.toISOString().split('T')[0],
      isAvailable: true,
      reason: 'special_event',
      notes: 'Extended hours for special event'
    }, {
      headers: { Authorization: `Bearer ${providerToken}` }
    });

    logTest('Add Date Override', addOverride.data.success);

    // Get available slots (public endpoint)
    const getSlots = await axios.get(`${BASE_URL}/availability/provider/${testProviderId}/slots`, {
      params: {
        date: tomorrow.toISOString().split('T')[0],
        duration: 60,
        days: 3
      }
    });

    logTest('Get Available Slots', getSlots.data.success);

    // Check specific time slot
    const checkSlot = await axios.get(`${BASE_URL}/availability/provider/${testProviderId}/check`, {
      params: {
        date: tomorrow.toISOString().split('T')[0],
        time: '10:00',
        duration: 60
      }
    });

    logTest('Check Time Slot Availability', checkSlot.data.success);

  } catch (error) {
    logTest('Availability System Tests', false, error.response?.data?.message || error.message);
  }
}

// ===================================
// SERVICE SETUP
// ===================================

async function createTestService() {
  console.log('\n🏠 Creating test service...');

  try {
    // First, we need to create a service via the provider endpoints
    const serviceData = {
      name: 'Test House Cleaning',
      category: 'Cleaning',
      subcategory: 'Residential',
      description: 'Professional house cleaning service for testing',
      shortDescription: 'Test cleaning service',
      duration: 120,
      price: {
        amount: 100,
        currency: 'USD',
        type: 'fixed'
      },
      images: [],
      tags: ['cleaning', 'house', 'professional'],
      location: {
        address: {
          street: '123 Test Street',
          city: 'Test City',
          state: 'TS',
          zipCode: '12345',
          country: 'US'
        },
        serviceArea: {
          type: 'radius',
          value: 10,
          maxDistance: 25
        }
      },
      availability: {
        schedule: {
          monday: { isAvailable: true, timeSlots: ['09:00-17:00'] },
          tuesday: { isAvailable: true, timeSlots: ['09:00-17:00'] },
          wednesday: { isAvailable: true, timeSlots: ['09:00-17:00'] },
          thursday: { isAvailable: true, timeSlots: ['09:00-17:00'] },
          friday: { isAvailable: true, timeSlots: ['09:00-17:00'] },
          saturday: { isAvailable: false, timeSlots: [] },
          sunday: { isAvailable: false, timeSlots: [] }
        },
        instantBooking: false,
        advanceBookingDays: 30
      }
    };

    const createService = await axios.post(`${BASE_URL}/provider/services`, serviceData, {
      headers: { Authorization: `Bearer ${providerToken}` }
    });

    if (createService.data.success) {
      testServiceId = createService.data.data.service._id;
      logTest('Create Test Service', true);
    } else {
      logTest('Create Test Service', false, 'No service ID returned');
    }

  } catch (error) {
    logTest('Create Test Service', false, error.response?.data?.message || error.message);
  }
}

// ===================================
// BOOKING TESTS
// ===================================

async function testBookingSystem() {
  console.log('\n📋 Testing Booking System...');

  try {
    // Create a booking
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const bookingData = {
      serviceId: testServiceId,
      providerId: testProviderId,
      scheduledDate: tomorrow.toISOString().split('T')[0],
      scheduledTime: '10:00',
      location: {
        type: 'customer_address',
        address: {
          street: '456 Customer Street',
          city: 'Customer City',
          state: 'CS',
          zipCode: '67890',
          country: 'US'
        },
        notes: 'Ring the doorbell twice'
      },
      customerInfo: {
        phone: '+1234567890',
        specialRequests: 'Please focus on the kitchen and bathrooms'
      },
      addOns: [
        { name: 'Deep clean refrigerator', price: 25 }
      ]
    };

    const createBooking = await axios.post(`${BASE_URL}/bookings`, bookingData, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });

    if (createBooking.data.success) {
      testBookingId = createBooking.data.data.booking._id;
      logTest('Create Booking', true, `Booking #: ${createBooking.data.data.booking.bookingNumber}`);
    } else {
      logTest('Create Booking', false, 'No booking ID returned');
      return;
    }

    // Get customer bookings
    const customerBookings = await axios.get(`${BASE_URL}/bookings/customer`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });

    logTest('Get Customer Bookings', customerBookings.data.success);

    // Get provider bookings
    const providerBookings = await axios.get(`${BASE_URL}/bookings/provider`, {
      headers: { Authorization: `Bearer ${providerToken}` }
    });

    logTest('Get Provider Bookings', providerBookings.data.success);

    // Get booking details
    const bookingDetails = await axios.get(`${BASE_URL}/bookings/${testBookingId}`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });

    logTest('Get Booking Details', bookingDetails.data.success);

    // Provider accepts booking
    const acceptBooking = await axios.patch(`${BASE_URL}/bookings/${testBookingId}/accept`, {
      notes: 'Looking forward to providing excellent service!',
      estimatedArrival: new Date(tomorrow.getTime() + 9.5 * 60 * 60 * 1000) // 9:30 AM
    }, {
      headers: { Authorization: `Bearer ${providerToken}` }
    });

    logTest('Provider Accept Booking', acceptBooking.data.success);

    // Add message to booking
    const addMessage = await axios.post(`${BASE_URL}/bookings/${testBookingId}/messages`, {
      message: 'Hi! I have a question about the service timing.'
    }, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });

    logTest('Add Booking Message', addMessage.data.success);

    // Provider replies
    const providerReply = await axios.post(`${BASE_URL}/bookings/${testBookingId}/messages`, {
      message: 'Hello! I\'ll be happy to answer any questions you have.'
    }, {
      headers: { Authorization: `Bearer ${providerToken}` }
    });

    logTest('Provider Reply Message', providerReply.data.success);

    // Complete booking
    const completeBooking = await axios.patch(`${BASE_URL}/bookings/${testBookingId}/complete`, {
      notes: 'Service completed successfully. Customer was very satisfied!',
      actualDuration: 130
    }, {
      headers: { Authorization: `Bearer ${providerToken}` }
    });

    logTest('Complete Booking', completeBooking.data.success);

  } catch (error) {
    logTest('Booking System Tests', false, error.response?.data?.message || error.message);
  }
}

// ===================================
// VALIDATION TESTS
// ===================================

async function testValidation() {
  console.log('\n🔍 Testing Validation...');

  try {
    // Test invalid booking data
    const invalidBooking = await axios.post(`${BASE_URL}/bookings`, {
      serviceId: 'invalid-id',
      providerId: 'invalid-id',
      scheduledDate: 'invalid-date',
      scheduledTime: '25:00',
      location: {
        type: 'invalid_type'
      }
    }, {
      headers: { Authorization: `Bearer ${customerToken}` }
    }).catch(err => err.response);

    logTest('Invalid Booking Validation', invalidBooking.status === 400);

    // Test invalid availability schedule
    const invalidSchedule = await axios.put(`${BASE_URL}/availability/schedule`, {
      weeklySchedule: {
        monday: {
          timeSlots: [
            { start: 'invalid-time', end: '17:00' }
          ]
        }
      }
    }, {
      headers: { Authorization: `Bearer ${providerToken}` }
    }).catch(err => err.response);

    logTest('Invalid Schedule Validation', invalidSchedule.status === 400);

    // Test unauthorized access
    const unauthorizedAccess = await axios.get(`${BASE_URL}/bookings/provider`)
      .catch(err => err.response);

    logTest('Unauthorized Access Protection', unauthorizedAccess.status === 401);

  } catch (error) {
    logTest('Validation Tests', false, error.response?.data?.message || error.message);
  }
}

// ===================================
// ANALYTICS TESTS
// ===================================

async function testAnalytics() {
  console.log('\n📊 Testing Analytics...');

  try {
    // Get availability analytics
    const analytics = await axios.get(`${BASE_URL}/availability/analytics`, {
      headers: { Authorization: `Bearer ${providerToken}` }
    });

    logTest('Get Availability Analytics', analytics.data.success);

  } catch (error) {
    logTest('Analytics Tests', false, error.response?.data?.message || error.message);
  }
}

// ===================================
// MAIN TEST RUNNER
// ===================================

async function runAllTests() {
  console.log('🚀 Starting Booking System API Tests');
  console.log('=====================================');

  const startTime = Date.now();

  // Setup
  const authSuccess = await setupTestUsers();
  if (!authSuccess) {
    console.log('❌ Authentication setup failed. Stopping tests.');
    return;
  }

  await wait(1000); // Give server time to process

  // Run test suites
  await testAvailabilitySystem();
  await wait(500);

  await createTestService();
  await wait(500);

  if (testServiceId) {
    await testBookingSystem();
    await wait(500);
  }

  await testValidation();
  await wait(500);

  await testAnalytics();

  // Results
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  console.log('\n📊 TEST RESULTS');
  console.log('================');
  console.log(`Total Tests: ${results.passed + results.failed}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`⏱️  Duration: ${duration}s`);

  if (results.failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.tests
      .filter(test => !test.success)
      .forEach(test => {
        console.log(`   - ${test.name}: ${test.details}`);
      });
  }

  const successRate = ((results.passed / (results.passed + results.failed)) * 100).toFixed(1);
  console.log(`\n🎯 Success Rate: ${successRate}%`);

  if (results.failed === 0) {
    console.log('\n🎉 All tests passed! Booking system is ready for frontend development.');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the errors above.');
  }
}

// Run the tests
runAllTests().catch(error => {
  console.error('❌ Test runner failed:', error.message);
  process.exit(1);
});