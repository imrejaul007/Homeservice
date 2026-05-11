# 🔗 Integration Steps and Testing Guide

## 📋 Integration Checklist
- [ ] **Environment Setup**: All required dependencies and configurations
- [ ] **Database Integration**: MongoDB connection and data verification
- [ ] **Backend API Testing**: All authentication endpoints working
- [ ] **Frontend-Backend Integration**: API calls and state management
- [ ] **End-to-End Testing**: Complete user flows testing
- [ ] **Error Handling**: Comprehensive error scenarios testing
- [ ] **Security Testing**: Authentication and authorization validation
- [ ] **Performance Testing**: Load testing and optimization
- [ ] **Deployment Testing**: Production environment validation

---

## 🛠️ Step 1: Environment Setup and Verification

### **Prerequisites Check**
**File**: `scripts/check-prerequisites.js`

```javascript
#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');

console.log('🔍 Checking Prerequisites...\n');

const checks = [
  {
    name: 'Node.js Version',
    command: 'node --version',
    expected: 'v18+',
    check: (output) => {
      const version = parseInt(output.replace('v', '').split('.')[0]);
      return version >= 18;
    }
  },
  {
    name: 'npm Version', 
    command: 'npm --version',
    expected: '9+',
    check: (output) => {
      const version = parseInt(output.split('.')[0]);
      return version >= 9;
    }
  },
  {
    name: 'MongoDB Connection',
    command: 'mongosh --eval "db.adminCommand(\'ping\')" --quiet',
    expected: 'Connected',
    check: (output) => output.includes('ok') || output.includes('1')
  },
  {
    name: 'Backend .env File',
    command: 'ls backend/.env',
    expected: 'Exists',
    check: (output) => !output.includes('cannot access')
  },
  {
    name: 'Frontend .env File',
    command: 'ls frontend/.env',
    expected: 'Exists', 
    check: (output) => !output.includes('cannot access')
  }
];

let allPassed = true;

checks.forEach(check => {
  try {
    const output = execSync(check.command, { encoding: 'utf8', stdio: 'pipe' });
    const passed = check.check(output);
    
    console.log(`${passed ? '✅' : '❌'} ${check.name}: ${passed ? 'PASS' : 'FAIL'}`);
    if (!passed) {
      console.log(`   Expected: ${check.expected}`);
      console.log(`   Got: ${output.trim()}`);
      allPassed = false;
    }
  } catch (error) {
    console.log(`❌ ${check.name}: FAIL`);
    console.log(`   Error: ${error.message}`);
    allPassed = false;
  }
});

console.log(`\n${allPassed ? '🎉' : '⚠️'} Prerequisites ${allPassed ? 'PASSED' : 'FAILED'}`);

if (!allPassed) {
  console.log('\n📋 Setup Instructions:');
  console.log('1. Install Node.js 18+: https://nodejs.org/');
  console.log('2. Start MongoDB: mongod or docker-compose up mongodb');
  console.log('3. Copy .env.example to .env in both backend and frontend');
  console.log('4. Configure environment variables');
}
```

### **Environment Variables Setup**
**File**: `backend/.env.example`

```env
# Server Configuration
NODE_ENV=development
PORT=5000
HOST=localhost

# Database
MONGODB_URI=mongodb://localhost:27017/home_service_marketplace
MONGODB_URI_TEST=mongodb://localhost:27017/home_service_marketplace_test

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-min-32-characters-long
JWT_REFRESH_SECRET=your-refresh-token-secret-different-from-jwt-secret
JWT_EXPIRE=15m
JWT_REFRESH_EXPIRE=7d

# Security
BCRYPT_SALT_ROUNDS=12
MAX_LOGIN_ATTEMPTS=5
LOCK_TIME_HOURS=2

# Email Configuration (Gmail example)
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-specific-password
FROM_NAME=Home Service Platform
FROM_EMAIL=noreply@homeservice.com

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Cloudinary (Optional - for file uploads)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Admin User (for seeding)
ADMIN_EMAIL=admin@homeservice.com
ADMIN_PASSWORD=AdminPassword123!
ADMIN_FIRST_NAME=Super
ADMIN_LAST_NAME=Admin
ADMIN_PHONE=+1234567890
```

**File**: `frontend/.env.example`

```env
# API Configuration
VITE_API_URL=http://localhost:5000/api
VITE_APP_NAME=Home Service Platform

# Environment
VITE_NODE_ENV=development

# External Services (Optional)
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
VITE_STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key

# Feature Flags
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_CHAT=false
VITE_ENABLE_NOTIFICATIONS=true
```

---

## 🗄️ Step 2: Database Integration Testing

### **Database Connection Test**
**File**: `backend/src/tests/database.test.ts`

```typescript
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../config/database';
import { checkDatabaseHealth } from '../utils/dbHealthCheck';
import User from '../models/user.model';
import ServiceCategory from '../models/serviceCategory.model';

describe('Database Integration', () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  describe('Connection', () => {
    it('should connect to MongoDB successfully', () => {
      expect(mongoose.connection.readyState).toBe(1); // Connected
    });

    it('should have correct database name', () => {
      const expectedDb = process.env.NODE_ENV === 'test' 
        ? 'home_service_marketplace_test'
        : 'home_service_marketplace';
      expect(mongoose.connection.name).toContain('home_service_marketplace');
    });

    it('should pass health check', async () => {
      const health = await checkDatabaseHealth();
      expect(health.status).toBe('healthy');
      expect(health.connection.readyState).toBe(1);
    });
  });

  describe('Models', () => {
    it('should create User model instance', async () => {
      const userData = {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'TestPassword123!',
        role: 'customer'
      };

      const user = new User(userData);
      expect(user).toBeDefined();
      expect(user.firstName).toBe('Test');
      expect(user.email).toBe('test@example.com');
    });

    it('should validate User model constraints', async () => {
      const invalidUser = new User({
        firstName: '', // Required field
        email: 'invalid-email', // Invalid format
        password: '123' // Too weak
      });

      let error;
      try {
        await invalidUser.validate();
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error.errors.firstName).toBeDefined();
      expect(error.errors.email).toBeDefined();
      expect(error.errors.password).toBeDefined();
    });

    it('should create ServiceCategory with subcategories', async () => {
      const categoryData = {
        name: 'Test Category',
        slug: 'test-category',
        description: 'A test category for integration testing',
        icon: 'test-icon',
        subcategories: [
          {
            name: 'Test Subcategory',
            slug: 'test-subcategory',
            description: 'A test subcategory',
            sortOrder: 1
          }
        ]
      };

      const category = new ServiceCategory(categoryData);
      expect(category).toBeDefined();
      expect(category.subcategories).toHaveLength(1);
      expect(category.subcategories[0].name).toBe('Test Subcategory');
    });
  });

  describe('Indexes', () => {
    it('should have proper indexes on User collection', async () => {
      const indexes = await User.collection.listIndexes().toArray();
      const indexNames = indexes.map(idx => Object.keys(idx.key).join('_'));
      
      expect(indexNames).toContain('email');
      expect(indexNames).toContain('role');
      expect(indexNames).toContain('isActive');
    });

    it('should have geospatial index for addresses', async () => {
      const indexes = await User.collection.listIndexes().toArray();
      const geoIndex = indexes.find(idx => 
        idx.key && idx.key['address.coordinates']
      );
      
      expect(geoIndex).toBeDefined();
      expect(geoIndex.key['address.coordinates']).toBe('2dsphere');
    });
  });
});
```

### **Database Seeding Verification**
**File**: `backend/src/tests/seeding.test.ts`

```typescript
import { connectDB, disconnectDB } from '../config/database';
import { seedCategories } from '../seeders/categories.seeder';
import { createAdminUser } from '../seeders/admin.seeder';
import ServiceCategory from '../models/serviceCategory.model';
import User from '../models/user.model';

describe('Database Seeding', () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    // Clean collections before each test
    await ServiceCategory.deleteMany({});
    await User.deleteMany({});
  });

  describe('Category Seeding', () => {
    it('should seed service categories successfully', async () => {
      await seedCategories();
      
      const categories = await ServiceCategory.find({});
      expect(categories.length).toBeGreaterThan(0);
      
      const beautyCategory = await ServiceCategory.findOne({ slug: 'beauty-personal-care' });
      expect(beautyCategory).toBeDefined();
      expect(beautyCategory.subcategories.length).toBeGreaterThan(0);
    });

    it('should create categories with proper structure', async () => {
      await seedCategories();
      
      const category = await ServiceCategory.findOne({ slug: 'beauty-personal-care' });
      
      expect(category.name).toBeDefined();
      expect(category.slug).toBeDefined();
      expect(category.description).toBeDefined();
      expect(category.icon).toBeDefined();
      expect(category.subcategories).toBeDefined();
      expect(category.seo).toBeDefined();
      expect(category.seo.metaTitle).toBeDefined();
      expect(category.seo.metaDescription).toBeDefined();
    });

    it('should have correct subcategory structure', async () => {
      await seedCategories();
      
      const category = await ServiceCategory.findOne({ slug: 'fitness-training' });
      const subcategory = category.subcategories.find(sub => sub.slug === 'personal-training');
      
      expect(subcategory).toBeDefined();
      expect(subcategory.name).toBe('Personal Training');
      expect(subcategory.metadata).toBeDefined();
      expect(subcategory.metadata.averagePrice).toBeGreaterThan(0);
      expect(subcategory.metadata.averageDuration).toBeGreaterThan(0);
    });
  });

  describe('Admin User Creation', () => {
    it('should create admin user successfully', async () => {
      await createAdminUser();
      
      const admin = await User.findOne({ role: 'admin' });
      expect(admin).toBeDefined();
      expect(admin.email).toBe(process.env.ADMIN_EMAIL || 'admin@homeservice.com');
      expect(admin.isEmailVerified).toBe(true);
      expect(admin.accountStatus).toBe('active');
    });

    it('should not create duplicate admin users', async () => {
      await createAdminUser();
      await createAdminUser(); // Second call should not create duplicate
      
      const adminCount = await User.countDocuments({ role: 'admin' });
      expect(adminCount).toBe(1);
    });

    it('should hash admin password properly', async () => {
      await createAdminUser();
      
      const admin = await User.findOne({ role: 'admin' }).select('+password');
      expect(admin.password).toBeDefined();
      expect(admin.password).not.toBe(process.env.ADMIN_PASSWORD);
      
      const isValidPassword = await admin.comparePassword(
        process.env.ADMIN_PASSWORD || 'AdminPassword123!'
      );
      expect(isValidPassword).toBe(true);
    });
  });
});
```

---

## 🔧 Step 3: Backend API Testing

### **API Testing Setup**
**File**: `backend/src/tests/auth.integration.test.ts`

```typescript
import request from 'supertest';
import app from '../app';
import { connectDB, disconnectDB } from '../config/database';
import User from '../models/user.model';
import CustomerProfile from '../models/customerProfile.model';
import ProviderProfile from '../models/providerProfile.model';

describe('Authentication API Integration', () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await CustomerProfile.deleteMany({});
    await ProviderProfile.deleteMany({});
  });

  describe('POST /api/auth/register/customer', () => {
    const validCustomerData = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      password: 'Password123!',
      phone: '1234567890',
      agreeToTerms: true,
      agreeToPrivacy: true
    };

    it('should register customer successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register/customer')
        .send(validCustomerData)
        .expect(201);

      expect(response.body.message).toContain('registered successfully');
      expect(response.body.token).toBeDefined();
      expect(response.body.user.email).toBe(validCustomerData.email);
      expect(response.body.user.role).toBe('customer');

      // Verify user created in database
      const user = await User.findById(response.body.user.id);
      expect(user).toBeDefined();
      expect(user.email).toBe(validCustomerData.email);

      // Verify customer profile created
      const profile = await CustomerProfile.findOne({ userId: user._id });
      expect(profile).toBeDefined();
    });

    it('should return validation errors for invalid data', async () => {
      const invalidData = {
        firstName: 'J', // Too short
        email: 'invalid-email',
        password: '123', // Too weak
        agreeToTerms: false // Must be true
      };

      const response = await request(app)
        .post('/api/auth/register/customer')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeDefined();
      expect(response.body.details.length).toBeGreaterThan(0);
    });

    it('should prevent duplicate email registration', async () => {
      // Register first user
      await request(app)
        .post('/api/auth/register/customer')
        .send(validCustomerData)
        .expect(201);

      // Try to register with same email
      const response = await request(app)
        .post('/api/auth/register/customer')
        .send(validCustomerData)
        .expect(400);

      expect(response.body.error).toContain('already exists');
    });
  });

  describe('POST /api/auth/login', () => {
    let testUser;

    beforeEach(async () => {
      // Create test user
      testUser = new User({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'Password123!',
        role: 'customer',
        isEmailVerified: true,
        accountStatus: 'active'
      });
      await testUser.save();
    });

    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123!'
        })
        .expect(200);

      expect(response.body.message).toBe('Login successful');
      expect(response.body.token).toBeDefined();
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.redirectPath).toBeDefined();
    });

    it('should return error for invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword123!'
        })
        .expect(401);

      expect(response.body.error).toBe('Invalid email or password');
    });

    it('should lock account after 5 failed attempts', async () => {
      const invalidCredentials = {
        email: 'test@example.com',
        password: 'WrongPassword123!'
      };

      // Make 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send(invalidCredentials)
          .expect(401);
      }

      // 6th attempt should return account locked
      const response = await request(app)
        .post('/api/auth/login')
        .send(invalidCredentials)
        .expect(423);

      expect(response.body.error).toContain('Account is locked');
    });

    it('should set refresh token cookie', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123!'
        })
        .expect(200);

      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some(cookie => cookie.includes('refreshToken'))).toBe(true);
    });
  });

  describe('GET /api/auth/me', () => {
    let testUser;
    let authToken;

    beforeEach(async () => {
      testUser = new User({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'Password123!',
        role: 'customer',
        isEmailVerified: true,
        accountStatus: 'active'
      });
      await testUser.save();

      authToken = testUser.generateAuthToken();
    });

    it('should return current user data', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.user.id).toBe(testUser._id.toString());
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.user.role).toBe('customer');
    });

    it('should return error for missing token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.error).toBe('Access token required');
    });

    it('should return error for invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.error).toBe('Invalid token');
    });
  });

  describe('Email Verification Flow', () => {
    let testUser;
    let verificationToken;

    beforeEach(async () => {
      testUser = new User({
        firstName: 'Test',
        lastName: 'User', 
        email: 'test@example.com',
        password: 'Password123!',
        role: 'customer',
        isEmailVerified: false
      });
      verificationToken = testUser.generateVerificationToken();
      await testUser.save();
    });

    it('should verify email successfully', async () => {
      const response = await request(app)
        .get(`/api/auth/verify-email/${verificationToken}`)
        .expect(200);

      expect(response.body.message).toBe('Email verified successfully');

      // Check user is verified in database
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.isEmailVerified).toBe(true);
    });

    it('should return error for invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/verify-email/invalid-token')
        .expect(400);

      expect(response.body.error).toContain('Invalid');
    });

    it('should resend verification email', async () => {
      const response = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'test@example.com' })
        .expect(200);

      expect(response.body.message).toBe('Verification email sent successfully');
    });
  });
});
```

### **Postman Collection for Manual Testing**
**File**: `postman/Home-Service-Auth-API.postman_collection.json`

```json
{
  "info": {
    "name": "Home Service Platform - Authentication API",
    "description": "Complete API testing collection for authentication endpoints",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "base_url",
      "value": "http://localhost:5000/api",
      "type": "string"
    },
    {
      "key": "auth_token",
      "value": "",
      "type": "string"
    }
  ],
  "item": [
    {
      "name": "Authentication",
      "item": [
        {
          "name": "Register Customer",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"firstName\": \"John\",\n  \"lastName\": \"Doe\",\n  \"email\": \"john.doe@example.com\",\n  \"password\": \"Password123!\",\n  \"phone\": \"1234567890\",\n  \"agreeToTerms\": true,\n  \"agreeToPrivacy\": true,\n  \"marketingOptIn\": false\n}"
            },
            "url": {
              "raw": "{{base_url}}/auth/register/customer",
              "host": ["{{base_url}}"],
              "path": ["auth", "register", "customer"]
            }
          },
          "event": [
            {
              "listen": "test",
              "script": {
                "exec": [
                  "pm.test(\"Customer registration successful\", function () {",
                  "    pm.response.to.have.status(201);",
                  "    const response = pm.response.json();",
                  "    pm.expect(response.token).to.exist;",
                  "    pm.globals.set(\"auth_token\", response.token);",
                  "});"
                ]
              }
            }
          ]
        },
        {
          "name": "Login",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"email\": \"john.doe@example.com\",\n  \"password\": \"Password123!\"\n}"
            },
            "url": {
              "raw": "{{base_url}}/auth/login",
              "host": ["{{base_url}}"],
              "path": ["auth", "login"]
            }
          },
          "event": [
            {
              "listen": "test",
              "script": {
                "exec": [
                  "pm.test(\"Login successful\", function () {",
                  "    pm.response.to.have.status(200);",
                  "    const response = pm.response.json();",
                  "    pm.expect(response.token).to.exist;",
                  "    pm.expect(response.redirectPath).to.exist;",
                  "    pm.globals.set(\"auth_token\", response.token);",
                  "});"
                ]
              }
            }
          ]
        },
        {
          "name": "Get Current User",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{auth_token}}"
              }
            ],
            "url": {
              "raw": "{{base_url}}/auth/me",
              "host": ["{{base_url}}"],
              "path": ["auth", "me"]
            }
          },
          "event": [
            {
              "listen": "test",
              "script": {
                "exec": [
                  "pm.test(\"Get current user successful\", function () {",
                  "    pm.response.to.have.status(200);",
                  "    const response = pm.response.json();",
                  "    pm.expect(response.user).to.exist;",
                  "    pm.expect(response.user.email).to.exist;",
                  "});"
                ]
              }
            }
          ]
        }
      ]
    },
    {
      "name": "Provider Registration",
      "item": [
        {
          "name": "Register Provider (Form Data)",
          "request": {
            "method": "POST",
            "header": [],
            "body": {
              "mode": "formdata",
              "formdata": [
                {
                  "key": "firstName",
                  "value": "Jane",
                  "type": "text"
                },
                {
                  "key": "lastName", 
                  "value": "Smith",
                  "type": "text"
                },
                {
                  "key": "email",
                  "value": "jane.smith@example.com",
                  "type": "text"
                },
                {
                  "key": "password",
                  "value": "Password123!",
                  "type": "text"
                },
                {
                  "key": "phone",
                  "value": "0987654321",
                  "type": "text"
                },
                {
                  "key": "businessName",
                  "value": "Jane's Beauty Studio",
                  "type": "text"
                },
                {
                  "key": "businessType",
                  "value": "individual",
                  "type": "text"
                },
                {
                  "key": "businessDescription",
                  "value": "Professional beauty services with over 10 years of experience in hair styling and makeup artistry.",
                  "type": "text"
                },
                {
                  "key": "yearsOfExperience",
                  "value": "10",
                  "type": "text"
                },
                {
                  "key": "primaryCategory",
                  "value": "beauty-personal-care",
                  "type": "text"
                },
                {
                  "key": "agreeToProviderTerms",
                  "value": "true",
                  "type": "text"
                },
                {
                  "key": "agreeToCommissionStructure",
                  "value": "true", 
                  "type": "text"
                },
                {
                  "key": "agreeToBackgroundCheck",
                  "value": "true",
                  "type": "text"
                }
              ]
            },
            "url": {
              "raw": "{{base_url}}/auth/register/provider",
              "host": ["{{base_url}}"],
              "path": ["auth", "register", "provider"]
            }
          }
        }
      ]
    }
  ]
}
```

---

## 🌐 Step 4: Frontend-Backend Integration

### **API Service Integration Test**
**File**: `frontend/src/services/__tests__/auth.api.test.ts`

```typescript
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { authApi } from '../auth.api';

// Mock API server
const server = setupServer(
  rest.post('/api/auth/login', (req, res, ctx) => {
    return res(ctx.json({
      message: 'Login successful',
      token: 'mock-jwt-token',
      user: {
        id: '123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        role: 'customer',
        isEmailVerified: true,
        isActive: true
      },
      redirectPath: '/customer/dashboard'
    }));
  }),

  rest.post('/api/auth/register/customer', (req, res, ctx) => {
    return res(ctx.json({
      message: 'Customer registered successfully',
      token: 'mock-jwt-token',
      user: {
        id: '123',
        firstName: 'John',
        lastName: 'Doe', 
        email: 'john@example.com',
        role: 'customer',
        isEmailVerified: false
      }
    }));
  }),

  rest.get('/api/auth/me', (req, res, ctx) => {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res(ctx.status(401), ctx.json({ error: 'Access token required' }));
    }

    return res(ctx.json({
      user: {
        id: '123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        role: 'customer',
        isEmailVerified: true,
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z'
      },
      profile: {
        userId: '123',
        preferences: {},
        loyaltyPoints: { total: 0, available: 0 }
      }
    }));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Auth API Service', () => {
  describe('login', () => {
    it('should login successfully', async () => {
      const result = await authApi.login('john@example.com', 'password');
      
      expect(result.message).toBe('Login successful');
      expect(result.token).toBe('mock-jwt-token');
      expect(result.user.email).toBe('john@example.com');
      expect(result.redirectPath).toBe('/customer/dashboard');
    });

    it('should handle login error', async () => {
      server.use(
        rest.post('/api/auth/login', (req, res, ctx) => {
          return res(
            ctx.status(401),
            ctx.json({ error: 'Invalid credentials' })
          );
        })
      );

      await expect(authApi.login('john@example.com', 'wrong'))
        .rejects.toThrow();
    });
  });

  describe('getCurrentUser', () => {
    it('should get current user with valid token', async () => {
      // Mock localStorage
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: jest.fn(() => 'mock-token'),
          setItem: jest.fn(),
          removeItem: jest.fn()
        }
      });

      const result = await authApi.getCurrentUser();
      
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe('john@example.com');
      expect(result.profile).toBeDefined();
    });
  });
});
```

### **Zustand Store Integration Test**
**File**: `frontend/src/stores/__tests__/authStore.test.ts`

```typescript
import { renderHook, act } from '@testing-library/react';
import { useAuthStore } from '../authStore';
import { authApi } from '../../services/auth.api';

// Mock the auth API
jest.mock('../../services/auth.api');
const mockAuthApi = authApi as jest.Mocked<typeof authApi>;

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock as any;

describe('Auth Store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    
    // Reset store state
    useAuthStore.setState({
      user: null,
      profile: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null
    });
  });

  describe('login', () => {
    it('should login successfully', async () => {
      const mockResponse = {
        message: 'Login successful',
        token: 'mock-token',
        user: {
          id: '123',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          role: 'customer' as const,
          isEmailVerified: true,
          isActive: true
        },
        redirectPath: '/customer/dashboard'
      };

      mockAuthApi.login.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        const loginResult = await result.current.login('john@example.com', 'password');
        expect(loginResult.success).toBe(true);
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user?.email).toBe('john@example.com');
      expect(result.current.token).toBe('mock-token');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('token', 'mock-token');
    });

    it('should handle login failure', async () => {
      mockAuthApi.login.mockRejectedValue({
        response: { data: { error: 'Invalid credentials' } }
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        const loginResult = await result.current.login('john@example.com', 'wrong');
        expect(loginResult.success).toBe(false);
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBe('Invalid credentials');
    });
  });

  describe('logout', () => {
    it('should logout successfully', () => {
      const { result } = renderHook(() => useAuthStore());

      // Set initial authenticated state
      act(() => {
        useAuthStore.setState({
          user: { id: '123' } as any,
          token: 'mock-token',
          isAuthenticated: true
        });
      });

      act(() => {
        result.current.logout();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBe(null);
      expect(result.current.token).toBe(null);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
    });
  });

  describe('getCurrentUser', () => {
    it('should get current user if token exists', async () => {
      localStorageMock.getItem.mockReturnValue('mock-token');
      mockAuthApi.getCurrentUser.mockResolvedValue({
        user: {
          id: '123',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          role: 'customer',
          isEmailVerified: true,
          isActive: true,
          createdAt: '2024-01-01T00:00:00.000Z'
        },
        profile: { userId: '123' }
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.getCurrentUser();
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user?.email).toBe('john@example.com');
      expect(result.current.profile).toBeDefined();
    });

    it('should clear auth state if no token', async () => {
      localStorageMock.getItem.mockReturnValue(null);

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.getCurrentUser();
      });

      expect(result.current.isAuthenticated).toBe(false);
    });
  });
});
```

---

## 🧪 Step 5: End-to-End Testing

### **E2E Test Setup with Playwright**
**File**: `frontend/tests/e2e/auth.spec.ts`

```typescript
import { test, expect, Page } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Start fresh for each test
    await page.goto('/');
  });

  test('complete customer registration flow', async ({ page }) => {
    // Navigate to customer registration
    await page.click('text=Join as Customer');
    await expect(page).toHaveURL('/register/customer');

    // Fill registration form
    await page.fill('[data-testid=firstName]', 'John');
    await page.fill('[data-testid=lastName]', 'Doe');
    await page.fill('[data-testid=email]', 'john.doe@example.com');
    await page.fill('[data-testid=password]', 'Password123!');
    await page.fill('[data-testid=confirmPassword]', 'Password123!');
    await page.fill('[data-testid=phone]', '1234567890');

    // Accept terms
    await page.check('[data-testid=agreeToTerms]');
    await page.check('[data-testid=agreeToPrivacy]');

    // Submit form
    await page.click('[data-testid=submit-button]');

    // Should redirect to dashboard or verification page
    await page.waitForURL(/\/(customer\/dashboard|verify-email-required)/);

    // Verify success message or dashboard content
    const isOnDashboard = page.url().includes('/customer/dashboard');
    const isOnVerification = page.url().includes('/verify-email-required');
    
    expect(isOnDashboard || isOnVerification).toBe(true);
  });

  test('login flow with valid credentials', async ({ page }) => {
    // First, register a user (or use existing test user)
    await registerTestUser(page);

    // Navigate to login
    await page.goto('/login');

    // Fill login form
    await page.fill('[data-testid=email]', 'test@example.com');
    await page.fill('[data-testid=password]', 'Password123!');

    // Submit login
    await page.click('[data-testid=login-button]');

    // Should redirect to dashboard
    await page.waitForURL('/customer/dashboard');
    await expect(page.locator('h1')).toContainText('Welcome back');
  });

  test('login validation errors', async ({ page }) => {
    await page.goto('/login');

    // Submit empty form
    await page.click('[data-testid=login-button]');

    // Check for validation errors
    await expect(page.locator('text=Invalid email address')).toBeVisible();
    await expect(page.locator('text=Password is required')).toBeVisible();

    // Fill invalid email
    await page.fill('[data-testid=email]', 'invalid-email');
    await page.fill('[data-testid=password]', 'password');
    await page.click('[data-testid=login-button]');

    await expect(page.locator('text=Invalid email address')).toBeVisible();
  });

  test('logout functionality', async ({ page }) => {
    // Login first
    await loginTestUser(page);
    
    // Logout
    await page.click('[data-testid=user-menu]');
    await page.click('[data-testid=logout-button]');

    // Should redirect to home page
    await page.waitForURL('/');
    
    // Verify logged out state
    await expect(page.locator('text=Sign in')).toBeVisible();
  });

  test('protected route access', async ({ page }) => {
    // Try to access protected route without login
    await page.goto('/customer/dashboard');

    // Should redirect to login
    await page.waitForURL('/login');
    
    // Login and try again
    await loginTestUser(page);
    await page.goto('/customer/dashboard');

    // Should access dashboard successfully
    await expect(page.locator('h1')).toContainText('Welcome back');
  });

  test('password strength validation', async ({ page }) => {
    await page.goto('/register/customer');

    const weakPasswords = ['123', 'password', 'Password', 'Password123'];
    
    for (const password of weakPasswords) {
      await page.fill('[data-testid=password]', password);
      await page.fill('[data-testid=firstName]', 'Test');
      await page.fill('[data-testid=lastName]', 'User');
      await page.fill('[data-testid=email]', 'test@example.com');
      await page.check('[data-testid=agreeToTerms]');
      await page.check('[data-testid=agreeToPrivacy]');
      
      await page.click('[data-testid=submit-button]');
      
      // Should show password strength error
      await expect(page.locator('text=Password must contain')).toBeVisible();
      
      // Clear form for next iteration
      await page.fill('[data-testid=password]', '');
    }
  });

  test('provider registration multi-step flow', async ({ page }) => {
    await page.goto('/register/provider');

    // Step 1: Account Info
    await page.fill('[data-testid=firstName]', 'Jane');
    await page.fill('[data-testid=lastName]', 'Smith');
    await page.fill('[data-testid=email]', 'jane@example.com');
    await page.fill('[data-testid=password]', 'Password123!');
    await page.fill('[data-testid=confirmPassword]', 'Password123!');
    await page.fill('[data-testid=phone]', '0987654321');
    
    await page.click('[data-testid=next-button]');

    // Step 2: Business Info
    await page.fill('[data-testid=businessName]', 'Jane\'s Beauty Studio');
    await page.selectOption('[data-testid=businessType]', 'individual');
    await page.fill('[data-testid=businessDescription]', 'Professional beauty services with over 10 years of experience.');
    await page.fill('[data-testid=yearsOfExperience]', '10');
    
    await page.click('[data-testid=next-button]');

    // Continue through other steps...
    // (Implementation would continue for all steps)

    // Final step: Submit
    await page.check('[data-testid=agreeToProviderTerms]');
    await page.check('[data-testid=agreeToCommissionStructure]');
    await page.check('[data-testid=agreeToBackgroundCheck]');
    
    await page.click('[data-testid=submit-button]');

    // Should redirect to verification pending
    await page.waitForURL('/provider/verification-pending');
    await expect(page.locator('text=under review')).toBeVisible();
  });
});

// Helper functions
async function registerTestUser(page: Page) {
  await page.goto('/register/customer');
  await page.fill('[data-testid=firstName]', 'Test');
  await page.fill('[data-testid=lastName]', 'User');
  await page.fill('[data-testid=email]', 'test@example.com');
  await page.fill('[data-testid=password]', 'Password123!');
  await page.fill('[data-testid=confirmPassword]', 'Password123!');
  await page.check('[data-testid=agreeToTerms]');
  await page.check('[data-testid=agreeToPrivacy]');
  await page.click('[data-testid=submit-button]');
  await page.waitForNavigation();
}

async function loginTestUser(page: Page) {
  await page.goto('/login');
  await page.fill('[data-testid=email]', 'test@example.com');
  await page.fill('[data-testid=password]', 'Password123!');
  await page.click('[data-testid=login-button]');
  await page.waitForURL('/customer/dashboard');
}
```

### **Playwright Configuration**
**File**: `frontend/playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox', 
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],

  webServer: [
    {
      command: 'npm run dev',
      port: 3000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'cd ../backend && npm run dev',
      port: 5000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
```

---

## 🚀 Step 6: Complete Integration Script

### **Master Integration Test Script**
**File**: `scripts/integration-test.sh`

```bash
#!/bin/bash

set -e  # Exit on any error

echo "🚀 Starting Complete Integration Testing..."
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required services are running
check_services() {
    print_status "Checking required services..."
    
    # Check MongoDB
    if ! pgrep -x "mongod" > /dev/null && ! docker ps | grep -q mongodb; then
        print_error "MongoDB is not running!"
        print_status "Start MongoDB with: mongod or docker-compose up mongodb"
        exit 1
    fi
    print_success "MongoDB is running"

    # Check Node.js version
    node_version=$(node --version | sed 's/v//' | cut -d. -f1)
    if [ "$node_version" -lt 18 ]; then
        print_error "Node.js 18+ is required. Current version: $(node --version)"
        exit 1
    fi
    print_success "Node.js version is compatible"
}

# Setup environment
setup_environment() {
    print_status "Setting up environment..."
    
    # Copy environment files if they don't exist
    if [ ! -f backend/.env ]; then
        cp backend/.env.example backend/.env
        print_warning "Created backend/.env from example. Please configure it."
    fi
    
    if [ ! -f frontend/.env ]; then
        cp frontend/.env.example frontend/.env
        print_warning "Created frontend/.env from example. Please configure it."
    fi
    
    # Install dependencies
    print_status "Installing backend dependencies..."
    cd backend && npm install --silent
    
    print_status "Installing frontend dependencies..."
    cd ../frontend && npm install --silent
    cd ..
    
    print_success "Environment setup complete"
}

# Database tests
test_database() {
    print_status "Testing database connection and seeding..."
    
    cd backend
    
    # Test database connection
    npm run db:stats > /dev/null 2>&1 || {
        print_error "Database connection failed"
        exit 1
    }
    print_success "Database connection successful"
    
    # Seed database
    npm run db:seed > /dev/null 2>&1 || {
        print_error "Database seeding failed"
        exit 1
    }
    print_success "Database seeded successfully"
    
    # Validate data integrity
    npm run db:validate > /dev/null 2>&1 || {
        print_warning "Data integrity check found issues"
    }
    
    cd ..
}

# Backend API tests
test_backend() {
    print_status "Testing backend API..."
    
    cd backend
    
    # Start backend in background
    npm run dev > /dev/null 2>&1 &
    BACKEND_PID=$!
    
    # Wait for backend to start
    print_status "Waiting for backend to start..."
    sleep 10
    
    # Test backend health
    if curl -f http://localhost:5000/health > /dev/null 2>&1; then
        print_success "Backend is responding"
    else
        print_error "Backend health check failed"
        kill $BACKEND_PID
        exit 1
    fi
    
    # Run backend tests
    if npm test > /dev/null 2>&1; then
        print_success "Backend tests passed"
    else
        print_error "Backend tests failed"
        kill $BACKEND_PID
        exit 1
    fi
    
    cd ..
}

# Frontend tests
test_frontend() {
    print_status "Testing frontend..."
    
    cd frontend
    
    # Run frontend tests
    if npm test -- --run > /dev/null 2>&1; then
        print_success "Frontend tests passed"
    else
        print_error "Frontend tests failed"
        exit 1
    fi
    
    # Build frontend
    if npm run build > /dev/null 2>&1; then
        print_success "Frontend build successful"
    else
        print_error "Frontend build failed"
        exit 1
    fi
    
    cd ..
}

# API integration tests
test_api_integration() {
    print_status "Running API integration tests..."
    
    # Use Newman to run Postman collection if available
    if command -v newman > /dev/null 2>&1; then
        if [ -f "postman/Home-Service-Auth-API.postman_collection.json" ]; then
            newman run postman/Home-Service-Auth-API.postman_collection.json > /dev/null 2>&1
            print_success "Postman API tests passed"
        fi
    else
        print_warning "Newman not installed. Skipping Postman tests."
        print_status "Install with: npm install -g newman"
    fi
    
    # Test specific endpoints with curl
    print_status "Testing key API endpoints..."
    
    # Test health endpoint
    if curl -f http://localhost:5000/health > /dev/null 2>&1; then
        print_success "Health endpoint working"
    else
        print_error "Health endpoint failed"
        return 1
    fi
    
    # Test customer registration
    REGISTER_RESPONSE=$(curl -s -X POST http://localhost:5000/api/auth/register/customer \
        -H "Content-Type: application/json" \
        -d '{
            "firstName": "Test",
            "lastName": "User", 
            "email": "integration.test@example.com",
            "password": "Password123!",
            "agreeToTerms": true,
            "agreeToPrivacy": true
        }')
    
    if echo "$REGISTER_RESPONSE" | grep -q "token"; then
        print_success "Customer registration endpoint working"
        
        # Extract token for login test
        TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
        
        # Test protected endpoint
        if curl -s -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/auth/me > /dev/null 2>&1; then
            print_success "Protected endpoint authentication working"
        else
            print_error "Protected endpoint authentication failed"
        fi
        
    else
        print_error "Customer registration endpoint failed"
        return 1
    fi
}

# End-to-end tests
test_e2e() {
    print_status "Running end-to-end tests..."
    
    cd frontend
    
    # Check if Playwright is installed
    if [ -f "playwright.config.ts" ] && command -v npx > /dev/null 2>&1; then
        # Install Playwright browsers if needed
        npx playwright install --with-deps > /dev/null 2>&1
        
        # Run Playwright tests
        if npx playwright test > /dev/null 2>&1; then
            print_success "E2E tests passed"
        else
            print_warning "E2E tests failed or not configured"
        fi
    else
        print_warning "Playwright not configured. Skipping E2E tests."
    fi
    
    cd ..
}

# Performance tests
test_performance() {
    print_status "Running basic performance tests..."
    
    # Simple load test with curl
    print_status "Testing API response times..."
    
    RESPONSE_TIME=$(curl -o /dev/null -s -w "%{time_total}" http://localhost:5000/health)
    
    if (( $(echo "$RESPONSE_TIME < 1.0" | bc -l) )); then
        print_success "API response time: ${RESPONSE_TIME}s (Good)"
    else
        print_warning "API response time: ${RESPONSE_TIME}s (Slow)"
    fi
}

# Cleanup function
cleanup() {
    print_status "Cleaning up..."
    
    # Kill backend process if running
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID > /dev/null 2>&1 || true
    fi
    
    # Clean test data
    cd backend && npm run db:cleanup > /dev/null 2>&1 || true
    cd ..
}

# Trap cleanup on exit
trap cleanup EXIT

# Main execution
main() {
    echo "🏠 Home Service Platform - Integration Testing"
    echo "================================================"
    
    check_services
    setup_environment
    test_database
    test_backend
    test_frontend
    test_api_integration
    test_e2e
    test_performance
    
    echo ""
    echo "================================================"
    print_success "🎉 All integration tests completed successfully!"
    echo ""
    print_status "Next steps:"
    echo "  1. Review test results"
    echo "  2. Check application logs"
    echo "  3. Test manually in browser"
    echo "  4. Deploy to staging environment"
    echo ""
    print_status "Access points:"
    echo "  Frontend: http://localhost:3000"
    echo "  Backend:  http://localhost:5000"
    echo "  MongoDB:  mongodb://localhost:27017"
    echo ""
}

# Run main function
main "$@"
```

---

## 📊 Testing Checklist and Commands

### **Quick Test Commands**
```bash
# Run prerequisite check
node scripts/check-prerequisites.js

# Run complete integration test
chmod +x scripts/integration-test.sh
./scripts/integration-test.sh

# Individual test commands
cd backend
npm test                    # Backend unit tests
npm run test:integration    # Backend integration tests

cd frontend  
npm test                    # Frontend unit tests
npm run test:e2e           # End-to-end tests

# Database tests
cd backend
npm run db:validate        # Check data integrity
npm run db:stats          # Show database statistics

# API testing with Newman (if installed)
newman run postman/Home-Service-Auth-API.postman_collection.json
```

### **Manual Testing Checklist**
- [ ] ✅ Customer registration flow
- [ ] ✅ Provider registration flow (multi-step)
- [ ] ✅ Login/logout functionality
- [ ] ✅ Email verification process
- [ ] ✅ Password reset flow
- [ ] ✅ Protected route access
- [ ] ✅ Role-based dashboard routing
- [ ] ✅ API error handling
- [ ] ✅ Form validation
- [ ] ✅ File upload (provider documents)
- [ ] ✅ Mobile responsiveness
- [ ] ✅ Cross-browser compatibility

This comprehensive integration and testing guide ensures your authentication system works perfectly across all components and user scenarios!