# 🧪 Marketplace Testing Plan

**Project**: Home Service Platform - Marketplace Testing Strategy  
**Scope**: Service Search, Booking System, Payment Processing  
**Testing Approach**: Comprehensive testing for each phase completion

---

## 📋 **TESTING OVERVIEW**

### **Testing Levels**
1. **Unit Tests** - Individual component testing
2. **Integration Tests** - API and database integration
3. **End-to-End Tests** - Complete user workflows
4. **Performance Tests** - Load and stress testing
5. **Security Tests** - Data protection and validation

### **Testing Tools Stack**
- **Backend**: Jest, Supertest, MongoDB Memory Server
- **Frontend**: Vitest, React Testing Library, MSW
- **E2E**: Playwright with multi-browser support
- **Performance**: Artillery.io for load testing
- **API**: Postman collections with automated testing

---

## 🔍 **PHASE 5: SERVICE SEARCH & DISCOVERY TESTING**

### **5.1 Database Layer Testing**

#### **Search Index Testing** (`backend/src/tests/search-indexes.test.ts`)
```javascript
describe('Search Indexes', () => {
  test('Text search index performs efficiently', async () => {
    // Test search query performance
    const startTime = Date.now();
    const results = await Service.find({ $text: { $search: "cleaning" } });
    const queryTime = Date.now() - startTime;
    
    expect(queryTime).toBeLessThan(50); // <50ms target
    expect(results.length).toBeGreaterThan(0);
  });

  test('Geospatial search returns accurate results', async () => {
    // Test location-based search accuracy
    const results = await Service.find({
      'location.coordinates': {
        $near: {
          $geometry: { type: 'Point', coordinates: [-74.0060, 40.7128] },
          $maxDistance: 1000 // 1km
        }
      }
    });
    
    results.forEach(service => {
      const distance = calculateDistance(service.location.coordinates, [-74.0060, 40.7128]);
      expect(distance).toBeLessThanOrEqual(1); // 1km radius
    });
  });
});
```

#### **Service Model Testing** (`backend/src/tests/models/service.test.ts`)
```javascript
describe('Service Model', () => {
  test('Creates service with all required fields', async () => {
    const serviceData = {
      providerId: new ObjectId(),
      name: 'Home Cleaning',
      category: 'Cleaning',
      description: 'Professional home cleaning service',
      price: { amount: 100, currency: 'USD', type: 'fixed' },
      duration: 120,
      location: {
        address: { street: '123 Main St', city: 'NYC' },
        coordinates: { type: 'Point', coordinates: [-74.0060, 40.7128] }
      }
    };
    
    const service = new Service(serviceData);
    const savedService = await service.save();
    
    expect(savedService._id).toBeDefined();
    expect(savedService.name).toBe('Home Cleaning');
  });

  test('Validates required fields', async () => {
    const invalidService = new Service({});
    
    await expect(invalidService.save()).rejects.toThrow();
  });
});
```

### **5.2 Backend API Testing**

#### **Search Controller Testing** (`backend/src/tests/controllers/search.test.ts`)
```javascript
describe('Search Controller', () => {
  beforeEach(async () => {
    // Seed test data
    await seedTestServices();
  });

  test('GET /api/search/services - basic text search', async () => {
    const response = await request(app)
      .get('/api/search/services?q=cleaning')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.services).toBeDefined();
    expect(response.body.data.services.length).toBeGreaterThan(0);
  });

  test('Location-based search with radius', async () => {
    const response = await request(app)
      .get('/api/search/services?lat=40.7128&lng=-74.0060&radius=5')
      .expect(200);

    expect(response.body.data.services).toBeDefined();
    response.body.data.services.forEach(service => {
      expect(service.distance).toBeLessThanOrEqual(5);
    });
  });

  test('Filter by category and price range', async () => {
    const response = await request(app)
      .get('/api/search/services?category=Cleaning&minPrice=50&maxPrice=200')
      .expect(200);

    response.body.data.services.forEach(service => {
      expect(service.category).toBe('Cleaning');
      expect(service.price.amount).toBeGreaterThanOrEqual(50);
      expect(service.price.amount).toBeLessThanOrEqual(200);
    });
  });

  test('Pagination works correctly', async () => {
    const page1 = await request(app)
      .get('/api/search/services?page=1&limit=5')
      .expect(200);

    const page2 = await request(app)
      .get('/api/search/services?page=2&limit=5')
      .expect(200);

    expect(page1.body.data.services.length).toBe(5);
    expect(page2.body.data.services.length).toBeGreaterThan(0);
    expect(page1.body.data.services[0]._id).not.toBe(page2.body.data.services[0]._id);
  });
});
```

### **5.3 Frontend Testing**

#### **Search Page Testing** (`frontend/src/pages/__tests__/Search.test.tsx`)
```javascript
describe('Search Page', () => {
  beforeEach(() => {
    // Mock search API
    server.use(
      rest.get('/api/search/services', (req, res, ctx) => {
        return res(ctx.json({
          success: true,
          data: {
            services: mockServices,
            pagination: { page: 1, limit: 20, total: 50 }
          }
        }));
      })
    );
  });

  test('renders search input and filters', () => {
    render(<Search />);
    
    expect(screen.getByPlaceholderText('Search for services...')).toBeInTheDocument();
    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.getByText('Price Range')).toBeInTheDocument();
  });

  test('performs search when user types', async () => {
    render(<Search />);
    
    const searchInput = screen.getByPlaceholderText('Search for services...');
    fireEvent.change(searchInput, { target: { value: 'cleaning' } });
    
    await waitFor(() => {
      expect(screen.getByText('Home Cleaning Service')).toBeInTheDocument();
    });
  });

  test('filters results by category', async () => {
    render(<Search />);
    
    const categoryFilter = screen.getByLabelText('Category');
    fireEvent.change(categoryFilter, { target: { value: 'Cleaning' } });
    
    await waitFor(() => {
      const serviceCards = screen.getAllByTestId('service-card');
      serviceCards.forEach(card => {
        expect(card).toHaveTextContent('Cleaning');
      });
    });
  });
});
```

#### **Search Components Testing**
```javascript
// SearchFilters.test.tsx
describe('SearchFilters', () => {
  test('applies price range filter', () => {
    const onFilterChange = jest.fn();
    render(<SearchFilters onFilterChange={onFilterChange} />);
    
    const minPriceInput = screen.getByLabelText('Min Price');
    fireEvent.change(minPriceInput, { target: { value: '50' } });
    
    expect(onFilterChange).toHaveBeenCalledWith({
      minPrice: 50
    });
  });
});

// ServiceCard.test.tsx
describe('ServiceCard', () => {
  test('displays service information correctly', () => {
    const mockService = {
      name: 'Home Cleaning',
      category: 'Cleaning',
      price: { amount: 100, currency: 'USD' },
      rating: { average: 4.5, count: 23 }
    };
    
    render(<ServiceCard service={mockService} />);
    
    expect(screen.getByText('Home Cleaning')).toBeInTheDocument();
    expect(screen.getByText('$100')).toBeInTheDocument();
    expect(screen.getByText('4.5')).toBeInTheDocument();
  });
});
```

### **5.4 End-to-End Testing**

#### **Search Workflow Testing** (`frontend/tests/e2e/search.spec.ts`)
```javascript
test.describe('Service Search', () => {
  test('complete search workflow', async ({ page }) => {
    await page.goto('/search');
    
    // Test search input
    await page.fill('[data-testid="search-input"]', 'cleaning services');
    await page.press('[data-testid="search-input"]', 'Enter');
    
    // Wait for results
    await page.waitForSelector('[data-testid="service-card"]');
    
    // Verify results contain search term
    const serviceCards = await page.locator('[data-testid="service-card"]');
    const count = await serviceCards.count();
    expect(count).toBeGreaterThan(0);
    
    // Test filter functionality
    await page.selectOption('[data-testid="category-filter"]', 'Cleaning');
    await page.waitForTimeout(1000); // Wait for API call
    
    // Verify filtered results
    const filteredCards = await page.locator('[data-testid="service-card"]');
    const filteredCount = await filteredCards.count();
    expect(filteredCount).toBeGreaterThanOrEqual(1);
  });

  test('location-based search', async ({ page, context }) => {
    // Mock geolocation
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 40.7128, longitude: -74.0060 });
    
    await page.goto('/search');
    
    // Enable location search
    await page.click('[data-testid="location-search-toggle"]');
    await page.waitForSelector('[data-testid="location-enabled"]');
    
    // Verify location-based results
    await page.waitForSelector('[data-testid="service-card"]');
    const distanceElements = await page.locator('[data-testid="service-distance"]');
    expect(await distanceElements.first().isVisible()).toBeTruthy();
  });

  test('mobile responsive search', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/search');
    
    // Test mobile filter toggle
    await page.click('[data-testid="mobile-filter-toggle"]');
    await page.waitForSelector('[data-testid="filter-sidebar"]');
    
    // Test mobile search functionality
    await page.fill('[data-testid="search-input"]', 'cleaning');
    await page.press('[data-testid="search-input"]', 'Enter');
    
    await page.waitForSelector('[data-testid="service-card"]');
    const cards = await page.locator('[data-testid="service-card"]');
    expect(await cards.count()).toBeGreaterThan(0);
  });
});
```

### **5.5 Performance Testing**

#### **Search Performance Tests** (`performance/search-load.yml`)
```yaml
config:
  target: 'http://localhost:5000'
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - name: "Search API Load Test"
    requests:
      - get:
          url: "/api/search/services"
          qs:
            q: "cleaning"
            category: "Cleaning"
            page: 1
            limit: 20
  - name: "Location Search Load Test"  
    requests:
      - get:
          url: "/api/search/services"
          qs:
            lat: 40.7128
            lng: -74.0060
            radius: 5
```

#### **Database Query Performance** (`backend/src/tests/performance/search.perf.test.ts`)
```javascript
describe('Search Performance', () => {
  test('search query completes within performance target', async () => {
    // Create large dataset
    await createTestServices(10000);
    
    const startTime = Date.now();
    const results = await Service.find({
      $text: { $search: "cleaning home professional" },
      'location.coordinates': {
        $near: {
          $geometry: { type: 'Point', coordinates: [-74.0060, 40.7128] },
          $maxDistance: 5000
        }
      }
    }).limit(20);
    const queryTime = Date.now() - startTime;
    
    expect(queryTime).toBeLessThan(200); // <200ms target
    expect(results.length).toBeGreaterThan(0);
  });
});
```

---

## 🔒 **SECURITY TESTING**

### **Input Validation Testing**
```javascript
describe('Search Security', () => {
  test('prevents SQL injection in search query', async () => {
    const maliciousQuery = "'; DROP TABLE services; --";
    
    const response = await request(app)
      .get(`/api/search/services?q=${encodeURIComponent(maliciousQuery)}`)
      .expect(200);
    
    expect(response.body.success).toBe(true);
    // Verify database still intact
    const serviceCount = await Service.countDocuments();
    expect(serviceCount).toBeGreaterThan(0);
  });

  test('sanitizes user input in search parameters', async () => {
    const response = await request(app)
      .get('/api/search/services?q=<script>alert("xss")</script>')
      .expect(200);
    
    expect(response.body.data.services).toBeDefined();
  });
});
```

---

## 📊 **TEST COVERAGE TARGETS**

### **Coverage Requirements**
- **Unit Tests**: 90% line coverage
- **Integration Tests**: 80% endpoint coverage
- **E2E Tests**: 100% critical user flows
- **Performance Tests**: All search scenarios

### **Quality Gates**
- ✅ All tests pass before deployment
- ✅ Performance targets met
- ✅ Security tests pass
- ✅ Mobile responsiveness verified
- ✅ Cross-browser compatibility confirmed

---

## 🚀 **TESTING EXECUTION PLAN**

### **Phase 5 Testing Schedule**
- **Week 1**: Database and model testing
- **Week 2**: API integration testing  
- **Week 3**: Frontend component testing
- **Week 3-4**: E2E and performance testing

### **Automated Testing Pipeline**
1. **Pre-commit**: Unit tests and linting
2. **Pull Request**: Full test suite
3. **Staging**: E2E and performance tests
4. **Production**: Smoke tests and monitoring

**Next Action**: Execute Phase 5 testing plan alongside development