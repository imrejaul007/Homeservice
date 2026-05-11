/**
 * Test booking creation
 */
import axios from 'axios';

const BASE_URL = 'http://localhost:5000/api';

async function testBooking() {
  try {
    // Login
    console.log('1. Logging in...');
    const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'testcustomer@example.com',
      password: 'Test123456!'
    });

    const token = loginRes.data.data.tokens.accessToken;
    console.log('   Login successful!');

    // Create booking
    console.log('2. Creating booking...');
    const bookingRes = await axios.post(`${BASE_URL}/bookings`, {
      serviceId: '692ef6f9197d384def4abb78',
      providerId: '692ef6f9197d384def4abb38',
      scheduledDate: '2025-12-04',
      scheduledTime: '10:00',
      location: {
        type: 'customer_address',
        address: {
          street: '123 Test Street',
          city: 'Mumbai',
          state: 'Maharashtra',
          zipCode: '400001'
        }
      },
      customerInfo: {
        name: 'Test Customer',
        phone: '+919876543210'
      }
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('   Booking created successfully!');
    console.log('   Booking ID:', bookingRes.data.data.booking._id);
    console.log('   Status:', bookingRes.data.data.booking.status);
    console.log('\n   Full response:', JSON.stringify(bookingRes.data, null, 2));

  } catch (error: any) {
    console.error('Error:', JSON.stringify({
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      code: error.code
    }, null, 2));
  }
}

testBooking();
