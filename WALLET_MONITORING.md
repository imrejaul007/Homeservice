# Wallet System Monitoring Recommendations

## Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `wallet.topup.success` | Counter | Successful wallet top-ups |
| `wallet.topup.failure` | Counter | Failed top-up attempts |
| `wallet.topup.verification_failed` | Counter | Payment verification failures |
| `wallet.balance_fetch.latency` | Histogram | GET /wallet response time |
| `wallet.credit.duplicate_blocked` | Counter | Duplicate reference prevention triggers |
| `loyalty.job.processed` | Counter | Loyalty jobs completed |
| `loyalty.job.skipped` | Counter | Idempotent loyalty job skips |
| `loyalty.job.failed` | Counter | Loyalty job failures |
| `referral.reward.awarded` | Counter | Referrer bonuses credited |
| `cashback.earned` | Counter | Cashback entries created |
| `cashback.redeemed` | Counter | Cashback redeemed to wallet |

## Alerts

- **Critical**: `wallet.topup.verification_failed` rate > 5% over 15 minutes
- **Critical**: Any `wallet.credit` without matching Stripe payment in production
- **High**: `loyalty.job.failed` > 10 in 1 hour
- **High**: `wallet.topup.failure` > 20 in 1 hour
- **Medium**: `wallet.balance_fetch.latency` p95 > 2s

## Structured Log Fields

Include on all wallet operations:
- `userId`
- `correlationId`
- `reference` / `referenceType`
- `amount`
- `paymentIntentId` (for top-ups)
- `action` (WALLET_CREDITED, DUPLICATE_CREDIT_PREVENTED, etc.)

## Dashboard Panels

1. Wallet top-up success/failure ratio (24h)
2. Average wallet balance vs pending balance
3. Loyalty job queue depth and failure rate
4. Referral conversion funnel (registered → first booking → reward)
5. Cashback earned vs redeemed volume
