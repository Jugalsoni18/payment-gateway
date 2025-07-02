# Summary
ShopEasy is a modern UPI payment gateway built with Node.js, Express, and Razorpay. It supports secure, real-time UPI transactions with dynamic QR codes and webhook verification. The frontend is responsive and lightweight, while the backend ensures data reliability using PostgreSQL, Redis, and Socket.IO. Admins get a dashboard for tracking payments and managing orders. Features like rate limiting, payment auditing, and test integration ensure both developer ease and production readiness.

- [🛠️ Tech Stack That Powers Success](#-tech-stack-that-powers-success)
- [🌟 Features That Wow Users](#-features-that-wow-users)
  - [🛒 Complete Shopping Experience](#-complete-shopping-experience)
  - [💳 Smart Payment System](#-smart-payment-system)
  - [📊 Admin Dashboard](#-admin-dashboard)
  - [🔒 Enterprise-Grade Security](#-enterprise-grade-security)
  - [⚡ Performance & Reliability](#-performance--reliability)
  - [📈 Advanced Payment Reliability & DevOps Enhancements](#-advanced-payment-reliability--devops-enhancements)
    - [🔁 Webhook Retry Queue with Bull.js + Redis](#-webhook-retry-queue-with-bulljs--redis)
    - [🔁 Fallback Polling for Payment Status](#-fallback-polling-for-payment-status)
    - [🧪 Integration Testing with Jest or Mocha](#-integration-testing-with-jest-or-mocha)
    - [🗃️ Redis + Socket.IO Adapter for WebSocket Scaling](#-redis--socketio-adapter-for-websocket-scaling)
    - [💳 Transaction Ledger for Payment Auditing](#-transaction-ledger-for-payment-auditing)
    - [📄 Store Purchase Details After Payment Confirmation](#-store-purchase-details-after-payment-confirmation)
    - [⚠️ Rate Limiting to Prevent Abuse](#-rate-limiting-to-prevent-abuse)
- [Quick Start Guide](#quick-start-guide)
- [🔧 Razorpay Integration Guide](#-razorpay-integration-guide)
- [🧪 Testing Your Integration](#-testing-your-integration)
- [📁 Project Structure](#-project-structure)
- [🌍 Environment Variables Reference](#-environment-variables-reference)
- [📄 License](#-license)
- [👨‍💻 Built With ❤️](#-built-with-️)
- 
# ShopEasy - Modern UPI Payment Gateway

**A blazing fast, secure, and developer-friendly e-commerce payment solution powered by Razorpay** ⚡

Transform your online business with seamless UPI payments, real-time order tracking, and a beautiful shopping experience that your customers will love!

---

## 🛠️ Tech Stack That Powers Success

**Backend Powerhouse:**
- **Node.js** + **Express.js** - Solid, secure, and scalable
- **PostgreSQL** - Rock-solid database with JSONB support
- **Sequelize ORM** - Database operations made elegant
- **Socket.IO** - Real-time payment updates (no more page refreshing!)

**Frontend Excellence:**
- **Vanilla JavaScript** - Fast, lightweight, no framework bloat
- **Responsive CSS** - Looks stunning on every device
- **Font Awesome** - Beautiful icons that users love

**Payment & Security:**
- **Razorpay API** - India's most trusted payment gateway
- **UPI Integration** - Support for all major UPI apps
- **Dynamic QR Codes** - Generated fresh for every transaction
- **Webhook Verification** - Bulletproof payment confirmation

---

## 🌟 Features That Wow Users

### 🛒 **Complete Shopping Experience**
- Beautiful product catalog with cart functionality
- Smooth checkout flow with customer details
- Real-time cart updates and total calculations

### 💳 **Smart Payment System**
- **Dynamic UPI QR codes** generated for each order
- Support for **Google Pay, PhonePe, Paytm** and all UPI apps
- **Real-time payment status** updates via WebSocket
- Automatic payment verification and order completion

### 📊 **Admin Dashboard**
- Live order monitoring and management
- Payment logs with detailed transaction history
- Manual payment completion for edge cases
- Database health monitoring

### 🔒 **Enterprise-Grade Security**
- Razorpay webhook signature verification
- Secure payment ID generation and validation
- SQL injection protection with Sequelize ORM
- Environment-based configuration management

### ⚡ **Performance & Reliability**
- WebSocket-based real-time updates (no polling!)
- Database connection pooling and error handling
- Graceful fallbacks for network issues
- Comprehensive logging and error tracking

### 📈 **Advanced Payment Reliability & DevOps Enhancements**

#### 🔁 **Webhook Retry Queue with Bull.js + Redis**
Ensure no payment confirmation is lost due to network/server issues.

```bash
npm install bull ioredis
```
Implements a retryable webhook queue with exponential backoff.

**Files added:**
- `queues/paymentQueue.js`
- `workers/paymentProcessor.js`

Webhook handler now queues payloads and retries on failure.

#### 🔁 **Fallback Polling for Payment Status**
If WebSocket or SSE fails, frontend falls back to polling.

- New API route: `GET /api/payment/status/:orderId`
- Client polls every 10s if no real-time update is received.

```js
// Frontend JS fallback
setInterval(async () => {
  const res = await fetch(`/api/payment/status/${orderId}`);
  const { status } = await res.json();
  if (status === 'PAID') window.location.href = '/success.html';
}, 10000);
```

#### 🧪 **Integration Testing with Jest or Mocha**
Automated tests now verify key payment flows.

```bash
npm install --save-dev jest supertest
```
- Tests order creation, webhook processing, and status updates.
- Test file: `/tests/payment.test.js`

#### 🗃️ **Redis + Socket.IO Adapter for WebSocket Scaling**
Enables multi-instance real-time communication.

```bash
npm install socket.io-redis
```

```js
// server.js
const redisAdapter = require('socket.io-redis');
io.adapter(redisAdapter({ host: 'localhost', port: 6379 }));
```

#### 💳 **Transaction Ledger for Payment Auditing**
Stores all verified payment transactions in a dedicated database table.

- New Sequelize model: `models/Transaction.js`
- Fields: `order_id`, `payment_id`, `event_type`, `amount`, `timestamp`

#### 📄 **Store Purchase Details After Payment Confirmation**
User purchase data is only stored in the DB after successful payment verification.

- New model: `models/Purchase.js`
- Captures: `name`, `email`, `phone`, `items`, `amount`, `status`
- Saved via verified webhook handler

#### ⚠️ **Rate Limiting to Prevent Abuse**
API endpoints are now protected from brute force attacks.

```bash
npm install express-rate-limit
```

```js
const rateLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/payment', rateLimiter);
```

---

## Quick Start Guide

### Prerequisites
Make sure you have these installed:
- **Node.js** (v14 or higher)
- **PostgreSQL** (v12 or higher)
- **Redis** (for queue and socket scaling)
- **Razorpay Account** (free test account works!)

### 1. Clone & Install
```bash
git clone <your-repo-url>
cd payment2
npm install

# Install Redis (required for queue and socket scaling)
# Mac: brew install redis
# Ubuntu: sudo apt install redis-server
# Windows: Download from https://redis.io/download

# Install new dependencies for advanced features
npm install bull ioredis express-rate-limit socket.io-redis

# Install testing dependencies
npm install --save-dev jest supertest
```

### 2. Database Setup
```bash
# Create PostgreSQL database
createdb payment_gateway

# Or using psql
psql -U postgres -c "CREATE DATABASE payment_gateway;"
```

### 3. Environment Configuration
Copy the `.env.example` to `.env` and update with your details:

```env
# Server Configuration
PORT=3000

# Razorpay API Keys (Get from https://dashboard.razorpay.com)
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_secret_key

# UPI Configuration
UPI_VPA=yourname@upi
MERCHANT_NAME=YourBusinessName

# Database Configuration
POSTGRES_DB=payment_gateway
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

# Webhook Secret (Create in Razorpay Dashboard)
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

### 4. Launch Your Payment Gateway
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

🎉 **That's it!** Visit `http://localhost:3000` and start accepting payments!

---

## 🔧 Razorpay Integration Guide

### Setting Up Razorpay

1. **Create Account**: Sign up at [Razorpay Dashboard](https://dashboard.razorpay.com)
2. **Get API Keys**: Navigate to Settings → API Keys
3. **Test Mode**: Use test keys for development (they're free!)
4. **Webhook Setup**: Create webhook endpoint pointing to `your-domain/api/payment/webhook`

### Test Payment Flow

Use these **test UPI IDs** in Razorpay test mode:
- **Success**: `success@razorpay`
- **Failure**: `failure@razorpay`

---

## 🧪 Testing Your Integration

### Manual Testing
1. Add products to cart on the homepage
2. Proceed to checkout and fill customer details
3. Complete payment using test UPI ID
4. Watch real-time status updates!

### API Testing
```bash
# Test order creation
curl -X POST http://localhost:3000/api/payment/create-order \
  -H "Content-Type: application/json" \
  -d '{"amount": 100, "customerName": "Test User", "customerEmail": "test@example.com", "customerPhone": "9999999999", "items": [{"name": "Test Product", "price": 100, "quantity": 1}]}'
```

---

## 📁 Project Structure

```
payment2/
├── 📁 config/          # Database configuration
├── 📁 models/          # Sequelize models (Order, Payment, PaymentLog, Purchase, Transaction)
├── 📁 routes/          # API routes (payment, order)
├── 📁 services/        # Business logic (payment logger)
├── 📁 utils/           # Utilities (WebSocket helpers)
├── 📁 queues/          # Bull.js job queues for webhook retry
├── 📁 workers/         # Job processors for payment handling
├── 📁 tests/           # Automated test files (Jest/Mocha)
├── 📁 public/          # Frontend assets
│   ├── 📁 css/         # Stylesheets
│   ├── 📁 js/          # JavaScript files
│   ├── index.html      # Homepage
│   ├── checkout.html   # Checkout page
│   ├── payment.html    # Payment page
│   └── success.html    # Success page
├── server.js           # Main application entry point
├── package.json        # Dependencies and scripts
└── .env               # Environment variables
```

---

## 🌍 Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `RAZORPAY_KEY_ID` | Your Razorpay API key | `rzp_test_xxxxx` |
| `RAZORPAY_KEY_SECRET` | Your Razorpay secret | `your_secret` |
| `UPI_VPA` | Your UPI ID for payments | `business@upi` |
| `MERCHANT_NAME` | Business name shown in UPI | `ShopEasy` |
| `POSTGRES_DB` | Database name | `payment_gateway` |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook verification secret | `webhook_secret` |

---

## 📄 License

**MIT License** - Feel free to use this in your projects, modify it, and make it even better!

---

## 👨‍💻 Built With ❤️

This project represents the **future of digital payments** in India. Built with modern technologies, security best practices, and a focus on user experience.

**Ready to revolutionize your payment flow?** 🚀

*Star this repo if it helped you build something amazing!* ⭐
