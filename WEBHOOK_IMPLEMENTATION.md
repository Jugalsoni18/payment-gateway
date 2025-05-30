# Razorpay Webhook Implementation Guide

## 🎯 Overview

This implementation provides a robust, production-ready Razorpay webhook system that handles payment events securely and reliably.

## ✅ What's Implemented

### 1. **Webhook Endpoint**
- **URL**: `POST /api/payment/webhook`
- **Security**: Signature verification using `RAZORPAY_WEBHOOK_SECRET`
- **Event Handling**: Supports `payment.captured`, `payment.failed`, `payment.authorized`, `order.paid`
- **Deduplication**: Prevents duplicate webhook processing

### 2. **Enhanced Database Schema**

#### **Orders Table (Enhanced)**
```sql
-- New fields added to existing Order model
webhookEventId VARCHAR(255)     -- For deduplication
paymentMethod VARCHAR(255)      -- UPI, card, netbanking, etc.
paymentCapturedAt TIMESTAMP     -- When payment was captured
lastWebhookPayload JSONB        -- Debug information
```

#### **Payments Table (New)**
```sql
-- Comprehensive payment tracking
id UUID PRIMARY KEY
razorpayPaymentId VARCHAR(255) UNIQUE
razorpayOrderId VARCHAR(255)
orderId VARCHAR(255)            -- References Orders.orderId
amount DECIMAL(10,2)
currency VARCHAR(3)
status ENUM('created', 'authorized', 'captured', 'refunded', 'failed', 'pending')
method VARCHAR(255)             -- Payment method
bank VARCHAR(255)               -- Bank name
wallet VARCHAR(255)             -- Wallet name
vpa VARCHAR(255)                -- UPI VPA
-- Card details
cardId VARCHAR(255)
cardLast4 VARCHAR(4)
cardNetwork VARCHAR(255)
cardType VARCHAR(255)
-- Timestamps
authorizedAt TIMESTAMP
capturedAt TIMESTAMP
failedAt TIMESTAMP
-- Error handling
errorCode VARCHAR(255)
errorDescription TEXT
errorSource VARCHAR(255)
errorStep VARCHAR(255)
errorReason VARCHAR(255)
-- Webhook tracking
webhookEventId VARCHAR(255) UNIQUE
webhookEventType VARCHAR(255)
lastWebhookPayload JSONB
-- Additional fields
international BOOLEAN
fee DECIMAL(10,2)
tax DECIMAL(10,2)
refundStatus ENUM('null', 'partial', 'full')
amountRefunded DECIMAL(10,2)
notes JSONB
```

### 3. **API Endpoints**

#### **Webhook Endpoint**
```
POST /api/payment/webhook
Content-Type: application/json
X-Razorpay-Signature: {signature}
```

#### **Payment Management**
```
GET /api/payment/payment/:paymentId          # Get payment details
GET /api/payment/order/:orderId/payments     # Get all payments for order
GET /api/payment/enhanced-status/:orderId    # Enhanced status with webhook data
```

### 4. **Event Handlers**

#### **payment.captured**
- Creates/updates Payment record with captured status
- Updates Order status to 'completed'
- Records capture timestamp and payment details

#### **payment.failed**
- Creates/updates Payment record with failed status
- Updates Order status to 'failed'
- Records error details and failure reason

#### **payment.authorized**
- Creates/updates Payment record with authorized status
- Updates Order status to 'authorized'
- Records authorization timestamp

#### **order.paid**
- Updates Order status to completed if not already
- Handles cases where payment.captured might be missed

## 🚀 Setup Instructions

### 1. **Environment Variables**
Add to your `.env` file:
```env
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here
```

### 2. **Database Migration**
The enhanced schema will be automatically applied when you restart your server due to Sequelize's `sync({ alter: true })` configuration.

### 3. **Razorpay Dashboard Configuration**
1. Go to Razorpay Dashboard > Settings > Webhooks
2. Create a new webhook with URL: `https://yourdomain.com/api/payment/webhook`
3. Select events: `payment.captured`, `payment.failed`, `payment.authorized`, `order.paid`
4. Set the webhook secret and update your `.env` file

## 🧪 Testing

### **Production Testing**
Test your webhook implementation by making actual payments through your payment flow. The webhook endpoint will automatically receive and process real payment events from Razorpay.

## 🔒 Security Features

### **Signature Verification**
- All webhooks are verified using HMAC SHA256
- Invalid signatures are rejected with 400 status
- Raw body parsing ensures signature integrity

### **Deduplication**
- Webhook event IDs are stored to prevent duplicate processing
- Duplicate events return 200 status without processing

### **Error Handling**
- Comprehensive error logging
- Graceful failure handling
- Proper HTTP status codes

## 📊 Monitoring & Debugging

### **Logging**
- All webhook events are logged with full payload
- Error details are captured for failed payments
- Processing status is logged for each event

### **Database Tracking**
- `lastWebhookPayload` field stores complete webhook data
- `webhookEventId` enables event tracking
- Timestamps track payment lifecycle

## 🔄 Migration from Old System

### **Backward Compatibility**
- Existing `/verify` endpoint still works
- Old payment status checking continues to function
- Gradual migration possible

### **Enhanced Features**
- Real-time payment updates via webhooks
- Detailed payment method tracking
- Comprehensive error handling
- Better payment lifecycle management

## 🚨 Production Checklist

- [ ] Webhook secret configured in environment
- [ ] Webhook URL configured in Razorpay Dashboard
- [ ] Database schema updated
- [ ] Webhook endpoint tested
- [ ] Error monitoring set up
- [ ] Backup webhook URL configured (recommended)
- [ ] Rate limiting implemented (if needed)
- [ ] SSL certificate valid for webhook URL

## 📈 Benefits

1. **Real-time Updates**: Instant payment status updates
2. **Reliability**: No dependency on client-side verification
3. **Security**: Server-side signature verification
4. **Scalability**: Event-driven architecture
5. **Debugging**: Comprehensive logging and payload storage
6. **Compliance**: Proper payment lifecycle tracking
