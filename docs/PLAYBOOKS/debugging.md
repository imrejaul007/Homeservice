# Debugging Guide

## Local Development

### Enable Debug Logging
```typescript
// In your service
import logger from '../utils/logger';

logger.debug('Variable values', { variable1, variable2 });
logger.info('Processing booking', { bookingId });
logger.warn('Slow query detected', { duration: 5000 });
logger.error('Payment failed', { error });
```

### Common Issues

#### Backend Won't Start
1. Check MongoDB is running: `docker ps`
2. Check Redis is running: `docker ps`
3. Verify .env file exists
4. Check port availability: `lsof -i :3001`

#### Frontend Won't Start
1. Check Node version: `node -v` (should be 20+)
2. Clear cache: `rm -rf node_modules && npm install`
3. Check .env file exists
4. Check port availability: `lsof -i :5173`

#### Database Connection Issues
1. Verify MongoDB URI in .env
2. Check MongoDB is accessible: `mongosh`
3. Check network connectivity
4. Verify credentials

## Production Debugging

### Check Logs
```bash
# Backend logs
docker logs nilin-api -f

# All services
docker-compose logs -f
```

### Health Check
```bash
curl http://localhost:3001/health
```

### Database Inspection
```bash
# Connect to MongoDB
mongosh "mongodb://localhost:27017/nilin"

# Check collections
show collections

# Find specific record
db.bookings.findOne({ bookingNumber: "BK-12345" })
```

## Performance Debugging

### Slow API Requests
1. Check response time: `time curl http://localhost:3001/api/... `
2. Check database query time in logs
3. Review indexes: `db.collection.getIndexes()`
4. Check for N+1 queries

### Memory Issues
```bash
# Check Node memory
process.memoryUsage()

# Heap dump analysis
node --inspect backend/src/server.ts
# Then use Chrome DevTools
```

## Mobile Debugging

### Android
1. Enable USB debugging on device
2. Connect device: `adb devices`
3. Open Chrome: `chrome://inspect`
4. View logs: `adb logcat`

### Capacitor
```bash
# Sync changes
npx cap sync android

# Open in Android Studio
npx cap open android

# View logs
adb logcat | grep -i nilin
```
