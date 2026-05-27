# Database Issues Playbook

## Connection Issues

### Symptoms
- `ECONNREFUSED` errors
- Timeouts connecting to MongoDB

**Steps:**
1. Check MongoDB is running: `docker ps`
2. Verify connection string
3. Check firewall rules
4. Test connection: `mongosh <connection-string>`

## Performance Issues

### Slow Queries

**Find slow queries:**
```javascript
db.getProfilingLevel() // Should be 1 or 2
db.system.profile.find({ millis: { $gt: 100 } }).sort({ millis: -1 })
```

**Fix slow queries:**
1. Add missing indexes
2. Use explain() to analyze
3. Optimize aggregation pipeline
4. Consider covering indexes

### Missing Indexes

**Check indexes:**
```javascript
db.collection.getIndexes()

// Add common indexes
db.bookings.createIndex({ customerId: 1, createdAt: -1 })
db.bookings.createIndex({ providerId: 1, status: 1 })
db.bookings.createIndex({ scheduledDate: 1, scheduledTime: 1 })
```

## Data Issues

### Orphaned Records

**Find orphans:**
```javascript
// Bookings without valid service
db.bookings.aggregate([
  { $lookup: { from: 'services', localField: 'serviceId', foreignField: '_id', as: 'service' } },
  { $match: { service: { $size: 0 } } }
])
```

### Duplicate Records

**Find duplicates:**
```javascript
db.collection.aggregate([
  { $group: { _id: '$field', count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } }
])
```

## Recovery

### Restore from Backup
```bash
# List backups
ls /backups/

# Restore
mongorestore --uri="mongodb://localhost:27017/nilin" /backups/backup_xxx.tar.gz
```

### Emergency Fix
1. Stop application
2. Fix data manually or via script
3. Verify fix
4. Restart application
