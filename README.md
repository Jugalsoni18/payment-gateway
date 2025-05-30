# 🚀 ShopEasy - Modern UPI Payment Gateway

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

---

## 🚀 Quick Start Guide

### Prerequisites
Make sure you have these installed:
- **Node.js** (v14 or higher)
- **PostgreSQL** (v12 or higher)
- **Razorpay Account** (free test account works!)

### 1. Clone & Install
```bash
git clone <your-repo-url>
cd payment2
npm install
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
├── 📁 models/          # Sequelize models (Order, Payment, PaymentLog)
├── 📁 routes/          # API routes (payment, order)
├── 📁 services/        # Business logic (payment logger)
├── 📁 utils/           # Utilities (WebSocket helpers)
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
