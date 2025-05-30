# Payment Logging System Documentation

## Overview

The Payment Logging System provides comprehensive audit trails and detailed logging for all payment transactions in the UPI payment gateway. It stores all payment events, status changes, and transaction details in a structured format for analysis, debugging, and compliance.

## Database Schema

### PaymentLog Table Structure

The `payment_logs` table stores detailed information about every payment event:

#### 📌 Core Fields (As Requested)

| Field | Type | Purpose | Example |
|-------|------|---------|---------|
| `order_id` | STRING | Generated via Razorpay API (razorpay.orders.create) | `ORD1748108538196` |
| `payment_id` | STRING | Populated after success (razorpay_payment_id in webhook/checkout) | `pay_ABC123XYZ` |
| `status` | ENUM | Track status: created, paid, failed, refunded | `paid` |
| `amount` | BIGINT | Always store in smallest currency unit (e.g., paisa) | `1575` (₹15.75) |
| `method` | STRING | Payment method (upi, card, etc.) — helpful for filters | `upi` |
| `response_data` | JSONB | Store full webhook or payment response (JSONB) | `{...}` |
| `created_at` | TIMESTAMP | When the order was created | `2025-05-24 17:42:19` |
| `updated_at` | TIMESTAMP | Updated when webhook or verification occurs | `2025-05-24 17:43:29` |

#### 📌 Additional Fields for Enhanced Logging

| Field | Type | Purpose |
|-------|------|---------|
| `razorpay_order_id` | STRING | Razorpay order ID |
| `razorpay_payment_id` | STRING | Razorpay payment ID |
| `previous_status` | STRING | Previous status for tracking changes |
| `currency` | STRING | Currency code (INR, USD, etc.) |
| `amount_display` | DECIMAL | Human-readable amount (₹15.75) |
| `method_details` | JSONB | Additional payment method details |
| `webhook_event_id` | STRING | Webhook event ID for deduplication |
| `webhook_event_type` | STRING | Type of webhook event |
| `customer_name` | STRING | Customer name |
| `customer_email` | STRING | Customer email |
| `customer_phone` | STRING | Customer phone |
| `transaction_id` | STRING | Bank/UPI transaction ID |
| `error_code` | STRING | Error code if payment failed |
| `error_description` | TEXT | Detailed error description |
| `fee` | BIGINT | Payment processing fee (paisa) |
| `tax` | BIGINT | Tax on processing fee (paisa) |
| `refund_amount` | BIGINT | Amount refunded (paisa) |
| `event_type` | ENUM | Type of event being logged |
| `source` | ENUM | Source of the log entry |
| `ip_address` | INET | IP address of the request |
| `metadata` | JSONB | Additional metadata |

## Status Values

The system tracks the following payment statuses:

- **`created`** - Order created, payment not initiated
- **`pending`** - Payment initiated but not completed
- **`authorized`** - Payment authorized but not captured
- **`captured`** - Payment captured successfully
- **`paid`** - Payment completed successfully
- **`failed`** - Payment failed
- **`cancelled`** - Payment cancelled by user
- **`refunded`** - Payment refunded
- **`partial_refund`** - Partial refund processed

## Event Types

The system logs the following event types:

- **`order_created`** - New order created
- **`payment_initiated`** - Payment process started
- **`payment_authorized`** - Payment authorized
- **`payment_captured`** - Payment captured
- **`payment_failed`** - Payment failed
- **`payment_cancelled`** - Payment cancelled
- **`refund_initiated`** - Refund process started
- **`refund_processed`** - Refund completed
- **`webhook_received`** - Webhook event received
- **`status_updated`** - Manual status update

## Source Types

Logs are categorized by source:

- **`api`** - Direct API calls
- **`webhook`** - Razorpay webhook events
- **`manual`** - Manual interventions
- **`system`** - System-generated events
- **`callback`** - UPI callback responses

## PaymentLogger Service

### Usage Examples

#### Log Order Creation
```javascript
await PaymentLogger.logOrderCreated({
  orderId: 'ORD123',
  razorpayOrderId: 'order_ABC',
  amount: 15.75,
  customerName: 'John Doe',
  customerEmail: 'john@example.com',
  customerPhone: '9876543210'
}, {
  source: 'api',
  requestData: req.body,
  ipAddress: req.ip
});
```

#### Log Payment Success
```javascript
await PaymentLogger.logPaymentSuccess({
  orderId: 'ORD123',
  paymentId: 'pay_XYZ',
  amount: 15.75,
  method: 'upi',
  status: 'paid'
}, {
  source: 'webhook',
  webhookEventId: 'evt_123',
  responseData: webhookPayload
});
```

#### Log Payment Failure
```javascript
await PaymentLogger.logPaymentFailure({
  orderId: 'ORD123',
  paymentId: 'pay_XYZ',
  amount: 15.75,
  errorCode: 'BAD_REQUEST_ERROR',
  errorDescription: 'Payment failed due to insufficient funds'
}, {
  source: 'webhook',
  webhookEventId: 'evt_456'
});
```

## API Endpoints

### Get Payment Logs for Order
```
GET /api/payment/logs/:orderId
```

**Query Parameters:**
- `eventType` - Filter by event type
- `status` - Filter by status
- `limit` - Number of records (default: 50)
- `offset` - Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "orderId": "ORD123",
  "logs": [...],
  "count": 2
}
```

### Get Payment Logs Summary
```
GET /api/payment/logs-summary
```

**Query Parameters:**
- `startDate` - Start date filter
- `endDate` - End date filter
- `status` - Status filter
- `method` - Payment method filter

**Response:**
```json
{
  "success": true,
  "summary": [
    {
      "status": "paid",
      "method": "upi",
      "count": "10",
      "total_amount": "15750"
    }
  ]
}
```

### Get All Payment Logs
```
GET /api/payment/logs
```

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Records per page (default: 20)
- `status` - Status filter
- `method` - Payment method filter
- `eventType` - Event type filter
- `source` - Source filter
- `startDate` - Start date filter
- `endDate` - End date filter
- `orderId` - Order ID filter
- `paymentId` - Payment ID filter

## Amount Storage

All amounts are stored in the **smallest currency unit** (paisa for INR):

- **Input**: ₹15.75
- **Stored**: 1575 (paisa)
- **Display**: Automatically converted back to ₹15.75

This ensures:
- ✅ No floating-point precision issues
- ✅ Accurate financial calculations
- ✅ Compliance with financial standards

## Integration Points

The logging system is automatically integrated with:

1. **Order Creation** - Logs when new orders are created
2. **UPI Callbacks** - Logs payment completions from UPI
3. **Webhook Events** - Logs all Razorpay webhook events
4. **Manual Operations** - Logs manual payment completions
5. **Status Updates** - Logs any status changes

## Performance Considerations

### Indexes
The system includes optimized indexes for:
- Order ID lookups
- Payment ID lookups
- Status filtering
- Method filtering
- Date range queries
- Customer email searches

### Automatic Cleanup
Consider implementing automatic cleanup for old logs:
```sql
DELETE FROM payment_logs 
WHERE created_at < NOW() - INTERVAL '2 years'
AND status IN ('created', 'failed');
```

## Security Features

- **IP Address Logging** - Tracks request origins
- **User Agent Logging** - Records client information
- **Webhook Deduplication** - Prevents duplicate processing
- **Data Encryption** - Sensitive data can be encrypted at rest

## Monitoring and Alerts

Set up monitoring for:
- High failure rates
- Unusual payment patterns
- Webhook processing delays
- Database performance

## Compliance

The logging system supports:
- **PCI DSS** compliance requirements
- **Financial audit** trails
- **Regulatory reporting**
- **Dispute resolution**

## Testing

Test the logging system with:
```bash
# Create order and check logs
curl -X POST http://localhost:3000/api/payment/create-order \
  -H "Content-Type: application/json" \
  -d '{"customerName":"Test","amount":10.50,...}'

# Check order logs
curl http://localhost:3000/api/payment/logs/ORD123

# Get summary
curl http://localhost:3000/api/payment/logs-summary
```

The Payment Logging System provides comprehensive audit trails and detailed insights into your payment operations while maintaining high performance and security standards.
