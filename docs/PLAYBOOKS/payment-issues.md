# Payment Issues Playbook

## Quick Diagnosis

### 1. Check Stripe Dashboard
- View payment events in Stripe Dashboard
- Check for failed payments
- Review webhook logs

### 2. Check Database
```javascript
// Find failed payment
db.bookings.findOne({
  'payment.status': 'failed',
  'payment.stripePaymentIntentId': 'pi_xxx'
})
```

## Common Issues

### Payment Intent Creation Fails

**Symptoms:**
- Error creating payment intent
- 500 error on checkout

**Steps:**
1. Check Stripe API key is valid
2. Verify Stripe is accessible
3. Check request payload format
4. Review Stripe error message

### Webhook Not Receiving Events

**Symptoms:**
- Payment shows pending but Stripe shows paid
- No webhook events in Stripe Dashboard

**Steps:**
1. Verify webhook URL is accessible
2. Check webhook signature
3. Review webhook logs
4. Resend test event from Stripe

### Refund Fails

**Symptoms:**
- Refund button disabled
- Error on refund attempt

**Steps:**
1. Check payment status (must be 'succeeded')
2. Verify refund hasn't already been processed
3. Check Stripe refund limits
4. Review error message

### Double Charges

**Symptoms:**
- Customer charged twice
- Duplicate payment intents

**Symptoms:**
1. Check for idempotency key usage
2. Verify webhook isn't processing twice
3. Check booking payment status
4. Look for duplicate Stripe events

## Escalation

If unresolved after 30 minutes:
1. Contact Stripe Support
2. Document all findings
3. Prepare customer refund if needed
