# 🏠 Home Service Platform - Integration Setup Guide

## 📋 Prerequisites

Before running the integration setup, ensure you have:

- **Node.js 18+** installed
- **MongoDB** running (local installation or Docker)
- **Git** for version control
- **npm** package manager

## 🚀 Quick Start

### 1. Check Prerequisites
```bash
node scripts/check-prerequisites.js
```

### 2. Run Complete Setup
```bash
# Make script executable (on Unix systems)
chmod +x scripts/setup-dev.sh
chmod +x scripts/integration-test.sh

# Run setup
./scripts/setup-dev.sh
```

### 3. Run Integration Tests
```bash
./scripts/integration-test.sh
```

## 📁 Project Structure

```
├── backend/                 # Backend API
│   ├── src/
│   │   ├── controllers/     # Auth controllers
│   │   ├── middleware/      # Auth & validation middleware
│   │   ├── models/          # Database models
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic services
│   │   ├── utils/           # Utility functions
│   │   ├── seeders/         # Database seeders
│   │   ├── scripts/         # Database scripts
│   │   └── tests/           # Integration tests
│   ├── .env                 # Environment variables
│   └── package.json         # Dependencies
├── frontend/                # React frontend
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── stores/          # Zustand stores
│   │   ├── services/        # API services
│   │   └── __tests__/       # Frontend tests
│   ├── .env                 # Environment variables
│   └── package.json         # Dependencies
├── scripts/                 # Setup scripts
├── postman/                 # API testing collection
└── docs/                    # Documentation
```

## 🔧 Environment Configuration

### Backend Environment (.env)
Key configuration variables:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/home_service_marketplace

# JWT Configuration  
JWT_SECRET=your-super-secret-jwt-key-min-32-characters-long
JWT_REFRESH_SECRET=your-refresh-token-secret-different-from-jwt-secret

# Email Configuration
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-specific-password

# Admin User (for seeding)
ADMIN_EMAIL=admin@homeservice.com
ADMIN_PASSWORD=AdminPassword123!
```

### Frontend Environment (.env)
```env
# API Configuration
VITE_API_URL=http://localhost:5000/api
VITE_APP_NAME=Home Service Platform
```

## 🗄️ Database Operations

### Available NPM Scripts
```bash
# Backend database operations
cd backend

npm run db:seed        # Seed database with initial data
npm run db:reset       # Reset and reseed database  
npm run db:health      # Check database health
npm run db:stats       # Show database statistics
npm run db:validate    # Validate data integrity
npm run db:test        # Test database connection
```

### Database Health Check
```bash
cd backend
npm run db:health
```

Expected output:
```
🏥 Running database health check...

🔌 Connection Status:
   State: connected (1)
   Host: localhost:27017
   Database: home_service_marketplace

⚡ Performance:
   Ping time: 12ms
   Query time: 45ms

📊 Collections:
   users: 1 documents, 5 indexes
   customerprofiles: 0 documents, 2 indexes
   providerprofiles: 0 documents, 2 indexes
   servicecategories: 5 documents, 3 indexes

✅ Overall Status: HEALTHY
```

## 🧪 Testing

### Backend Testing
```bash
cd backend

# Run all tests
npm test

# Run integration tests
npm run test:integration

# Run with coverage
npm run test -- --coverage
```

### Frontend Testing
```bash
cd frontend

# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch
```

### API Testing with Postman
1. Import collection: `postman/Home-Service-Auth-API.postman_collection.json`
2. Set environment variables:
   - `base_url`: `http://localhost:5000/api`
3. Run the collection

## 🔄 Development Workflow

### 1. Start Development Servers
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend  
cd frontend
npm run dev
```

### 2. Access Points
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000/api
- **Health Check**: http://localhost:5000/health

### 3. Default Admin Login
- **Email**: admin@homeservice.com
- **Password**: AdminPassword123!

## 🚨 Troubleshooting

### Common Issues

#### 1. MongoDB Connection Failed
```bash
# Check if MongoDB is running
mongosh --eval "db.adminCommand('ping')"

# Start MongoDB
mongod
# OR with Docker
docker run -d -p 27017:27017 mongo
```

#### 2. Backend Build Errors
```bash
cd backend
npm install
npm run build
```

#### 3. Frontend Build Errors  
```bash
cd frontend
npm install
npm run build
```

#### 4. Environment Variables Not Loaded
- Ensure `.env` files exist in both `backend/` and `frontend/`
- Check file permissions
- Restart development servers

#### 5. Database Seeding Issues
```bash
cd backend

# Reset and reseed database
npm run db:reset

# Check database health
npm run db:health
```

### Debug Mode
Enable detailed logging:
```bash
# Backend
cd backend
DEBUG=* npm run dev

# Check logs
tail -f logs/app.log
```

## 📊 Integration Test Results

After running integration tests, you should see:

```
🎉 Integration testing completed!

Summary:
  ✅ Services are running
  ✅ Environment configured  
  ✅ Database connected and seeded
  ✅ Backend API operational
  ✅ Frontend builds successfully
  ✅ API endpoints responding

Access points:
  Frontend: http://localhost:3000
  Backend:  http://localhost:5000
  MongoDB:  mongodb://localhost:27017
```

## 🎯 Success Criteria

### ✅ Phase 1: Database Foundation
- [x] Enhanced User model with social features
- [x] CustomerProfile model with loyalty system
- [x] ProviderProfile model with Instagram-style features
- [x] ServiceCategory model with subcategories
- [x] Database seeding working

### ✅ Phase 2: Backend API
- [x] Authentication middleware and security
- [x] Customer and Provider registration endpoints
- [x] Login system with JWT tokens
- [x] Email service and verification
- [x] API validation and error handling

### ✅ Phase 3: Frontend Implementation
- [x] Authentication store with Zustand
- [x] Protected routes and navigation
- [x] Customer registration form
- [x] Provider multi-step registration
- [x] Login and authentication UI
- [x] Role-specific dashboard components

### ✅ Phase 4: Integration & Testing
- [x] Complete integration setup automation
- [x] Database health monitoring
- [x] API integration tests
- [x] Development workflow scripts

## 🔗 Next Steps

After successful integration:

1. **Frontend Development**: Start building booking and service features
2. **Payment Integration**: Add Stripe payment processing
3. **Real-time Features**: Implement WebSocket for notifications
4. **Mobile App**: Extend API for mobile application
5. **Analytics**: Add user behavior tracking
6. **Performance Optimization**: Implement caching and CDN

## 📖 Additional Resources

- [Backend API Documentation](./docs/api/)
- [Frontend Component Documentation](./docs/frontend/)
- [Database Schema Documentation](./docs/database/)
- [Security Best Practices](./docs/security/)

## 🆘 Support

If you encounter issues:

1. Check this troubleshooting guide
2. Review environment configuration
3. Run database health checks
4. Check application logs
5. Verify all services are running

The authentication system is now fully integrated and ready for development! 🚀