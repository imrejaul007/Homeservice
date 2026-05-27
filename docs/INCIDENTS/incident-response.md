# Incident Response Playbook

## Severity Levels

| Level | Response Time | Examples |
|-------|---------------|----------|
| P0 | 15 minutes | Payment down, Data breach |
| P1 | 1 hour | Booking broken, API errors |
| P2 | 4 hours | Non-critical feature down |
| P3 | 24 hours | Minor bugs, cosmetic |

## Response Process

### 1. Detection
- Automated alerts
- User reports
- Internal发现

### 2. Assessment
- Identify severity
- Determine scope
- Assign incident commander

### 3. Communication
- Notify stakeholders
- Update status page
- Slack updates

### 4. Resolution
- Implement fix
- Verify resolution
- Monitor for recurrence

### 5. Post-Mortem
- Document timeline
- Identify root cause
- Create action items

## Contact Information

| Role | Contact |
|------|---------|
| Engineering Lead | @lead |
| On-Call Engineer | PagerDuty |
| CTO | @cto |
| Security | security@nilin.app |

## Escalation Path

```
P3: Individual → Team Lead
P2: Team Lead → Engineering Manager
P1: EM → CTO
P0: CTO → CEO
```

## Communication Templates

### Initial Notification
```
⚠️ INCIDENT [P1]
Service: Booking API
Impact: Users unable to create bookings
Status: Investigating
Next update: 30 minutes
```

### Update
```
📊 UPDATE [P1]
Status: Root cause identified
ETA: 30 minutes to fix
Action: Scaling up servers
```

### Resolution
```
✅ RESOLVED [P1]
Duration: 45 minutes
Root cause: Database connection pool exhausted
Fix: Increased pool size, added circuit breaker
```
