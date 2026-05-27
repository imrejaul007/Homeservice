# NILIN Disaster Recovery & Business Continuity Audit Report

**SRE Lead Audit** | **Date:** May 22, 2026 | **System:** NILIN Home Services Marketplace

---

## Executive Summary

NILIN has a solid foundation for disaster recovery with MongoDB replica sets, Redis clustering, Kubernetes HPA, and automated backups. However, there are critical gaps in multi-region failover, backup encryption, point-in-time recovery capability, and documented runbooks.

**Current Risk Level:** MEDIUM-HIGH  
**Target Risk Level:** LOW  

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| System RTO | 45-75 min | 30 min | HIGH |
| System RPO | 24 hours | 1 hour | CRITICAL |
| DR Documentation | 0/10 | 10/10 | CRITICAL |
| Multi-Region | None | Required | CRITICAL |

---

## 1. BACKUP STRATEGY ANALYSIS

### Current Implementation
- Daily automated backups (2 AM UTC via CronJob)
- GitHub Actions backup workflow with manual triggers
- S3 cloud storage (nilin-backups bucket)
- 30-day retention policy
- Backup verification in CI/CD
- Redis backups separate from MongoDB (3 AM UTC)
- MongoDB uses --oplog flag for incremental capability
- Compression (gzip)

### Critical Issues Found

| Issue | Severity | Location | Impact |
|-------|----------|----------|--------|
| **No backup encryption at rest** | CRITICAL | k8s/backup-cronjob.yaml:59-60 | Data exposure if S3 compromised |
| **No point-in-time recovery** | CRITICAL | backup-cronjob.yaml | Cannot recover to specific timestamp |
| **Retention too short (30 days)** | HIGH | backup-cronjob.yaml:44 | Compliance risk |
| **No incremental backup strategy** | HIGH | backup-cronjob.yaml | Full backups only |
| **No backup monitoring alerts** | HIGH | .github/workflows/backup.yml | Failures go unnoticed |

### Backup Configuration Details

`yaml
# MongoDB Backup (k8s/base/17-backup-cronjob.yaml)
Schedule: "0 2 * * *" (2 AM UTC daily)
Retention: 30 days (KEEP_DAYS=30)
Storage: S3 bucket (nilin-backups/mongodb/)
Command: mongodump with --oplog and --gzip
Resources: 250m-500m CPU, 256-512Mi memory

# Redis Backup
Schedule: "0 3 * * *" (3 AM UTC daily)
Method: BGSAVE + S3 upload
Storage: nilin-backups/redis/
`

---

## 2. RECOVERY PROCEDURES ANALYSIS

### RTO/RPO Assessment

| Component | Current RTO | Target RTO | Current RPO | Target RPO |
|-----------|-------------|-----------|-----------|-----------|
| Database | 45-60 min | 15 min | 24 hours | 1 hour |
| Redis Cache | 10-15 min | 5 min | 24 hours | 15 min |
| API Pods | 5-10 min | 2 min | N/A | N/A |
| **Overall** | **60-75 min** | **30 min** | **24 hours** | **1 hour** |

### Critical Findings

**SEVERE:** No documented recovery runbook exists. The backup-db.ts script has restore capability but:
- No step-by-step procedures documented
- No decision tree for different failure scenarios
- No escalation matrix
- No stakeholder communication templates

### Chaos Engineering Test Coverage

**File:** frontend/tests/chaos/chaos-scenarios.spec.ts (702 lines)

**Test Categories:**
1. Payment service outages (4 tests)
2. Database outages (4 tests)
3. Redis/Cache outages (3 tests)
4. Network failures (5 tests)
5. Service dependency failures (5 tests)
6. Capacity & load (3 tests)
7. Data consistency (2 tests)

**What's Missing:**
- No multi-region failover testing
- No database corruption recovery testing
- No application corruption recovery testing
- No backup restoration testing

---

## 3. HIGH AVAILABILITY ANALYSIS

### MongoDB Replica Set

`yaml
# Production MongoDB Setup (k8s/base/11-mongodb.yaml)
- Replicas: 3 (1 primary, 2 secondary)
- Anti-affinity: Required (topologyKey: kubernetes.io/hostname)
- Storage: 100Gi per pod (fast-ssd)
- CPU: 500m-2000m, Memory: 4Gi-8Gi
- Authentication: SCRAM-SHA-256 enabled
- Encryption: WiredTiger encryption enabled
- ReplicaSet Name: rs0
`

**Strengths:** 3-node replica set, Auto failover, Encryption at rest, KeyFile auth, Health probes

**Gaps:** No read preference for load balancing, No change stream support, No oplog monitoring

### Redis Cluster

`yaml
# Production Redis Setup (k8s/base/12-redis.yaml)
- Replicas: 3 (1 master, 2 replicas)
- Persistence: RDB snapshots + AOF enabled
- AOF fsync: everysec
- Max Memory: 2GB with allkeys-lru eviction
- Anti-affinity: Required
- Storage: 10Gi per pod
- Authentication: Password required
`

**Strengths:** Cluster mode, Dual persistence, Auto failover, Memory policy

**Gaps:** Redis Sentinel not configured, Single shard only, No backup from replica

### Application High Availability

`yaml
# Backend API (k8s/base/03-api-deployment.yaml)
- Replicas: 3 (min), 20 (max via HPA)
- HPA Metrics: CPU 70%, Memory 80%
- RollingUpdate: maxSurge=1, maxUnavailable=0
- Topology Spread: Across zones with maxSkew=1
- Resources: 250m-1 CPU, 512Mi-1Gi memory
`

---

## 4. REGIONAL FAILOVER ANALYSIS

### Current State: NO MULTI-REGION DEPLOYMENT

**Critical Risk:** Single point of failure - entire system down in regional outage

| Requirement | Current | Target | Priority |
|------------|---------|--------|----------|
| Multi-region deployment | No | Yes | CRITICAL |
| Data replication | No | Yes | CRITICAL |
| DNS failover (Route53) | No | Yes | HIGH |
| Traffic routing during failover | No | Yes | HIGH |
| Cross-region backup | No | Yes | HIGH |
| RTO for regional outage | Days | 1 hour | CRITICAL |
| RPO for regional outage | 24 hours | 15 min | CRITICAL |

### Required Multi-Region Architecture

AWS Route53 DNS (Failover Routing)
        |                  |
   Primary           Secondary
   Region           Region
  (us-east-1)      (eu-west-1)
       |                |
   K8s Cluster <---> K8s Cluster
       |                |
   MongoDB ReplicaSet

---

## 5. CRITICAL ISSUES SUMMARY

### Must Fix This Week (CRITICAL)

| ID | Issue | File | Impact | Fix |
|----|-------|------|--------|-----|
| C1 | No backup encryption | k8s/backup-cronjob.yaml:63 | Data exposure | Add --sse AES256 |
| C2 | No point-in-time recovery | k8s/backup-cronjob.yaml | Can't recover to timestamp | Implement oplog PITR |
| C3 | No multi-region deployment | k8s/base | Complete outage if region fails | Design cross-region |
| C4 | No documented runbook | N/A | Team doesn't know recovery | Create comprehensive runbook |
| C5 | No status page | N/A | Customer communication gap | Implement statuspage.io |

### Must Fix This Month (HIGH)

| ID | Issue | File | Impact | Fix |
|----|-------|------|--------|-----|
| H1 | 30-day retention too short | k8s/backup-cronjob.yaml:44 | Compliance risk | Extend to 90+ days |
| H2 | No backup monitoring alerts | .github/workflows/backup.yml | Failures unnoticed | Add CloudWatch alerts |
| H3 | No test restore automation | .github/workflows/backup.yml:166 | Backup integrity unknown | Expand restore tests |
| H4 | No DR simulation schedule | N/A | Untested procedures | Quarterly DR drills |
| H5 | Single Redis shard | k8s/base/12-redis.yaml | Scaling bottleneck | Enable Redis Cluster |
| H6 | No network policies | k8s/base | Lateral movement risk | Add NetworkPolicy |
| H7 | Backup uses primary MongoDB | k8s/backup-cronjob.yaml:53 | Performance impact | Use secondary/read pref |

---

## 6. CHAOS TESTING ANALYSIS

### Current Coverage (702 lines)

**Tested Scenarios:**
- Payment timeout handling
- Database connection loss
- Redis fallback behavior
- Circuit breaker pattern
- Concurrent requests
- Memory pressure

**Missing Tests:**
- Multi-region failover
- Database corruption recovery
- Application corruption recovery
- K8s control plane failure
- Storage exhaustion
- Network partition between zones

### Recommended Chaos Schedule

**Weekly:**
1. Database corruption simulation
2. Network partition between zones
3. Redis failure and recovery

**Monthly:**
1. Full regional failover drill
2. Backup restoration drill
3. Cascading failure simulation

**Quarterly:**
1. Full DR simulation (complete site failure)
2. RTO/RPO measurement
3. Stakeholder communication drill

---

## 7. COMMUNICATION PLAN ANALYSIS

### Current Infrastructure
- Prometheus + Grafana monitoring
- Loki log aggregation
- Sentry error tracking
- Health endpoints: /health, /health/live, /health/ready
- Slack notifications (GitHub Actions)

### Gaps (CRITICAL)

| Component | Current | Required | Gap |
|----------|---------|---------|-----|
| Status page | None | Required | CRITICAL |
| Stakeholder notification matrix | None | Required | CRITICAL |
| Customer communication templates | None | Required | HIGH |
| Incident severity levels | None | Required | HIGH |
| Escalation matrix | None | Required | HIGH |

### Recommended Communication Plan

**Incident Severity Levels:**
- **SEV1 (Critical):** Complete outage, data loss, security breach - 15 min response
- **SEV2 (High):** Major feature unavailable, >50% performance degradation - 30 min response
- **SEV3 (Medium):** Minor feature impact - 2 hour response
- **SEV4 (Low):** Cosmetic issues - Next business day

---

## 8. REMEDIATION ROADMAP

### Phase 1: Critical Fixes (Week 1-2)

1. **Enable S3 encryption for backups**

Fix in k8s/base/17-backup-cronjob.yaml:62-63
Change: aws s3 cp /tmp/backup/backup.archive s3:///mongodb/.archive.gz
To: aws s3 cp /tmp/backup/backup.archive s3:///mongodb/.archive.gz --sse AES256

2. **Set up backup monitoring alerts**
   - CloudWatch alarms for backup failures
   - Slack #incidents channel notifications
   - 1-hour escalation

3. **Implement point-in-time recovery**
   - Enable oplog collection
   - Create 15-minute oplog backups
   - Document PITR procedures

4. **Draft disaster recovery runbook**
   - Step-by-step recovery procedures
   - Decision tree for failure scenarios
   - Escalation matrix

### Phase 2: High Priority (Week 3-4)

1. Extend backup retention (30 to 90 days)
2. Automate backup restoration tests
3. Design multi-region architecture
4. Add Kubernetes network policies

### Phase 3: Medium Priority (Month 2-3)

1. Enable Redis Cluster mode
2. Implement circuit breakers (opossum)
3. Implement graceful degradation
4. Set up status page

### Phase 4: Long-term (Quarter 2+)

1. Deploy secondary region (eu-west-1)
2. Implement DR simulation program
3. SOC 2 Type II preparation

---

## 9. RTO/RPO GAP ANALYSIS

**Current State:** 45-75 min RTO, 24 hour RPO
**Target State:** 30 min RTO, 1 hour RPO

**Gap:** 15-45 min RTO gap, 23 hour RPO gap

**Required Actions:**
1. Incremental backups (reduce RPO)
2. Multi-region deployment (reduce RTO)
3. Automated failover (reduce RTO)
4. Quarterly testing (validate capabilities)

---

## 10. KEY METRICS TO TRACK

### Backup Metrics
- backup_success_rate: percentage of successful backups
- backup_duration_seconds: time to complete backup
- backup_size_bytes: size of backup files
- backup_restore_time_seconds: time to restore
- backup_age_hours: age of most recent backup

### Recovery Metrics
- rto_actual_minutes: measured recovery time
- rpo_actual_minutes: measured data loss
- failover_success_rate: percentage of successful failovers
- incident_mttr_minutes: mean time to resolution

### Infrastructure Metrics
- mongodb_replication_lag_seconds: primary-secondary lag
- redis_cluster_status: cluster health
- api_error_rate_percent: 5xx error rate
- api_latency_p99_seconds: 99th percentile latency

---

## 11. COMPLIANCE CHECKLIST

### Data Protection
- [x] Encryption at rest - MongoDB WiredTiger, Redis
- [ ] Encryption in transit - TLS required (verify)
- [ ] Backup encryption - MISSING (critical)
- [ ] Access logging - Need S3 logging
- [ ] Data retention policy - 30 days (extend to 90+)
- [ ] Data deletion procedures - Need to verify

### Security Controls
- [ ] Secrets management - Needs External Secrets Operator
- [ ] Network segmentation - Needs network policies
- [x] Vulnerability scanning - Weekly via security.yml
- [ ] Disaster recovery plan - MISSING (critical)
- [ ] Business continuity plan - MISSING (critical)

### Operational Resilience
- [x] Backup and recovery - Partial
- [ ] DR runbook - MISSING (critical)
- [x] Monitoring and alerting - Prometheus/Grafana
- [x] Change management - GitOps in place

---

## 12. CONCLUSION

**Overall Assessment:** 3/10 (Developing)

### Strengths
- Solid Kubernetes foundation with HPA
- MongoDB replica set with encryption
- Automated backup pipeline with S3
- Chaos engineering framework
- Comprehensive health endpoints

### Critical Gaps
1. **No multi-region deployment** (single point of failure)
2. **No point-in-time recovery capability**
3. **No documented disaster recovery runbook**
4. **No backup encryption**
5. **No status page for customer communication**
6. **Insufficient backup retention (30 days)**

### Immediate Actions

**This Week:**
1. Enable S3 encryption for all backups
2. Set up backup monitoring alerts
3. Draft emergency recovery procedures
4. Review and extend backup retention policy

**This Month:**
1. Implement point-in-time recovery
2. Complete disaster recovery runbook
3. Deploy Kubernetes network policies
4. Test full backup restoration

**This Quarter:**
1. Design multi-region architecture
2. Implement circuit breakers
3. Set up status page
4. Conduct first DR simulation

---

## APPENDIX A: FILE INVENTORY

### Kubernetes Configuration Files

`
k8s/base/
00-namespace.yaml
01-configmap.yaml
02-secrets.yaml (TEMPLATE - needs External Secrets)
03-api-deployment.yaml
04-api-service.yaml
05-worker-deployment.yaml
06-frontend-deployment.yaml
07-hpa.yaml
08-serviceaccounts.yaml
09-rbac.yaml
10-ingress.yaml
11-mongodb.yaml (MongoDB StatefulSet)
12-redis.yaml (Redis StatefulSet)
13-pdb.yaml (Pod Disruption Budgets)
14-servicemonitor.yaml
15-mongodb-statefulset.yaml (Legacy)
16-redis-statefulset.yaml (Legacy)
17-backup-cronjob.yaml (MongoDB + Redis backups)

kubernetes/ (Legacy standalone configs)
backend-deployment.yaml
frontend-deployment.yaml
hpa-api.yaml
ingress.yaml
redis-deployment.yaml
secrets.yaml
backup-cronjob.yaml
`

### Backup & Monitoring Files

`
.github/workflows/
backup.yml (Automated daily backup + verification)
[Other CI/CD workflows]

backend/src/scripts/
backup-db.ts (Database backup/restore script)
db-health.ts (Database health check)
[Other scripts]

frontend/tests/chaos/
chaos-scenarios.spec.ts (702-line chaos engineering tests)
`

### Configuration Files

`
.env.example (Template for environment variables)
docker-compose.yml (Local development stack)
helm/nilin/values-prod.yaml (Production Helm values)
`

---

## APPENDIX B: RECOMMENDED IMPLEMENTATIONS

### B.1 S3 Backup Encryption Fix

Change in k8s/base/17-backup-cronjob.yaml:62-63

FROM:
aws s3 cp /tmp/backup/backup.archive s3:///mongodb/.archive.gz

TO:
aws s3 cp /tmp/backup/backup.archive s3:///mongodb/.archive.gz --sse AES256 --sse-kms-key-id alias/aws/s3

### B.2 Point-in-Time Recovery Implementation

Add to backup-cronjob.yaml:

`yaml
- name: PITR_BACKUP
  image: mongo:6.0
  schedule: "*/15 * * * *"  # Every 15 minutes
  command:
    - /bin/bash
    - -c
    - |
      # Continuous oplog backup for PITR
      mongodump \
        --host mongodb \
        --port 27017 \
        --username "" \
        --password "" \
        --authenticationDatabase admin \
        --collection=oplog.rs \
        --out=/tmp/oplog \
        --oplog
      aws s3 cp /tmp/oplog s3:///mongodb/oplog/backup-/
`

### B.3 Backup Monitoring Alert

Add CloudWatch Alarm for backup failure:

`yaml
Resources:
  BackupFailureAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: nilin-backup-failure
      MetricName: backup_success
      Namespace: NILIN/BACKUP
      Statistic: Sum
      Period: 3600
      Threshold: 1
      ComparisonOperator: LessThanThreshold
      EvaluationPeriods: 1
      AlarmActions:
        - !Ref SNSTopic
`

---

## APPENDIX C: METRICS DASHBOARD RECOMMENDATIONS

### Grafana Dashboard Panels

1. **Backup Status**
   - Backup Success Rate (%)
   - Backup Duration (seconds)
   - Backup Size (GB)
   - Last Successful Backup (hours ago)

2. **Recovery Readiness**
   - RTO Actual (minutes)
   - RPO Actual (minutes)
   - Backup Restoration Test Status
   - DR Drill Schedule

3. **Infrastructure Health**
   - MongoDB Replication Lag (seconds)
   - Redis Cluster Status
   - API Error Rate (%)
   - Pod Health (% healthy)

4. **Alerts & Incidents**
   - Active Alerts
   - MTTR (minutes)
   - MTBF (hours)
   - Incident Count (last 30 days)

---

## APPENDIX D: SAMPLE DR RUNBOOK TEMPLATE

### Database Failure Recovery

**Symptoms:**
- Health checks failing
- Connection timeouts
- Replication lag > 10 seconds

**Immediate Actions (0-15 min):**
1. Check MongoDB replica set status:
   kubectl exec -it nilin-mongodb-0 -- mongosh --eval "rs.status()"
2. Identify primary vs secondary
3. Check pod logs:
   kubectl logs nilin-mongodb-0
4. Check PVC status:
   kubectl get pvc -n nilin

**Recovery Steps (15-60 min):**
1. If primary down: Primary election will happen automatically
2. If secondary down: Scale up replacement pod
3. If data corruption: Restore from backup
4. Verify replication lag after recovery

### Redis Failure Recovery

**Symptoms:**
- High API latency
- Cache connection errors
- Memory pressure alerts

**Recovery Steps:**
1. Check Redis cluster status:
   kubectl exec -it nilin-redis-0 -- redis-cli -a  cluster info
2. If pod failure: HPA will recover automatically
3. If cluster failure: Restore from backup
4. Warm cache with critical data

### Application Failure Recovery

**Symptoms:**
- High error rate (5xx)
- Pod restarts
- OOMKilled events

**Recovery Steps:**
1. Check pod status:
   kubectl get pods -n nilin -l app=nilin-api
2. Check pod logs:
   kubectl logs -f nilin-api-xxx -n nilin
3. Check events:
   kubectl get events -n nilin --sort-by='.lastTimestamp'
4. If OOMKilled: Increase memory limits
5. If crash looping: Rollback to previous version:
   kubectl rollout undo deployment/nilin-api -n nilin

---

**Report Prepared By:** SRE Lead  
**Review Date:** May 22, 2026  
**Next Review:** June 22, 2026  
**Distribution:** Engineering, CTO, CEO
